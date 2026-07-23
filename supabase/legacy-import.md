# Legacy-import vanuit Google Sheets

Deze procedure is handmatig en niet-destructief. Test altijd eerst in een apart Supabase-project; commit geen CSV-bestanden of persoonsgegevens.

## 1. Exporteren

Open de oorspronkelijke Google Sheet. Kies per tabblad **Bestand → Downloaden → Door komma's gescheiden waarden (.csv)** voor `Spellen`, `Scores` en `Spelstarts`. Bewaar de bestanden lokaal buiten deze repository.

## 2. Kolommapping

| Sheet | Supabase | Mapping |
| --- | --- | --- |
| Spellen | `private.games` | `id`→`id`, `titel`→`title`, `omschrijving`→`description`, `status`→`status`, `open_vanaf`→`open_from`, `sluit_op`→`close_at`, `hint`→`hint`, `max_punten`→`max_points`, `volgorde`→`display_order` |
| Scores | `private.scores` | `tijdstip`→`created_at`, `naam`→`player_name`, `spel_id`→`game_id`, `punten`→`score`, `speeltijd_seconden`→`seconds`, `pogingen`→`attempts`, `detail`→`detail` |
| Spelstarts | `private.game_starts` | `tijdstip`→`started_at`, `naam`→`player_name`, `spel_id`→`game_id`, `status`→`status`, `bron`→`source`, `apparaat`→`user_agent` |

`spel` is een historische weergavekolom en wordt afgeleid van `private.games`. Maak voor elke unieke, niet-testnaam eerst een anonieme Supabase-gebruiker en een bijbehorende `private.players`-rij, of voeg tijdelijk een gecontroleerde SQL-mappingtabel `legacy_name → user_id` toe. Verwijder zo'n hulpmiddel na de import.

## 3. Datums en opschoning

Zet Nederlandse waarden zoals `23-07-2026 14:30:00` expliciet om met `to_timestamp(value, 'DD-MM-YYYY HH24:MI:SS') AT TIME ZONE 'Europe/Amsterdam'`; ISO-waarden kunnen rechtstreeks naar `timestamptz`. Controleer zomer-/wintertijd aan de hand van enkele bekende rijen.

Sla testspelers zoals `Bijv. Mark` over met een case-insensitieve filter op `^bijv\\.?\\s+mark$`, en inspecteer overige demo- of lege namen handmatig. Normaliseer echte namen met `lower(trim(name))` en koppel ze aan `private.players.normalized_name`.

## 4. Volgorde en duplicaten

Importeer eerst spellen (met de originele open/sluitmomenten), daarna spelers, scores en starts. Starts mogen volledig behouden blijven. Wil je ze samenvoegen, dedupliceer dan alleen exact gelijke `(user_id, game_id, started_at, source)`-records; behoud anders alle startpogingen.

`private.scores` staat maximaal één score per speler/spel toe. Maak vóór de uiteindelijke import een stagingtabel en kies per `(normalized_name, game_id)` de nieuwste geldige rij: een rij met score 100–`max_points`, seconds 0–86400, attempts 0–10000 en geldige JSON-detail krijgt voorrang; daarna `created_at desc`. Behoud punten, seconden, pogingen en `detail` zonder herberekening. Documenteer alle verworpen duplicaten in een lokaal importlog.

## 5. Controles

Voor import: tel rijen per game en noteer unieke namen, ongeldige datums en duplicaten. Na import:

1. Vergelijk aantallen scores en starts per `game_id` met de Sheet, met een expliciete verklaring voor overgeslagen test- of duplicate rijen.
2. Vergelijk min/max `created_at`, totaalpunten en totale speeltijd van een steekproef spelers.
3. Controleer dat elke score een bestaande speler en spel heeft en dat de unique constraint geen dubbele actieve score toelaat.
4. Meld als testspeler aan, controleer leaderboard, eigen voltooiing, hint en replay.

Gebruik alleen transacties voor een importbatch en maak geen bestaand productiedata leeg.

## Aangeleverd tabblad Spelstarts

Voor de aangeleverde `Spelstarts`-export staat een uitvoerbare stagingmigratie in
`supabase/migrations/005_import_legacy_game_starts.sql`. Laad de CSV eerst in
`private.legacy_game_starts_staging` met de `\\copy`-instructie uit die migratie
en voer daarna het resterende SQL-blok uit. De import slaat de twee testregels
`Bijv. Mark` over, behoudt afzonderlijke startmomenten en verwacht 46 starts voor
`mozaiek`. De migratie maakt voor iedere echte naam een legacy-speler in
`private.players` en koppelt iedere start daaraan. Bij de eerste anonieme
registratie met dezelfde naam neemt die sessie de bestaande voortgang over.
Als je versie 005 al vóór deze wijziging uitvoerde, voer dan ook
`006_relink_legacy_game_starts_to_players.sql` uit.

Wanneer 005 al zonder CSV is uitgevoerd, voer vervolgens
`007_import_staged_legacy_game_starts.sql` uit. Laad daarna de CSV in de
stagingtabel en voer uit: `select private.import_legacy_game_starts_from_staging();`.
De response moet voor de aangeleverde export `{"stagedRows": 46,
"importedStarts": 46}` tonen; een tweede run importeert nul extra starts.
