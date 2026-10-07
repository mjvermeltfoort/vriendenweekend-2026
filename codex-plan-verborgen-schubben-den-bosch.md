# Codex-plan: verborgen bonuslocaties voor Het Geheim van de Moerasdraak

## 1. Doel

Breid de bestaande PWA **Het Geheim van de Moerasdraak** uit met zes optionele geheime locaties langs en vlak buiten de hoofdroute.

Deze uitbreiding heet in de spelersinterface:

> **De Verborgen Schubben**

De bonuslocaties:

- zijn zichtbaar op de kaart als mysterieuze bonusmarkeringen;
- zijn geen onderdeel van de zeven verplichte hoofdstukken;
- kunnen in willekeurige volgorde worden bezocht;
- blokkeren de hoofdroute en finale nooit;
- leveren bonuspunten en één unieke Drakenschub op;
- blijven beschikbaar totdat het spel definitief is afgerond;
- werken offline-first;
- hergebruiken de bestaande GPS-, challenge-, score-, opslag- en synchronisatiearchitectuur.

Wie alle zes Drakenschubben vindt, krijgt:

```text
Titel: Schubbenjagers
Verzamelbonus: +300 punten
Resultaatembleem: gouden ring van zes schubben
```

---

## 2. Randvoorwaarden voor Codex

1. Werk verder in de bestaande repository en huidige branch.
2. Begin niet opnieuw.
3. Voer geen brede refactor uit.
4. Hergebruik bestaande:
   - game-data;
   - challenge-renderer;
   - GPS-provider;
   - handmatige locatieverificatie;
   - IndexedDB-opslag;
   - synchronisatiequeue;
   - Supabase-tabellen;
   - kaartcomponent;
   - scorefuncties;
   - resultaatpagina.
5. Bouw geen aparte bonusdatabase wanneer `city_game_progress` en `city_game_events` kunnen worden hergebruikt.
6. Bonusvoortgang mag hoofdvoortgang nooit wijzigen of blokkeren.
7. Een bonus mag maar één keer punten opleveren.
8. Opnieuw openen of synchroniseren mag nooit dubbele punten veroorzaken.
9. Iedere bonuslocatie krijgt naast GPS een observatievraag als fallback.
10. Alle coördinaten hieronder zijn implementatiestartwaarden en moeten fysiek worden gekalibreerd.
11. Laat daarom overal `needsOnSiteVerification: true` staan.
12. TypeScript gebruikt `latitude, longitude`.
13. GeoJSON gebruikt `[longitude, latitude]`.

---

# 3. Alle locaties en geoposities

## 3.1 Verplichte hoofdroute

| Nr. | ID | Locatie | Herkenningspunt | Latitude | Longitude | Radius | Max. accuracy |
|---:|---|---|---|---:|---:|---:|---:|
| 1 | `drakenfontein` | Drakenfontein | Stationsplein | `51.690506` | `5.296208` | 50 m | 100 m |
| 2 | `zoete-lieve-gerritje` | Zoete Lieve Gerritje | Hoek Lepelstraat / Korenbrugstraat | `51.689817` | `5.299926` | 55 m | 110 m |
| 3 | `binnendieze-waterpoort` | Waterpoort / Binnendieze | Herman Moerkerkplein | `51.689641` | `5.305190` | 60 m | 120 m |
| 4 | `huis-van-bosch` | Huis van Bosch | Markt 29 | `51.688968` | `5.304617` | 55 m | 110 m |
| 5 | `sint-jan` | Sint-Janskathedraal | Paradezijde / zuidzijde | `51.687992` | `5.308464` | 75 m | 120 m |
| 6 | `kruithuis` | Kruithuis | Citadellaan 7 | `51.693656` | `5.305112` | 65 m | 120 m |
| 7 | `bossche-brouwers` | Bossche Brouwers | Tramkade 29 | `51.696900` | `5.299290` | 75 m | 120 m |

## 3.2 Optionele bonuslocaties

| Bonus | ID | Locatie | Herkenningspunt | Latitude | Longitude | Radius | Discovery | Max. accuracy | Aanbevolen tussen |
|---:|---|---|---|---:|---:|---:|---:|---:|---|
| B1 | `bonus:bolwerk-sint-jan` | Bolwerk Sint-Jan | Sint-Janssingel / stadsentree | `51.689541` | `5.298851` | 55 m | 120 m | 120 m | Stop 1 en 2 |
| B2 | `bonus:halve-peer` | De Halve Peer | Hoek Molenstraat / Korenbrugstraat | `51.689444` | `5.299722` | 55 m | 120 m | 130 m | Stop 2 en 3 |
| B3 | `bonus:de-moriaan` | De Moriaan | Markt 77 | `51.689615` | `5.303141` | 55 m | 120 m | 120 m | Stop 3 en 4 |
| B4 | `bonus:zwanenbroedershuis` | Zwanenbroedershuis | Hinthamerstraat 94 | `51.688710` | `5.309535` | 60 m | 120 m | 130 m | Stop 5 en 6 |
| B5 | `bonus:citadel` | De Citadel | Citadellaan / Zuid-Willemsvaart | `51.695161` | `5.302865` | 80 m | 140 m | 140 m | Stop 6 en 7 |
| B6 | `bonus:verkadefabriek` | Verkadefabriek | Boschdijkstraat 45 | `51.695626` | `5.297448` | 70 m | 130 m | 130 m | Stop 6 en 7 |

## 3.3 Waarschuwing bij coördinaten

Gebruik de waarden direct voor development en kaartweergave, maar controleer tijdens de fysieke routetest:

- veilige wacht- en kijkpositie;
- juiste zijde van straat of gebouw;
- GPS-afwijking door hoge gevels;
- Android en iPhone;
- zichtbaarheid van het observatiedetail;
- tijdelijke steigers, terrassen en werkzaamheden;
- werkelijke omlooptijd.

Pas pas na goedkeuring aan:

```ts
needsOnSiteVerification: false
```

---

# 4. Spelregels

## 4.1 Introductie

Na de Drakenfontein verschijnt eenmaal:

> Niet alle herinneringen liggen op de hoofdroute.  
> In de stad zijn zes verborgen Drakenschubben achtergebleven.  
> Ze zijn niet nodig om het avontuur te voltooien, maar oplettende teams kunnen er extra punten mee verdienen.

Knop:

```text
BEKIJK DE VERBORGEN SCHUBBEN
```

## 4.2 Bonuslocaties veranderen de hoofdroute niet

Een bonus:

- telt niet mee in `7 / 7 opdrachten`;
- wijzigt `currentStopId` niet;
- ontgrendelt geen hoofdstop;
- is niet vereist voor de finale;
- kan worden overgeslagen;
- kan tijdelijk als navigatiedoel worden gekozen;
- blijft beschikbaar tot `game_completed`.

## 4.3 Beloningen

| Bonus | Reward | Maximum |
|---|---|---:|
| Bolwerk Sint-Jan | Poortschub | 100 |
| De Halve Peer | Narrenschub | 200 |
| De Moriaan | Steenschub | 150 |
| Zwanenbroedershuis | Veerschub | 150 |
| De Citadel | Wachterschub | 250 |
| Verkadefabriek | Machineschub | 250 |
| Alle zes | Schubbenjagers-bonus | 300 |
| **Totaal** |  | **1.400** |

## 4.4 Punten per poging

```text
Eerste correcte poging: 100%
Tweede poging: 75%
Derde of latere poging: 50%
Minstens één hint gebruikt: maximaal 50%
Minimum na voltooiing: 50 punten
```

Een fout antwoord verlaagt alleen de bonus van die locatie en trekt niets af van de hoofdscore.

Gebruik één pure functie:

```ts
calculateBonusScore({
  maximumPoints,
  attempts,
  hintsUsed,
}): number
```

Voorgestelde implementatie:

```ts
const attemptFactor =
  attempts <= 1 ? 1 :
  attempts === 2 ? 0.75 :
  0.5;

const hintFactor = hintsUsed > 0 ? 0.5 : 1;

return Math.max(
  50,
  Math.round(maximumPoints * Math.min(attemptFactor, hintFactor))
);
```

---

# 5. Kaartweergave

## 5.1 Visueel verschil

Hoofdstops:

- groot rond medaillon;
- genummerd;
- verbonden met hoofdroute.

Bonuslocaties:

- kleinere zeshoek of schubvorm;
- geen nummer;
- geen verbinding met hoofdroute;
- goudgroene barst of vraagteken.

## 5.2 Staten

```ts
type BonusMapState =
  | 'hidden'
  | 'nearby'
  | 'selected'
  | 'arrived'
  | 'completed';
```

### Hidden

- donkere rune;
- dunne gouden contour;
- vraagteken;
- locatienaam verborgen.

### Nearby

Binnen `discoveryRadiusMeters`:

- rustige goudgroene puls;
- half geopend drakenoog;
- melding: `Er is een verborgen spoor in de buurt.`

### Selected

- sterkere gouden rand;
- gestippelde lijn vanaf speler;
- actie `Terug naar hoofdroute`.

### Arrived

- open drakenoog;
- `Geheime locatie gevonden`;
- knop `Open bonusopdracht`.

### Completed

- gouden schub;
- vinkje;
- echte locatienaam en score zichtbaar.

## 5.3 Bottom sheet vóór ontdekking

```text
VERBORGEN VONDST

[cryptische aanwijzing]

Afstand: 180 meter
Geschatte omweg: 5 minuten
Maximum: 200 bonuspunten

[ MAAK DIT MIJN DOEL ]
```

Toon vóór voltooiing niet:

- echte titel;
- volledige historische uitleg;
- rewardnaam;
- antwoord.

## 5.4 Tijdelijk doel

Voeg toe:

```ts
selectedBonusLocationId?: string;
```

Selecteren:

- verandert de hoofdstop niet;
- bewaart eerstvolgende hoofdstop;
- tekent tijdelijke stippellijn;
- toont afstand;
- biedt `Terug naar hoofdroute`.

---

# 6. Datamodel

## 6.1 Type

```ts
export interface BonusLocation {
  id: `bonus:${string}`;
  slug: string;
  title: string;
  hiddenClue: string;
  revealedDescription: string;

  coordinates: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    discoveryRadiusMeters: number;
    maximumAccuracyMeters: number;
    needsOnSiteVerification: boolean;
  };

  recommendedBetween: {
    afterStopId: string;
    beforeStopId: string;
  };

  estimatedDetourMinutes: number;
  maximumPoints: number;

  challenge: ChallengeConfig;
  hints: HintConfig[];

  reward: {
    id: string;
    title: string;
    icon: string;
    resultLabel: string;
  };

  manualVerification: ManualVerificationConfig;

  assets?: {
    image?: string;
    audio?: string;
    transcript?: string;
  };
}
```

## 6.2 Gamepack

```ts
export interface GamePack {
  // bestaande velden
  stops: RouteStop[];
  bonusLocations?: BonusLocation[];
  bonusCompletionReward?: {
    requiredCount: number;
    points: number;
    title: string;
    badge: string;
  };
}
```

## 6.3 Progressie

Gebruik bestaande `city_game_progress` met ids:

```text
bonus:bolwerk-sint-jan
bonus:halve-peer
bonus:de-moriaan
bonus:zwanenbroedershuis
bonus:citadel
bonus:verkadefabriek
```

Voorbeeldmetadata:

```json
{
  "progressType": "bonus",
  "rewardId": "poortschub",
  "maximumPoints": 100
}
```

Lokale status:

```ts
interface BonusProgress {
  bonusLocationId: string;
  state:
    | 'available'
    | 'discovered'
    | 'arrived'
    | 'started'
    | 'completed';
  attempts: number;
  hintsUsed: number;
  scoreAwarded: number;
  unlockMethod?: 'gps' | 'manual';
  discoveredAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  rewardCollected?: boolean;
}
```

Status mag bij sync nooit teruglopen.

---

# 7. Events en synchronisatie

Gebruik:

```text
bonus_discovered
bonus_selected
bonus_unlocked
bonus_started
bonus_answered
bonus_hint_used
bonus_completed
bonus_collection_completed
```

## Idempotentie

Opnieuw verwerken mag niet:

- score opnieuw optellen;
- reward opnieuw toevoegen;
- verzamelbonus opnieuw toekennen;
- completiondatum overschrijven;
- attempts dubbel ophogen.

Iedere actie:

1. lokaal opslaan;
2. UI direct bijwerken;
3. queue-item toevoegen;
4. later synchroniseren.

Gebruik bestaande tabellen:

- `city_game_progress`;
- `city_game_events`;
- `city_game_teams`.

Voeg geen aparte tabel toe tenzij de bestaande architectuur dit aantoonbaar niet aankan.

---

# 8. GPS en ontdekking

Iedere bonus heeft twee afstanden:

```ts
discoveryRadiusMeters
radiusMeters
```

Binnen discovery radius:

- marker pulseert;
- opdracht blijft vergrendeld.

Binnen unlock radius én voldoende accuracy:

```text
distance <= radiusMeters
AND
accuracy <= maximumAccuracyMeters
```

dan opent de bonus.

Bij slechte accuracy:

- toon gemeten nauwkeurigheid;
- laat opnieuw proberen;
- bied observatiecontrole;
- blokkeer niet permanent.

Gebruik geen continue achtergrondtracking. Controleer omgeving bij:

- openen routepagina;
- knop `Controleer mijn omgeving`;
- bestaande tijdelijke locatie-update;
- opnieuw zichtbaar worden van de app, alleen wanneer dit al past in de huidige architectuur.

Sla geen GPS-routegeschiedenis op.

---

# 9. Bonuslocaties uitgewerkt

## B1 — Bolwerk Sint-Jan: De Verloren Poort

**Coördinaten:** `51.689541, 5.298851`  
**Radius:** 55 m  
**Discovery:** 120 m  
**Tussen:** Drakenfontein en Zoete Lieve Gerritje  
**Omweg:** circa 3 minuten  
**Maximum:** 100  
**Reward:** Poortschub

Cryptische aanwijzing:

> Waar oud steenwerk een roestkleurig pantser draagt.

Opdracht, type `choice`:

> Welke twee materialen ontmoeten elkaar hier het duidelijkst?

1. Baksteen en roestkleurig staal
2. Hout en natuursteen
3. Beton en koper
4. Glas en marmer

Correct:

```text
Baksteen en roestkleurig staal
```

Succes:

> De oude poort is verdwenen, maar haar verdediging leeft voort.  
> Jullie vinden de **Poortschub**.

---

## B2 — De Halve Peer: De Ontbrekende Helft

**Coördinaten:** `51.689444, 5.299722`  
**Radius:** 55 m  
**Discovery:** 120 m  
**Tussen:** Zoete Lieve Gerritje en Waterpoort  
**Omweg:** circa 5 minuten  
**Maximum:** 200  
**Reward:** Narrenschub

Cryptische aanwijzing:

> Zoek een belangrijk man die maar voor de helft aanwezig is.

MVP-opdracht, type `choice`:

> Waar bevindt de afgebeelde helft zich?

1. Op een brugleuning
2. Tegen een gevel boven de Binnendieze
3. Op een sokkel op straat
4. Boven op een stadspoort

Correct:

```text
Tegen een gevel boven de Binnendieze
```

Latere variant:

- vier silhouethelften;
- drie overtuigende foute;
- één passende helft;
- pas activeren na een goede frontale referentiefoto.

Succes:

> In Oeteldonk is een halve oplossing soms precies genoeg.  
> Jullie vinden de **Narrenschub**.

---

## B3 — De Moriaan: Het Huis dat Bleef Staan

**Coördinaten:** `51.689615, 5.303141`  
**Radius:** 55 m  
**Discovery:** 120 m  
**Tussen:** Waterpoort en Huis van Bosch  
**Omweg:** circa 5 minuten  
**Maximum:** 150  
**Reward:** Steenschub

Cryptische aanwijzing:

> Vind het stenen huis dat aan de slopershamer ontsnapte.

Opdracht:

> Welke combinatie herken je aan dit gebouw?

1. Trapgevel, rond hoektorentje en spitsboogdetails
2. Glazen gevel, plat dak en metalen balkon
3. Houten topgevel, klokkentoren en zuilen
4. Witte lijstgevel, koepel en arcade

Correct:

```text
Trapgevel, rond hoektorentje en spitsboogdetails
```

Bouw de UI zo dat tekstopties later door gevelsilhouetten vervangen kunnen worden.

Succes:

> Steen onthoudt wat mensen bijna verloren lieten gaan.  
> Jullie vinden de **Steenschub**.

---

## B4 — Zwanenbroedershuis: De Wachter op de Gevel

**Coördinaten:** `51.688710, 5.309535`  
**Radius:** 60 m  
**Discovery:** 120 m  
**Tussen:** Sint-Jan en Kruithuis  
**Omweg:** circa 4 minuten  
**Maximum:** 150  
**Reward:** Veerschub

Cryptische aanwijzing:

> Een vogel bewaakt een huis dat ouder is dan zijn gevel.

Opdracht:

> Welk dier staat helemaal boven op de gevel?

1. Adelaar
2. Zwaan
3. Ooievaar
4. Raaf

Correct:

```text
Zwaan
```

Succes:

> De zwaan ziet wat beneden vaak onopgemerkt blijft.  
> Jullie vinden de **Veerschub**.

---

## B5 — De Citadel: De Papenbril

**Coördinaten:** `51.695161, 5.302865`  
**Radius:** 80 m  
**Discovery:** 140 m  
**Tussen:** Kruithuis en Bossche Brouwers  
**Omweg:** circa 6 minuten  
**Maximum:** 250  
**Reward:** Wachterschub

Cryptische aanwijzing:

> Zoek de bril waardoor de machthebbers de stad bekeken.

Observatievraag voor MVP:

> Wat maakt de toegang nog steeds vestingachtig?

Tijdelijke opties, fysiek controleren:

1. Een hoge muur en poort
2. Een glazen draaideur
3. Een houten ophaalbrug
4. Een vrijstaande klokkentoren

Extra minigame:

- twee draaibare lenzen;
- iedere lens bevat een half patroon;
- juiste stand vormt een vijfpuntige vestingvorm;
- SVG of CSS, geen canvas nodig;
- knoppenalternatief voor slepen;
- resetknop;
- toetsenbordbediening.

Succes:

> De bril keek niet alleen naar de vijand, maar ook naar de stad zelf.  
> Jullie vinden de **Wachterschub**.

---

## B6 — Verkadefabriek: Van Koek naar Cultuur

**Coördinaten:** `51.695626, 5.297448`  
**Radius:** 70 m  
**Discovery:** 130 m  
**Tussen:** Kruithuis en Bossche Brouwers  
**Omweg:** circa 8 minuten  
**Maximum:** 250  
**Reward:** Machineschub

Cryptische aanwijzing:

> Waar machines iets knapperigs maakten, worden nu verhalen vertoond.

Opdracht, type `reorder`:

1. Koekjes- en biscuitfabriek
2. Leegstand / einde productie
3. Theater en film

Correcte volgorde:

```ts
[
  'Koekjes- en biscuitfabriek',
  'Leegstand / einde productie',
  'Theater en film',
]
```

Succes:

> Een gebouw hoeft niet te verdwijnen om een nieuw verhaal te beginnen.  
> Jullie vinden de **Machineschub**.

---

# 10. Configuratiebestand

Maak:

```text
src/game-data/moerasdraak/bonusLocations.ts
```

Exporteer:

```ts
export const bonusLocations: BonusLocation[] = [
  // B1 t/m B6
];
```

Voeg dit centraal toe aan het bestaande gamepack. Verspreid bonusdata niet over React-componenten.

---

# 11. Resultaatpagina

Toon:

```text
Hoofdopdrachten: 7 / 7
Verborgen schubben: 4 / 6
Bonuspunten: 700
```

Rond het draakembleem:

- gevonden schub: goud gevuld;
- niet gevonden: donkere contour;
- tekstueel altijd `x / 6`.

Bij zes:

```text
SCHUBBENJAGERS

Jullie vonden alle verborgen sporen van de Moerasdraak.
+300 verzamelbonus
```

Neem in canvas/resultaatexport op:

- aantal schubben;
- bonuspunten;
- badge;
- zes schubsymbolen.

Behoud de bestaande exportarchitectuur.

---

# 12. Offline en assets

Bonusdata en eenvoudige SVG-iconen zitten in de appbundle.

Cache:

- bonusdata;
- schubiconen;
- afbeeldingen;
- audio indien aanwezig;
- bonuskaartmarkers.

Bij ontbrekende afbeelding:

- SVG-placeholder;
- opdracht blijft speelbaar.

Voeg bonusassets toe aan het bestaande route-assetmanifest.

---

# 13. Developmenttools

Breid de bestaande GPS-simulator uit met:

```text
Type locatie:
- Hoofdstop
- Bonuslocatie
```

Per bonus:

- exact op locatie;
- binnen discovery radius;
- buiten unlock radius;
- slechte accuracy;
- permission denied;
- timeout;
- manual unlock.

Development-only acties:

- ontdek bonus;
- ontgrendel bonus;
- voltooi bonus;
- reset bonus;
- voltooi alle bonussen.

Nooit beschikbaar in productie.

---

# 14. Game-data-validatie

Controleer:

1. id begint met `bonus:`;
2. ids en slugs zijn uniek;
3. latitude tussen -90 en 90;
4. longitude tussen -180 en 180;
5. radius positief;
6. discovery radius >= unlock radius;
7. maximum accuracy positief;
8. aanbevolen hoofdstop-id’s bestaan;
9. maximumPoints positief;
10. reward-id uniek;
11. challenge geldig;
12. manual verification bestaat;
13. coördinaten met `needsOnSiteVerification: false` zijn geen placeholders;
14. verzamelbonus past bij aantal bonussen.

---

# 15. Tests

## Unit

- bonus-score eerste, tweede en derde poging;
- hintlimiet;
- minimumpunten;
- verzamelscore exact één keer;
- status loopt niet terug;
- completion idempotent;
- rewardset verwijdert duplicaten;
- game-data-validatie;
- discovery radius;
- unlock radius;
- geselecteerde bonus verandert hoofdstop niet.

## Component

- hidden marker;
- nearby marker;
- selected marker;
- completed marker;
- bottom sheet;
- GPS-fout;
- handmatige verificatie;
- fout en correct antwoord;
- reward;
- resultaat 0/6 en 6/6;
- bonusintro eenmaal.

## Integratie

1. team starten;
2. hoofdstop 1 voltooien;
3. Bolwerk selecteren;
4. handmatig ontgrendelen;
5. opdracht voltooien;
6. hoofdroute hervatten;
7. app sluiten;
8. app openen;
9. bonus blijft voltooid;
10. score klopt;
11. event synchroniseert;
12. geen dubbele punten.

## Playwright MCP

- alle bonusmarkers;
- visueel verschil met hoofdstops;
- bonus selecteren;
- terug naar hoofdroute;
- nearby;
- GPS unlock;
- manual unlock;
- bonusopdracht;
- resultaat;
- 320 px;
- toetsenbord;
- hoogcontrastmodus;
- offline kaartfallback.

---

# 16. Toegankelijkheid

- Bonusmarker heeft toegankelijke naam.
- Status niet alleen via kleur.
- Kaart heeft equivalente lijstweergave.
- Bonuslijst toont aanwijzing, afstand, status en punten.
- Drag-and-drop heeft knoppenalternatief.
- Puls respecteert `prefers-reduced-motion`.
- Touch targets minimaal 44 × 44 px.
- Hoofdknoppen minimaal 48 px.
- Dialogfocus werkt.
- Resultaat vermeldt schubben tekstueel.

---

# 17. Privacy en veiligheid

- Geen GPS-routegeschiedenis.
- Geen continue achtergrondtracking.
- Geen privéterrein.
- Geen aankoop vereist.
- Geen drukke rijbaan oversteken voor observatie.
- Routehint beschrijft een veilige kijkpositie.
- Fysieke routetest verplicht vóór publieke inzet.

---

# 18. Fysieke routetest

Maak:

```text
docs/bonus-route-field-test.md
```

Gebruik:

| Locatie | GPS Android | GPS iPhone | Accuracy | Radius goed | Veilige positie | Detail zichtbaar | Vraag eenduidig | Omweg | Avond | Goedgekeurd |
|---|---|---|---:|---|---|---|---|---:|---|---|

Per locatie:

- minstens twee GPS-metingen per toestel;
- beide zijden van straat waar relevant;
- veilige stilstand;
- rolstoeltoegankelijkheid;
- verlichting;
- tijdelijke objecten;
- object vanaf openbaar terrein zichtbaar;
- antwoord eenduidig;
- echte omlooptijd.

---

# 19. Implementatievolgorde

1. huidige game-data en kaartarchitectuur inspecteren;
2. `BonusLocation`-types;
3. gamepack uitbreiden;
4. zes configuraties;
5. validatie;
6. lokale progressie;
7. scorefunctie;
8. kaartmarkers;
9. bottom sheet;
10. tijdelijk navigatiedoel;
11. GPS discovery en unlock;
12. handmatige verificatie;
13. challengeflow;
14. rewards;
15. sync/events;
16. resultaat;
17. canvasexport;
18. offline assetmanifest;
19. devtools;
20. tests;
21. documentatie;
22. lint, test, typecheck en build.

---

# 20. Definition of Done

1. Alle zes bonuslocaties staan in game-data.
2. Alle dertien locaties hebben een geopositie.
3. Bonusmarkers verschillen visueel van hoofdstops.
4. Bonussen zijn niet verbonden met de hoofdroute.
5. Bonus tijdelijk als doel kiezen werkt.
6. Terug naar hoofdroute werkt.
7. Hoofdstop verandert niet.
8. Discovery radius werkt.
9. GPS unlock werkt.
10. Manual unlock werkt.
11. Alle bonusopdrachten werken.
12. Score centraal berekend.
13. Hoofdscore wordt niet verlaagd.
14. Iedere bonus geeft exact één keer punten.
15. Verzamelbonus exact één keer.
16. Lokaal opgeslagen.
17. Synchroniseert.
18. Sync idempotent.
19. Offline speelbaar.
20. Resultaat toont schubben en bonuspunten.
21. Export toont schubben.
22. GPS-simulator ondersteunt bonussen.
23. Game-data-validatie uitgebreid.
24. Kaart heeft lijstweergave.
25. Intro verschijnt eenmaal.
26. Toetsenbord werkt.
27. Reduced motion werkt.
28. 320 px werkt.
29. Hoofdroute blijft intact.
30. Finale blijft onafhankelijk.
31. Lint slaagt.
32. Tests slagen.
33. Typecheck slaagt.
34. Build slaagt.
35. Documentatie klopt.

---

# 21. Niet uitvoeren

- aparte bonusdatabase;
- realtime multiplayer;
- achtergrondtracking;
- betalingen;
- verplichte QR-codes;
- camera-herkenning;
- nieuwe kaartprovider;
- runtime routeberekening;
- pushnotificaties;
- verplichte bonussen voor finale;
- zware animatiebibliotheek;
- nieuwe challenge-engine.

---

# 22. Eindrapportage Codex

## Afgerond

Maximaal vijftien bullets.

## Bonuslocaties

Tabel met locatie, coördinaten, opdracht, punten en status.

## Kaart en GPS

Markers, discovery, unlock en fallback.

## Score en synchronisatie

Idempotentie, offline-first en verzamelbonus.

## Tests

Lint, tests met aantal, typecheck en build.

## Alleen nog fysiek nodig

Uitsluitend:

- GPS kalibreren;
- veilige kijkpositie controleren;
- observatievragen controleren;
- extra looptijd meten;
- definitieve foto-assets.

Zet hier geen onafgerond programmeerwerk onder.

---

# 23. Bronnen voor inhoudelijke controle

- Bolwerk Sint-Jan:  
  https://www.zuiderwaterlinie.nl/vestingsteden/gemeentelijke-monumenten/bolwerk-sint-jan
- De Halve Peer:  
  https://www.bossche-encyclopedie.nl/overig/beelden/de%20halve%20peer.htm
- De Moriaan:  
  https://www.erfgoedshertogenbosch.nl/verhalen/de-moriaan
- Zwanenbroedershuis:  
  https://www.erfgoedshertogenbosch.nl/verhalen/zwanenbroedershuis
- Adres Zwanenbroedershuis:  
  https://leden.zwanenbroedershuis.nl/bezoekersinformatie/
- Citadel / Papenbril:  
  https://www.bossche-encyclopedie.nl/
- Verkadefabriek:  
  https://www.verkadefabriek.nl/
- Bossche Brouwers:  
  https://bosschebrouwers.nl/

Controleer historische formuleringen, vragen en geoposities tijdens de fysieke routecontrole.
