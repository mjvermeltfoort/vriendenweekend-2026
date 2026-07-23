# Het Verzegelde Dossier – PWA

Statische GitHub Pages-PWA voor Vriendenweekend 2026. De interface en tien spellen blijven gewone HTML/CSS/JavaScript; Supabase levert de anonieme sessies en Postgres/RPC-datalaag. `Code.gs` staat uitsluitend nog als tijdelijke rollbackkopie in deze repository en wordt niet door de frontend geladen.

## Architectuur

- `supabase-api.js` is de enige frontendadapter voor Supabase en bewaakt één anonieme sessie per apparaat.
- De browser gebruikt de officiële Supabase JavaScript v2-browserbuild en alleen de publishable key.
- Tabellen staan in het niet-geëxposeerde schema `private`; clients hebben geen tabelrechten.
- Alleen security-definer RPC's zijn beschikbaar voor geregistreerde anonieme gebruikers. Scores worden server-side berekend en hints verschijnen pas na voltooiing.

De publishable key mag openbaar zijn. Dat is alleen veilig dankzij tabel-grants, RLS en RPC-autorisatie. Zet nooit een service-role key, databasewachtwoord of JWT-secret in GitHub Pages.

## Supabase instellen

1. Maak een Supabase-project.
2. Schakel in **Authentication → Providers → Anonymous** anonieme aanmeldingen in.
3. Voer in de SQL Editor, in volgorde, [`001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql), [`002_seed_games.sql`](supabase/migrations/002_seed_games.sql) en bij een eerder geprobeerd project ook [`003_remove_access_code.sql`](supabase/migrations/003_remove_access_code.sql) en [`004_repair_removed_access_code.sql`](supabase/migrations/004_repair_removed_access_code.sql) uit.
4. Vul Project URL en publishable key in `config.js`; begin eventueel vanuit `config.example.js`.
5. Stel bij **Authentication → URL Configuration** de GitHub Pages-URL (en lokale test-URL) als toegestane redirect/origin in.

De seed heeft bewust geen `open_from`- of `close_at`-waarden: neem die bij de legacy-import uit de bestaande Sheet over, of beheer ze later rechtstreeks in `private.games`.

## Legacydata importeren

Volg het handmatige, niet-destructieve pad in [`supabase/legacy-import.md`](supabase/legacy-import.md). Het document beschrijft CSV-export, kolommapping, Nederlandse datumconversie, deduplicatie en controles per spel. Commit geen exportbestanden met persoonsgegevens.

## Lokaal testen en publiceren

Start in de repository bijvoorbeeld `python3 -m http.server 8080`, open de site via `http://localhost:8080`, registreer een naam en test een open spel. Publiceer daarna de root van de repository met GitHub Pages (branch `main`, map `/ (root)`). De PWA-cache wordt in `service-worker.js` per release verhoogd.

## Rollback

`Code.gs` is een onveranderde legacy-backup. Om tijdelijk terug te draaien, herstel je een eerdere frontendversie die de Apps Script-URL gebruikt en publiceer je die expliciet opnieuw. De huidige frontend bevat geen runtimekoppeling met Apps Script.
