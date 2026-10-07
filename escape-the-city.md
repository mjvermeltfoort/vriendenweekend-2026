# Codex-opdracht: PWA-stadsspel “Het Geheim van de Moerasdraak”

## 1. Rol en werkwijze

Je bent verantwoordelijk voor het ontwerpen en implementeren van een mobiele Progressive Web App voor een Escape the City-spel in Den Bosch.

De app krijgt de werktitel:

**Het Geheim van de Moerasdraak**

Voorgestelde repositorynaam:

```text
escape-the-city-den-bosch
```

Voorgesteld domein:

```text
denbosch.markvermeltfoort.nl
```

De app moet technisch geïnspireerd zijn op de bestaande React-PWA van het project:

```text
vriendenweekend-2026
```

Gebruik de bestaande vriendenweekend-repository uitsluitend als technische referentie. De nieuwe stadsspel-app moet een zelfstandige applicatie worden met:

* een eigen repository;
* een eigen packageconfiguratie;
* een eigen manifest;
* een eigen service worker;
* een eigen cache;
* een eigen deployment;
* eigen Supabase-tabellen of duidelijk afgescheiden tabellen;
* een eigen domein of subdomein.

Wijzig de bestaande vriendenweekend-app niet, tenzij daar expliciet afzonderlijk opdracht voor wordt gegeven.

---

# 2. Belangrijke instructies voor efficiënt tokengebruik

Ga zeer zuinig om met tokens en context.

## 2.1 Onderzoek alleen relevante bestanden

Bekijk bij aanvang alleen:

* `package.json`;
* `vite.config.*`;
* de hoofdmappen onder `src`;
* routerconfiguratie;
* PWA-configuratie;
* `manifest.json` of `manifest.webmanifest`;
* service-workerconfiguratie;
* Supabase-client;
* Supabase-migraties;
* relevante componenten voor:

  * spelvoortgang;
  * scores;
  * modals;
  * mobiele navigatie;
  * lokale opslag;
  * installatie van de PWA;
* de README.

Gebruik gerichte zoekopdrachten zoals:

```bash
find
rg
grep
sed
```

Dump nooit zonder reden volledige grote bestanden of de gehele repository in de context.

## 2.2 Vermijd herhaling

* Lees een bestand niet opnieuw wanneer er niets aan is veranderd.
* Herhaal geen eerdere analyse.
* Geef geen lange uitleg na iedere kleine wijziging.
* Houd één centrale takenlijst bij.
* Werk bestanden in logische groepen af.
* Beschrijf alleen beslissingen die gevolgen hebben voor de architectuur of functionaliteit.

## 2.3 Voorkom onnodige wijzigingen

* Voer geen brede refactor uit.
* Converteer bestaande JavaScript-bestanden niet automatisch naar TypeScript.
* Herschrijf geen complete componenten wanneer een kleine aanpassing voldoende is.
* Voeg geen bibliotheken toe wanneer browser-API’s of bestaande dependencies voldoende zijn.
* Verander geen formattering in bestanden die functioneel niet gewijzigd hoeven te worden.
* Vervang geen werkende componenten puur vanwege persoonlijke voorkeur.
* Maak geen uitgebreid design system.
* Voeg geen kaartendienst, betaalde API of zware kaartbibliotheek toe.
* Voeg geen derdepartij-analytics toe.
* Implementeer geen native app, Capacitor of React Native.

## 2.4 Gebruik bestaande patronen

Wanneer de vriendenweekend-app al goede oplossingen bevat voor bijvoorbeeld:

* Supabase;
* PWA-installatie;
* modals;
* mobiele layout;
* scoreopslag;
* foutmeldingen;
* loading states;
* offline opslag;

neem dan het patroon over, maar kopieer alleen de minimaal noodzakelijke code.

Verwijder alle vriendenweekend-specifieke namen, data, routes en stijlen uit gekopieerde onderdelen.

## 2.5 Beperk communicatie

Voer eerst een korte analyse uit met maximaal:

* 12 bevindingen;
* 10 implementatiestappen;
* 5 risico’s.

Begin daarna direct met implementeren, tenzij er een echte blokkade bestaat.

Stel geen vragen over details die veilig als configureerbare waarde of placeholder kunnen worden geïmplementeerd.

Vraag alleen om verduidelijking wanneer:

* een destructieve databasewijziging nodig is;
* bestaande productiegegevens verloren kunnen gaan;
* toegangscodes of credentials absoluut noodzakelijk zijn;
* twee eisen elkaar rechtstreeks tegenspreken.

Ontbrekende afbeeldingen, audiofragmenten en GPS-coördinaten zijn geen blokkade. Maak daarvoor nette placeholders en documenteer hoe ze vervangen kunnen worden.

---

# 3. Hoofddoel

Bouw een mobiele PWA waarmee een team een Escape the City-route door Den Bosch kan spelen.

De route:

* begint bij station Den Bosch of de Drakenfontein;
* loopt door de historische binnenstad;
* bevat opdrachten die gekoppeld zijn aan echte locaties;
* gebruikt GPS als ondersteuning;
* gebruikt ingesproken geluidsfragmenten;
* werkt zoveel mogelijk offline;
* slaat voortgang lokaal op;
* synchroniseert voortgang met Supabase;
* eindigt bij Bossche Brouwers;
* kan later worden uitgebreid met andere steden en routes.

De telefoon vertelt het verhaal, maar de antwoorden moeten zoveel mogelijk in de fysieke omgeving gevonden worden.

---

# 4. MVP-afbakening

## 4.1 Wel implementeren

Implementeer in de eerste versie:

* mobiele React-PWA;
* TypeScript wanneer dit een nieuw project is;
* Vite;
* eenvoudige routering;
* team aanmaken;
* team hervatten;
* optionele teamcode;
* routeoverzicht;
* zeven routepunten;
* GPS-controle per routepunt;
* handmatige noodontgrendeling;
* audio met transcript;
* vier herbruikbare opdrachtsoorten;
* hints;
* foutieve pogingen;
* puntenberekening;
* lokaal opslaan van voortgang;
* synchronisatie met Supabase;
* offline routepakket;
* eindopdracht bij Bossche Brouwers;
* eindscore;
* deelbaar digitaal resultaat;
* installatiemogelijkheid als PWA;
* devtool voor het simuleren van locaties;
* basisdocumentatie;
* geautomatiseerde tests voor kritieke logica.

## 4.2 Niet implementeren in de eerste versie

Implementeer voorlopig niet:

* een uitgebreide CMS-beheeromgeving;
* live multiplayer;
* chat;
* continue GPS-tracking;
* turn-by-turn navigatie;
* Google Maps-integratie;
* Mapbox;
* pushnotificaties;
* betalingen;
* reserveringen bij Bossche Brouwers;
* automatisch gegenereerde stemopnames;
* zeven volledig unieke complexe minigames;
* publieke wereldwijde leaderboards;
* social login voor spelers;
* native mobiele app;
* camera-herkenning;
* QR-scanning als verplichte spelstap;
* AR-functionaliteit.

Maak de architectuur wel geschikt om deze onderdelen later toe te voegen.

---

# 5. Technische basis

Gebruik bij voorkeur:

```text
React
TypeScript
Vite
Supabase
CSS Modules, gewone CSS of de bestaande stylingaanpak
vite-plugin-pwa
IndexedDB
Vitest
```

Gebruik geen zware state-managementbibliotheek wanneer React Context en hooks voldoende zijn.

Voeg alleen een IndexedDB-bibliotheek zoals Dexie toe wanneer dit aantoonbaar veel eenvoudiger en betrouwbaarder is dan een kleine eigen wrapper.

Gebruik voor GitHub Pages bij voorkeur een eenvoudige routeringsoplossing die geen serverconfiguratie vereist. Een `HashRouter` is voor het MVP toegestaan en voorkomt problemen met directe URL’s op GitHub Pages.

Wanneer de app op een hostingplatform met SPA-fallback wordt geplaatst, mag later naar `BrowserRouter` worden overgestapt.

---

# 6. Voorgestelde projectstructuur

Gebruik een duidelijke maar niet overdreven fijnmazige structuur:

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx

  components/
    AppHeader/
    BottomNavigation/
    Button/
    Card/
    Dialog/
    ErrorMessage/
    LoadingState/
    ProgressBar/

  features/
    audio/
      AudioPlayer.tsx
      useAudio.ts

    game/
      GameProvider.tsx
      gameReducer.ts
      gameTypes.ts
      scoring.ts

    location/
      LocationCheck.tsx
      geolocation.ts
      distance.ts
      useGeolocation.ts

    offline/
      offlinePack.ts
      syncQueue.ts
      storage.ts

    pwa/
      InstallPrompt.tsx
      UpdatePrompt.tsx
      pwaUtils.ts

    challenges/
      ChallengeRenderer.tsx
      challengeTypes.ts
      ChoiceChallenge.tsx
      CodeChallenge.tsx
      ReorderChallenge.tsx
      CompositeSelectChallenge.tsx

    teams/
      CreateTeam.tsx
      JoinTeam.tsx
      ResumeTeam.tsx

  game-data/
    moerasdraak/
      game.ts
      stops.ts
      strings.ts

  lib/
    supabase/
      client.ts
      teams.ts
      progress.ts
      events.ts

  pages/
    HomePage.tsx
    TeamPage.tsx
    PreparationPage.tsx
    RoutePage.tsx
    StopPage.tsx
    ChallengePage.tsx
    ResultPage.tsx
    SettingsPage.tsx

  styles/
    tokens.css
    global.css

public/
  audio/
  images/
  icons/
  manifest.webmanifest

supabase/
  migrations/
  seed/

docs/
  route-content.md
  audio-assets.md
  gps-calibration.md
  deployment.md
  test-checklist.md
```

Pas deze structuur alleen aan wanneer de bestaande vriendenweekend-app een aantoonbaar eenvoudiger en al goed werkend patroon heeft.

---

# 7. Data-gedreven spelopbouw

Maak de route-inhoud data-gedreven.

Plaats de spelinhoud voor het MVP in versiebeheer, niet in een uitgebreid CMS. Hierdoor:

* werkt de route beter offline;
* is er minder databasecomplexiteit;
* zijn wijzigingen controleerbaar via Git;
* zijn minder API-calls nodig;
* kan later alsnog een beheeromgeving worden toegevoegd.

Gebruik een model in deze richting:

```ts
export interface GamePack {
  slug: string;
  version: number;
  title: string;
  subtitle: string;
  city: string;
  estimatedDurationMinutes: number;
  estimatedDistanceKm: number;
  startStopId: string;
  finalStopId: string;
  stops: RouteStop[];
  scoring: ScoringConfig;
}

export interface RouteStop {
  id: string;
  order: number;
  slug: string;
  title: string;
  shortTitle: string;
  locationName: string;

  coordinates: {
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number;
    maximumAccuracyMeters: number;
    needsOnSiteVerification: boolean;
  };

  intro: {
    title: string;
    text: string;
    audioSrc?: string;
    transcript?: string;
  };

  navigation: {
    clue: string;
    fallbackDirections?: string;
    externalMapsQuery?: string;
  };

  challenge: ChallengeConfig;

  hints: HintConfig[];

  reward: {
    title: string;
    text: string;
    symbol: string;
  };

  isFinal?: boolean;
}
```

Gebruik een discriminated union voor opdrachten:

```ts
export type ChallengeConfig =
  | ChoiceChallengeConfig
  | CodeChallengeConfig
  | ReorderChallengeConfig
  | CompositeSelectChallengeConfig;
```

Bewaar route-inhoud, zichtbare teksten en antwoorden niet verspreid door React-componenten.

---

# 8. Opdrachtsoorten voor het MVP

Implementeer maximaal vier generieke opdrachtsoorten.

## 8.1 Keuzeopdracht

Voor observatie, getuigenverklaringen en deductie.

Ondersteun:

* één goed antwoord;
* meerdere antwoordmogelijkheden;
* uitleg na een goed antwoord;
* foutmelding na een verkeerd antwoord;
* optioneel meerdere correcte antwoorden;
* antwoordvolgorde willekeurig of vast.

## 8.2 Codeopdracht

Voor:

* cijfers;
* letters;
* korte woorden;
* audiocodes;
* codes die ter plaatse gevonden worden.

Ondersteun:

* automatische hoofdletterconversie;
* trimmen van spaties;
* normalisatie van accenten;
* configureerbare invoerlengte;
* numeriek of alfanumeriek toetsenbord;
* meerdere toegestane schrijfwijzen;
* duidelijke foutfeedback.

## 8.3 Volgordeopdracht

Voor:

* historische gebeurtenissen;
* routeonderdelen;
* stappen van het brouwproces;
* waterstromen;
* aanwijzingen op chronologische volgorde.

Ondersteun mobiel slepen, maar bied ook knoppen “omhoog” en “omlaag” voor toegankelijkheid.

## 8.4 Samengestelde selectie

Voor bijvoorbeeld het samenstellen van een Bosch-achtig fantasiewezen of het combineren van drie kenmerken.

Ondersteun:

* meerdere categorieën;
* één keuze per categorie;
* afbeelding of tekst;
* een gegenereerde samenvatting van de keuzes;
* hergebruik van de gekozen combinatie in het eindresultaat.

## 8.5 Geen zeven maatwerkspellen

Bouw niet direct voor iedere locatie een volledig aparte minigame.

Gebruik eerst de vier generieke opdrachtsoorten voor alle zeven locaties.

Voeg alleen één kleine unieke interactieve opdracht toe wanneer:

* de vier basistypen volledig werken;
* de tests slagen;
* de PWA correct installeert;
* offline spelen werkt;
* dit zonder grote architectuurwijziging kan.

---

# 9. Route en inhoud

Maak een eerste routepakket met zeven stops.

De teksten mogen als goed herkenbare conceptteksten worden opgenomen. Houd alle inhoud eenvoudig aanpasbaar.

## Stop 1: Drakenfontein

**Functie:** start van het verhaal.

**Thema:** de Moerasdraak is ontwaakt en zeven herinneringen zijn uit de stad verdwenen.

**Opdrachtsoort:** keuzeopdracht of codeopdracht.

**Beloning:** Vuur.

De app moet hier:

* het verhaal introduceren;
* uitleggen hoe GPS werkt;
* de eerste locatiecontrole uitvoeren;
* het team leren hoe hints en punten werken.

## Stop 2: Zoete Lieve Gerritje

**Thema:** verschillende getuigen vertellen tegenstrijdige verhalen.

**Opdrachtsoort:** keuzeopdracht.

Spelers bepalen welke getuigenverklaring niet kan kloppen op basis van een detail dat ter plaatse zichtbaar is.

**Beloning:** Legende of Twijfel.

## Stop 3: Binnendieze

**Thema:** verborgen waterstromen onder en tussen de gebouwen.

**Opdrachtsoort:** volgordeopdracht.

Spelers zetten delen van een waterroute in de juiste volgorde.

**Beloning:** Water.

## Stop 4: Markt en Jheronimus Bosch

**Thema:** geveldetails worden onderdelen van een vreemd fantasiewezen.

**Opdrachtsoort:** samengestelde selectie.

De speler kiest bijvoorbeeld:

* een hoofd;
* een lichaam;
* een voorwerp.

Bewaar deze combinatie in de teamvoortgang en toon het wezen opnieuw bij de eindscore.

Gebruik geen auteursrechtelijk beschermd modern beeldmateriaal. Gebruik eigen eenvoudige SVG-vormen, iconen of placeholders.

**Beloning:** Verbeelding.

## Stop 5: Sint-Jan

**Thema:** een verstoord bericht van de bellende engel.

**Opdrachtsoort:** codeopdracht met audio.

Het geluidsfragment bevat een patroon of cijfercode. Het transcript mag de oplossing niet rechtstreeks prijsgeven, maar moet wel een toegankelijk alternatief bieden. Gebruik eventueel een beschrijving van tonen of signalen.

**Beloning:** Boodschap of Tijd.

## Stop 6: Kruithuis of Citadel

**Thema:** vuur, water en verdediging moeten in balans worden gebracht.

**Opdrachtsoort:** keuzeopdracht of volgordeopdracht.

**Beloning:** Moed.

## Stop 7: Bossche Brouwers

**Functie:** finale.

Deze stop is de eindlocatie.

De finale mag pas beschikbaar worden wanneer:

* de vorige zes stops voltooid zijn;
* de locatiecontrole geslaagd is;
* of een geldige noodontgrendeling is gebruikt.

**Opdrachtsoort:** volgordeopdracht.

Spelers zetten een vereenvoudigd brouwproces in de juiste volgorde:

* schroten;
* maischen;
* filteren;
* koken;
* koelen;
* gisten.

Controleer de definitieve inhoud later inhoudelijk. Maak deze stappen configureerbaar.

Na voltooiing:

* verschijnt de eindscore;
* wordt het gekozen fantasiewezen getoond;
* verschijnt een digitaal bieretiket;
* wordt duidelijk dat er geen alcohol gekocht of gedronken hoeft te worden;
* moet ook een alcoholvrije afsluiting passend blijven.

Voorbeeldtitel eindkaart:

```text
MOERASDRAAK
Team [teamnaam]
Gebrouwen met water, moed, verbeelding en een sterk verhaal.
```

---

# 10. GPS-functionaliteit

Gebruik de browser Geolocation API.

## 10.1 Vraag toestemming op het juiste moment

Vraag niet direct op de landingspagina om locatietoegang.

Toon eerst uitleg:

```text
Om opdrachten op de juiste plek te openen, gebruikt het spel je locatie.
Je locatie wordt alleen gecontroleerd wanneer je daar zelf om vraagt.
We bewaren geen route of locatiegeschiedenis.
```

Daaronder komt een knop:

```text
Locatie toestaan
```

## 10.2 Gebruik one-shot locatiecontroles

Gebruik standaard:

```ts
navigator.geolocation.getCurrentPosition()
```

Gebruik geen continue achtergrondtracking.

`watchPosition()` mag alleen worden gebruikt wanneer daar een duidelijke tijdelijke reden voor is, en moet direct worden gestopt zodra de controle klaar is.

## 10.3 Geofencecontrole

Bereken de afstand met de haversineformule.

Gebruik per routepunt:

* latitude;
* longitude;
* toegestane straal;
* maximaal geaccepteerde onnauwkeurigheid.

Voorbeeldlogica:

```text
Locatie geslaagd wanneer:
afstand <= radiusMeters
EN
accuracy <= maximumAccuracyMeters
```

Gebruik als veilige standaardwaarden:

```text
radiusMeters: 60
maximumAccuracyMeters: 120
```

Maak deze waarden per routepunt configureerbaar.

## 10.4 Slechte nauwkeurigheid

Wanneer de GPS-accuracy te slecht is:

* blokkeer het team niet direct;
* toon de gemeten nauwkeurigheid;
* bied “Nogmaals proberen” aan;
* adviseer om even naar buiten of van hoge gevels weg te lopen;
* bied na enkele mislukte pogingen de handmatige controle aan.

Voorbeeld:

```text
Je locatie is gevonden, maar met een nauwkeurigheid van ongeveer 180 meter.
Loop een klein stukje naar een open plek en probeer opnieuw.
```

## 10.5 Geweigerde toestemming

Wanneer locatietoegang is geweigerd:

* toon duidelijke uitleg;
* bied instructies om de toestemming opnieuw aan te zetten;
* bied een handmatige verificatie aan;
* zorg dat het spel speelbaar blijft.

## 10.6 Handmatige noodontgrendeling

Iedere locatie krijgt een fallback.

Deze kan bestaan uit:

* een observatievraag;
* een herkenningsfoto;
* een korte locatiecode;
* een beheer- of noodcode.

Gebruik geen algemene knop waarmee iedere locatie zonder controle direct kan worden overgeslagen.

Registreer in de voortgang of een locatie via GPS of handmatig is geopend.

## 10.7 Privacy

Sla standaard niet op:

* volledige GPS-routes;
* permanente locatiehistorie;
* exacte coördinaten van spelers;
* snelheid;
* bewegingspatronen.

Bewaar hooguit:

* tijdstip van ontgrendeling;
* type ontgrendeling;
* globale gemeten afstand;
* afgeronde accuracy, alleen voor technische analyse.

Maak het opslaan van afstand en accuracy optioneel en gemakkelijk uit te schakelen.

## 10.8 Ontwikkelmodus

Maak een locatie-simulator die alleen actief is wanneer:

```text
import.meta.env.DEV === true
```

of:

```text
VITE_ENABLE_DEV_TOOLS=true
```

Hiermee moet een ontwikkelaar:

* een routepunt kunnen selecteren;
* een gesimuleerde positie kunnen instellen;
* accuracy kunnen instellen;
* toestemming geweigerd kunnen simuleren;
* een timeout kunnen simuleren;
* een GPS-fout kunnen simuleren.

Deze tool mag niet zichtbaar of bruikbaar zijn in productie.

## 10.9 GPS-kalibratie

Omdat echte coördinaten op locatie gecontroleerd moeten worden:

* verzin geen coördinaten;
* gebruik duidelijke placeholders wanneer coördinaten ontbreken;
* zet `needsOnSiteVerification` op `true`;
* maak een devpagina die de huidige latitude, longitude en accuracy toont;
* voeg een knop toe waarmee een JSON-fragment naar het klembord gekopieerd wordt.

Voorbeeld:

```json
{
  "latitude": 51.000000,
  "longitude": 5.000000,
  "radiusMeters": 60,
  "maximumAccuracyMeters": 120,
  "needsOnSiteVerification": false
}
```

De voorbeeldwaarden mogen nooit ongemerkt als productiecoördinaten gebruikt worden.

---

# 11. Audiofunctionaliteit

Gebruik gewone HTML-audiofunctionaliteit.

## 11.1 Geen autoplay

Start audio nooit automatisch.

Een fragment begint pas na een bewuste gebruikersactie, bijvoorbeeld:

```text
Beluister het bericht
```

## 11.2 Audioplayer

De speler bevat:

* afspelen;
* pauzeren;
* opnieuw starten;
* voortgang;
* huidige tijd;
* totale duur;
* duidelijke actieve status;
* foutmelding wanneer het bestand ontbreekt;
* knop om transcript te tonen.

Zorg dat maar één fragment tegelijk speelt.

Stop audio bij:

* wisselen van routepunt;
* starten van een ander fragment;
* verlaten van het spelscherm;
* expliciet sluiten van de speler.

## 11.3 Transcript

Ieder essentieel geluidsfragment krijgt een transcript of toegankelijk alternatief.

Het spel mag nooit volledig vastlopen omdat:

* audio niet geladen kan worden;
* het toestel op stil staat;
* iemand slechthorend is;
* een browser audioweergave blokkeert.

Bij een audio-code mag het transcript de code niet letterlijk verklappen. Gebruik dan bijvoorbeeld:

* beschrijving van tonen;
* zichtbaar ritmepatroon;
* alternatieve puzzelweergave.

## 11.4 Audio-assets

Codex mag geen nep-MP3-bestanden of lege binaire bestanden genereren.

Maak:

```text
public/audio/README.md
```

Documenteer daarin:

* verwachte bestandsnamen;
* aanbevolen lengte;
* aanbevolen bitrate;
* aanbevolen mono/stereo-instelling;
* transcript;
* locatie in het verhaal.

Gebruik tijdelijke tekstfallbacks zolang de echte opnames ontbreken.

Houd het complete offline routepakket bij voorkeur kleiner dan ongeveer 25 MB.

Voor gesproken tekst is meestal voldoende:

```text
MP3
mono
64–96 kbps
```

## 11.5 Laden en cachen

* Preload niet automatisch alle audio bij iedere paginalaad.
* Download audio tijdens de voorbereiding van het spel.
* Cache versiegebonden bestanden.
* Toon downloadvoortgang.
* Controleer of bestanden daadwerkelijk beschikbaar zijn.
* Bied opnieuw proberen aan na een mislukte download.

---

# 12. Offline ondersteuning

De app moet zo veel mogelijk speelbaar blijven wanneer de mobiele verbinding onderweg slecht is.

## 12.1 Voorbereidingsscherm

Voor de start verschijnt een scherm:

```text
Spel voorbereiden
```

Toon daarop:

* appversie;
* routeversie;
* aantal afbeeldingen;
* aantal geluidsfragmenten;
* geschatte downloadgrootte;
* voortgang;
* resultaat per categorie.

Voorbeeld:

```text
✓ App gereed
✓ Route opgeslagen
✓ 8 afbeeldingen opgeslagen
✓ 7 geluidsfragmenten opgeslagen
✓ Klaar om te starten
```

## 12.2 Service worker

Gebruik een aparte service worker voor deze app.

Zorg voor:

* precache van app-shell;
* cache-first voor versiegebonden afbeeldingen en audio;
* network-first voor API-data;
* verwijderen van oude caches;
* versiebeheer;
* gecontroleerde appupdates.

Gebruik geen cachenaam van de vriendenweekend-app.

Voorbeeld:

```text
moerasdraak-app-v1
moerasdraak-media-v1
```

## 12.3 Updategedrag

Wanneer een nieuwe versie beschikbaar is tijdens een actief spel:

* herlaad niet automatisch;
* toon een melding;
* laat het team zelf kiezen wanneer de update wordt toegepast;
* waarschuw dat een herlaadactie tijdens een opdracht ongewenst kan zijn.

Voorbeeld:

```text
Er is een nieuwe versie beschikbaar.
Werk de app bij wanneer je niet midden in een opdracht zit.
```

## 12.4 Lokale voortgang

Schrijf voortgang eerst lokaal weg.

Bewaar minimaal:

* team-id;
* teamnaam;
* gameversie;
* gestarte tijd;
* voltooide stops;
* huidige stop;
* pogingen;
* gebruikte hints;
* verzamelde beloningen;
* gekozen fantasiewezen;
* score;
* nog te synchroniseren acties.

Gebruik IndexedDB voor spelvoortgang.

Gebruik `localStorage` alleen voor kleine instellingen zoals:

* installatiemelding gesloten;
* laatst gebruikte team-id;
* voorkeur voor geluid;
* onboarding voltooid.

## 12.5 Synchronisatie

Gebruik een eenvoudige synchronisatiequeue.

Elke actie krijgt een unieke idempotency-id.

Voorbeelden van acties:

* team aangemaakt;
* stop geopend;
* opdracht gestart;
* antwoord geprobeerd;
* hint gebruikt;
* opdracht voltooid;
* spel afgerond.

Synchroniseer bij:

* actieve internetverbinding;
* openen van de app;
* terugkeren naar de app;
* `online`-event;
* handmatig indrukken van “Synchroniseren”.

Vertrouw niet uitsluitend op Background Sync, omdat ondersteuning op mobiele browsers kan verschillen.

## 12.6 Conflicten

Voortgang mag nooit teruggezet worden.

Gebruik een oplopend statusmodel:

```text
locked
available
arrived
started
completed
```

Een oudere synchronisatieactie mag bijvoorbeeld nooit:

```text
completed
```

terugzetten naar:

```text
started
```

Gebruik timestamps en statusprioriteit.

---

# 13. Teams en sessies

## 13.1 Spelers zonder account

Spelers hoeven voor het MVP geen e-mailaccount aan te maken.

Gebruik bij voorkeur Supabase anonymous authentication wanneer dit binnen de bestaande configuratie past.

Het team maakt aan het begin:

* een teamnaam;
* optioneel namen van teamleden.

## 13.2 Teamcode

Genereer een korte teamcode van zes goed leesbare tekens.

Vermijd verwarrende tekens zoals:

```text
0
O
1
I
L
```

De teamcode kan worden gebruikt om:

* op een ander apparaat verder te gaan;
* een tweede apparaat aan het team te koppelen;
* de sessie na verwijderen van lokale opslag te herstellen.

Toon daarnaast een langere herstelcode of herstel-link.

## 13.3 Eén primair apparaat

Ontwerp het MVP voor één actief apparaat per team.

Meerdere apparaten mogen dezelfde voortgang kunnen bekijken of hervatten, maar live gelijktijdige bediening is geen vereiste.

Voorkom complexe realtime multiplayerlogica.

## 13.4 Hervatten

Bij opnieuw openen van de PWA:

* zoek lokale teaminformatie;
* toon “Verder met team [naam]”;
* laad lokale voortgang direct;
* synchroniseer daarna op de achtergrond;
* voorkom dat een tijdelijk netwerkprobleem het hervatten blokkeert.

---

# 14. Supabase-opzet

Gebruik Supabase alleen voor teamgegevens, voortgang en eenvoudige spelstatistieken.

Bewaar route-inhoud voor het MVP in de code.

## 14.1 Tabellen

Maak één overzichtelijke initiële migratie.

### `city_game_teams`

Velden:

```text
id uuid primary key
game_slug text not null
game_version integer not null
name text not null
join_code text unique not null
owner_user_id uuid not null
status text not null
score integer not null default 0
started_at timestamptz
completed_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
metadata jsonb not null default '{}'
```

### `city_game_team_members`

Velden:

```text
id uuid primary key
team_id uuid not null
user_id uuid not null
display_name text
role text not null default 'member'
joined_at timestamptz not null default now()
```

Voeg een unieke combinatie toe voor:

```text
team_id + user_id
```

### `city_game_progress`

Velden:

```text
id uuid primary key
team_id uuid not null
stop_id text not null
state text not null
unlock_method text
arrived_at timestamptz
started_at timestamptz
completed_at timestamptz
attempts integer not null default 0
hints_used integer not null default 0
score_awarded integer not null default 0
answer_data jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Voeg een unieke combinatie toe voor:

```text
team_id + stop_id
```

### `city_game_events`

Velden:

```text
id uuid primary key
event_id uuid unique not null
team_id uuid not null
game_slug text not null
stop_id text
event_type text not null
event_data jsonb not null default '{}'
occurred_at timestamptz not null
created_at timestamptz not null default now()
```

Gebruik deze tabel alleen voor functionele analyse en foutonderzoek.

Sla geen complete GPS-routes op.

## 14.2 Naamgeving

Gebruik een duidelijke prefix zoals:

```text
city_game_
```

Hierdoor kunnen de tabellen eventueel in hetzelfde Supabase-project bestaan als andere hobbyprojecten zonder naamconflicten.

Gebruik geen bestaande vriendenweekend-tabellen voor deze app.

## 14.3 RLS

Activeer Row Level Security.

Regels:

* een gebruiker mag een eigen team aanmaken;
* een teamlid mag het gekoppelde team lezen;
* een teamlid mag voortgang van dat team lezen en bijwerken;
* een gebruiker mag niet willekeurig andere teams opvragen;
* team join moet via een gecontroleerde functie of veilige lookup verlopen;
* de client krijgt nooit een service-role key.

Plaats uitsluitend in de frontend:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Zet nooit een service-role key in:

* `.env`;
* frontendcode;
* GitHub Actions voor de browserbuild;
* repository;
* logbestanden.

## 14.4 Antwoordbeveiliging

Voor het besloten MVP mogen antwoorden lokaal gevalideerd worden.

Maak in documentatie expliciet duidelijk:

* client-side antwoorden zijn niet volledig geheim;
* iemand met technische kennis kan applicatiebestanden inspecteren;
* dit is acceptabel voor een besloten pilot;
* voor een commerciële versie moet antwoordvalidatie naar een serverfunctie of Supabase RPC worden verplaatst.

Bouw nu geen complexe Edge Functions wanneer dit offline spelen belemmert.

Structureer de validatielogica wel zodanig dat deze later vervangbaar is.

---

# 15. Scoremodel

Gebruik een eenvoudig en transparant scoremodel.

Voorbeeld per hoofdopdracht:

```text
Basisscore: 1.000 punten
Eerste hint: -100
Tweede hint: -150
Derde hint: -250
Fout antwoord: -25
Minimumscore per voltooide opdracht: 100
```

Gebruik geen zware tijdsdruk tijdens het wandelen.

Een kleine tijdsbonus voor het totale spel mag, maar:

* pauzes moeten mogelijk zijn;
* terrasbezoek mag niet zwaar bestraft worden;
* langzamer lopen moet niet leiden tot een slechte ervaring;
* nauwkeurigheid en samenwerking zijn belangrijker dan snelheid.

Sla per stop op:

* pogingen;
* gebruikte hints;
* behaalde punten;
* voltooiingstijd.

Bereken de score via één centrale pure functie met unit tests.

---

# 16. Gebruikerservaring

De doelgroep loopt ongeveer van 16 tot 70 jaar.

## 16.1 Mobiel eerst

Ontwerp primair voor:

```text
360–430 px schermbreedte
```

Ondersteun daarna tablets en desktop.

Gebruik:

* grote knoppen;
* minimaal ongeveer 44 px hoge aanraakvlakken;
* duidelijke contrasten;
* tekstgrootte van minimaal 16 px voor hoofdtekst;
* korte alinea’s;
* één primaire actie per scherm;
* vaste ruimte voor veilige iPhone-insets;
* geen horizontaal scrollen;
* geen bediening die alleen via hover werkt.

## 16.2 Visuele stijl

Gebruik een combinatie van:

* middeleeuws mysterie;
* water;
* draak;
* Bossche architectuur;
* industriële uitstraling richting Tramkade;
* goud- of messingaccenten;
* donkerblauw, antraciet en warme lichte kaartvlakken.

Voorkom:

* extreem donkere schermen met slecht leesbare tekst;
* overdreven sierletters;
* kleine perkamentteksten;
* drukke animaties;
* grote afbeeldingen die de bediening naar beneden duwen.

Gebruik een gewone goed leesbare systeemfont of aanwezige webfont.

## 16.3 Navigatie

Toon tijdens het spel altijd:

* teamnaam;
* huidige stop;
* voortgang, bijvoorbeeld `3 van 7`;
* score;
* toegang tot instellingen;
* knop naar routeoverzicht.

Gebruik geen onnodig hamburger-menu voor primaire spelacties.

## 16.4 Statussen

Maak aparte duidelijke schermstatussen voor:

* routepunt vergrendeld;
* routepunt beschikbaar;
* GPS wordt gezocht;
* GPS onvoldoende nauwkeurig;
* GPS geweigerd;
* routepunt geopend;
* opdracht actief;
* antwoord fout;
* antwoord goed;
* offline;
* synchronisatie bezig;
* synchronisatie mislukt;
* appupdate beschikbaar.

## 16.5 Hints

Hints worden één voor één vrijgegeven.

Toon vóór het openen:

```text
Deze hint kost 100 punten.
```

Vraag één bevestiging.

Vraag niet opnieuw om bevestiging voor het daadwerkelijk tonen van dezelfde hint.

## 16.6 Fouten

Gebruik menselijke Nederlandse foutmeldingen.

Niet:

```text
GeolocationPositionError code 3
```

Wel:

```text
Het duurde te lang om je locatie te bepalen. Controleer je locatie-instellingen en probeer opnieuw.
```

Log technische details alleen in ontwikkelmodus.

---

# 17. PWA-installatie

## 17.1 Manifest

Maak een eigen manifest met minimaal:

```json
{
  "name": "Het Geheim van de Moerasdraak",
  "short_name": "Moerasdraak",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "lang": "nl-NL"
}
```

Configureer correcte:

* icons;
* maskable icons;
* theme color;
* background color;
* beschrijving;
* start URL;
* scope.

Gebruik geen manifest of iconen van de vriendenweekend-app.

## 17.2 Installatieprompt

Ondersteun `beforeinstallprompt` waar beschikbaar.

Toon de installatiemelding alleen wanneer:

* de app nog niet standalone draait;
* de browser installatie ondersteunt;
* de gebruiker de melding niet recent heeft gesloten.

Op iPhone en iPad is een handmatige instructie nodig:

```text
Open het deelmenu en kies ‘Zet op beginscherm’.
```

Toon deze instructie alleen wanneer het apparaat en de browser daarbij passen.

Verberg installatie-instructies wanneer de PWA al geïnstalleerd is.

## 17.3 Geen agressieve banner

Blokkeer het spel nooit met een verplichte installatiepopup.

De app moet ook normaal in de browser speelbaar zijn.

---

# 18. Externe navigatie

Voeg geen ingebouwde kaart toe in het MVP.

Toon per routepunt:

* een verhalende routeaanwijzing;
* optioneel de resterende afstand;
* een knop om de bestemming in de standaard kaartapp te openen.

Gebruik voor de externe kaart een configureerbare zoekterm of coördinaat.

De app mag niet afhankelijk zijn van de externe kaart om het spel te kunnen voltooien.

---

# 19. Eindresultaat

Na het afronden van de finale bij Bossche Brouwers toont de app:

* teamnaam;
* totale score;
* totale speeltijd;
* aantal gebruikte hints;
* aantal foutieve pogingen;
* alle zeven verzamelde symbolen;
* het samengestelde fantasiewezen;
* een digitaal Moerasdraak-etiket;
* datum;
* knop om resultaat als afbeelding te delen of op te slaan.

Gebruik voor de resultaatkaart bij voorkeur HTML/CSS en een lichte canvas-export.

Voeg geen zware bibliotheek toe wanneer de browser dit eenvoudig kan uitvoeren.

Wanneer delen via de Web Share API beschikbaar is, gebruik die.

Bied anders:

* afbeelding downloaden;
* tekst kopiëren.

Gebruik neutrale afsluittekst, bijvoorbeeld:

```text
Jullie hebben de herinneringen van Den Bosch hersteld.
De Moerasdraak kan weer rusten.
```

Een aankoop of alcoholconsumptie bij Bossche Brouwers mag nooit technisch vereist zijn.

---

# 20. Toegankelijkheid

Implementeer minimaal:

* semantische HTML;
* goede labels;
* zichtbare focus;
* bediening met toetsenbord;
* voldoende contrast;
* transcript voor audio;
* alternatieve bediening voor drag-and-drop;
* `aria-live` voor belangrijke statusmeldingen;
* gereduceerde animatie bij `prefers-reduced-motion`;
* geen informatie die uitsluitend met kleur wordt aangegeven;
* foutmeldingen naast én gekoppeld aan het relevante veld.

Beheer focus bij:

* openen van dialogs;
* sluiten van dialogs;
* tonen van een goed antwoord;
* navigeren naar een nieuwe opdracht.

---

# 21. Testen

Gebruik de bestaande teststack wanneer aanwezig.

Wanneer nog geen teststack bestaat, voeg dan alleen Vitest toe voor kritieke logica. Voeg niet automatisch een volledige Playwright-installatie toe.

## 21.1 Unit tests

Schrijf tests voor:

* haversine-afstandsberekening;
* geofence binnen straal;
* geofence buiten straal;
* onvoldoende GPS-accuracy;
* scoreberekening;
* antwoordnormalisatie;
* opdrachtvolgorde;
* progressiestatus mag niet teruglopen;
* synchronisatiequeue;
* game-data validatie.

## 21.2 Componenttests waar praktisch

Test minimaal:

* locatie geweigerd;
* GPS-timeout;
* hintbevestiging;
* fout antwoord;
* goed antwoord;
* audiofallback;
* offline melding;
* hervatten van lokaal team.

Voeg geen complexe testinfrastructuur toe wanneer eenvoudige unit tests voldoende zijn.

## 21.3 Handmatige testlijst

Maak:

```text
docs/test-checklist.md
```

Neem hierin op:

### Android Chrome

* browsergebruik;
* installeren;
* standalone openen;
* GPS toestaan;
* GPS weigeren;
* audio;
* offline starten;
* offline hervatten;
* update installeren.

### iPhone Safari

* browsergebruik;
* “Zet op beginscherm”;
* standalone openen;
* GPS;
* audio na gebruikersactie;
* safe areas;
* schermvergrendeling;
* terugkeren na wisselen van app.

### Algemene scenario’s

* slechte GPS-accuracy;
* geen netwerk;
* netwerk valt halverwege weg;
* app wordt gesloten tijdens opdracht;
* tweede apparaat hervat team;
* audio ontbreekt;
* cache bevat oude versie;
* Supabase tijdelijk niet beschikbaar;
* finale zonder alle stops;
* handmatige noodontgrendeling.

---

# 22. Deployment

Maak een GitHub Actions-workflow voor deployment naar GitHub Pages wanneer dat aansluit bij de bestaande vriendenweekend-opzet.

Ondersteun een custom domain.

Maak indien nodig:

```text
public/CNAME
```

met een configureerbare domeinnaam.

Documenteer:

* DNS-instellingen;
* GitHub Pages-instellingen;
* benodigde repository secrets;
* Supabase environment variables;
* buildcommando;
* deploycommando;
* cache-updateproces.

Controleer dat de PWA:

* via HTTPS draait;
* een geldig manifest heeft;
* een geldige service worker registreert;
* geen scopeconflict met de vriendenweekend-app heeft.

---

# 23. Omgevingsvariabelen

Maak:

```text
.env.example
```

Met bijvoorbeeld:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GAME_SLUG=moerasdraak-den-bosch
VITE_ENABLE_DEV_TOOLS=false
VITE_ENABLE_SUPABASE_SYNC=true
VITE_PUBLIC_BASE_URL=
```

De app moet ook lokaal kunnen starten zonder geldige Supabase-configuratie.

In dat geval:

* werkt lokale spelvoortgang;
* wordt cloudsynchronisatie uitgeschakeld;
* verschijnt in development een waarschuwing;
* crasht de app niet.

---

# 24. Implementatiefasen

Werk in deze volgorde.

## Fase 0: gerichte analyse

* inspecteer relevante bestanden van de referentie-app;
* bepaal welke patronen herbruikbaar zijn;
* noteer risico’s;
* maak een kort plan;
* start daarna direct.

## Fase 1: projectbasis

* Vite;
* React;
* TypeScript;
* router;
* globale styling;
* basispagina’s;
* foutafhandeling;
* environment-configuratie.

## Fase 2: data-gedreven game-engine

* types;
* routepakket;
* routevoortgang;
* vier opdrachtsoorten;
* scoreberekening;
* hints;
* resultaten.

## Fase 3: lokale opslag

* IndexedDB;
* team hervatten;
* spelvoortgang;
* synchronisatiequeue;
* fouttolerantie.

## Fase 4: GPS

* permission flow;
* one-shot locatiecheck;
* haversine;
* accuracy-controle;
* fallback;
* devsimulator;
* kalibratiehulpmiddel.

## Fase 5: audio

* audioplayer;
* transcript;
* foutfallback;
* stoppen bij navigatie;
* route-assets.

## Fase 6: Supabase

* migratie;
* RLS;
* anonymous auth;
* teams;
* voortgang;
* events;
* synchronisatie.

## Fase 7: PWA en offline

* manifest;
* iconen/placeholders;
* service worker;
* offline routepakket;
* updateprompt;
* installatie-instructies;
* aparte cache.

## Fase 8: finale en resultaat

* laatste locatie;
* brouwvolgorde;
* eindscore;
* digitaal etiket;
* delen/exporteren.

## Fase 9: tests en documentatie

* unit tests;
* build;
* lint;
* testchecklist;
* deploymentdocumentatie;
* mediahandleiding;
* GPS-kalibratiehandleiding.

Werk een fase volledig af voordat je grote uitbreidingen uit een volgende fase implementeert.

---

# 25. Kwaliteitscontroles

Voer tijdens het werk eerst gerichte controles uit.

Na wijzigingen aan scorelogica:

```bash
npm test -- scoring
```

Na wijzigingen aan GPS:

```bash
npm test -- location
```

Voer pas aan het einde de volledige controles uit:

```bash
npm run lint
npm run test
npm run build
```

Los daadwerkelijke fouten op basis van logs op.

Ga niet speculatief complete delen herschrijven wanneer één import, type of configuratiewaarde fout is.

---

# 26. Definition of Done

Het MVP is gereed wanneer:

1. De app lokaal start.
2. De productiebuild slaagt.
3. De app op mobiel bruikbaar is.
4. De app een zelfstandig manifest heeft.
5. De service worker geen bestanden van andere PWA’s gebruikt.
6. De app installeerbaar is op ondersteunde Android-browsers.
7. Er duidelijke iOS-installatie-instructies zijn.
8. Een team zonder normaal account kan starten.
9. Een team na sluiten van de app kan hervatten.
10. Alle zeven stops in de route aanwezig zijn.
11. GPS-controle werkt met configureerbare geofences.
12. Handmatige fallback beschikbaar is.
13. Audio alleen na gebruikersactie start.
14. Elk audiofragment een tekstalternatief heeft.
15. Het routepakket offline beschikbaar gemaakt kan worden.
16. Voortgang offline opgeslagen wordt.
17. Synchronisatie na herstel van internet opnieuw wordt geprobeerd.
18. Supabase RLS actief is.
19. Geen service-role key in de frontend staat.
20. De finale pas na de eerdere stops beschikbaar is.
21. De route eindigt bij Bossche Brouwers.
22. Het eindresultaat een score en digitaal etiket toont.
23. Kritieke logica tests heeft.
24. GPS-coördinaten duidelijk als te verifiëren zijn gemarkeerd.
25. Ontbrekende audio en afbeeldingen de app niet laten crashen.
26. De README volledige installatie- en deploymentinstructies bevat.

---

# 27. Documentatie die moet worden opgeleverd

Werk de volgende documenten bij of maak ze aan:

```text
README.md
docs/architecture.md
docs/route-content.md
docs/audio-assets.md
docs/gps-calibration.md
docs/deployment.md
docs/test-checklist.md
```

De README moet minimaal bevatten:

* projectdoel;
* technische stack;
* lokaal starten;
* environment variables;
* Supabase instellen;
* migraties uitvoeren;
* route-inhoud aanpassen;
* audio toevoegen;
* GPS-coördinaten kalibreren;
* PWA testen;
* builden;
* deployen;
* bekende beperkingen.

---

# 28. Eindrapportage van Codex

Geef na implementatie geen lange algemene uitleg.

Gebruik exact deze structuur:

## Samenvatting

Maximaal tien korte bullets.

## Gewijzigde onderdelen

Noem alleen belangrijke bestanden en mappen.

## Uitgevoerde controles

Noem:

* lint;
* tests;
* build;
* eventueel handmatige controles.

## Nog handmatig nodig

Noem uitsluitend zaken die niet door code opgelost kunnen worden, zoals:

* echte GPS-coördinaten op locatie controleren;
* geluidsfragmenten opnemen;
* definitieve afbeeldingen plaatsen;
* Supabase-credentials instellen;
* DNS koppelen;
* inhoudelijke routecontrole;
* afspraken met Bossche Brouwers.

## Bekende beperkingen

Maximaal tien concrete punten.

Plak geen volledige bestanden in het eindrapport wanneer ze al in de repository staan.

Commit of push geen wijzigingen tenzij daar expliciet opdracht voor is gegeven.

---

# 29. Belangrijkste ontwerpprincipes

Houd tijdens de hele implementatie deze principes aan:

1. De stad bevat de antwoorden; de telefoon ondersteunt het verhaal.
2. GPS ondersteunt het spel, maar mag een team nooit permanent blokkeren.
3. Audio verrijkt het spel, maar ieder essentieel onderdeel heeft een alternatief.
4. Lokaal opslaan komt vóór cloudsynchronisatie.
5. Eén telefoon per team is voor het MVP voldoende.
6. Route-inhoud blijft data-gedreven.
7. Bouw vier herbruikbare opdrachtsoorten in plaats van zeven losse systemen.
8. Geen continue achtergrondtracking.
9. Geen onnodige persoonsgegevens of locatiehistorie.
10. Geen afhankelijkheid van alcoholconsumptie of medewerking van horecapersoneel.
11. Geen cache-, manifest- of service-workerconflicten met de vriendenweekend-PWA.
12. Eenvoud en betrouwbaarheid gaan vóór technisch indrukwekkende oplossingen.
13. Gebruik kleine gerichte patches.
14. Voeg alleen dependencies toe die aantoonbaar nodig zijn.
15. Stop niet vanwege ontbrekende media of coördinaten; gebruik veilige placeholders en goede documentatie.
