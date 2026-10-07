# Vervolgopdracht Codex: rond de Moerasdraak-PWA volledig af

De eerste implementatieronde van de PWA **Het Geheim van de Moerasdraak** is uitgevoerd. Rond nu de bestaande implementatie af tot een daadwerkelijk testbare MVP.

Werk verder in de huidige repository en op de huidige branch.

Begin niet opnieuw en maak geen nieuw project aan.

## Belangrijk

De volgende punten uit de vorige eindrapportage zijn geen optionele toekomstige uitbreidingen, maar horen bij het afgesproken MVP en moeten nu worden geïmplementeerd:

* volledige team aanmaken- en hervatten-flow;
* werkende Supabase-synchronisatie;
* volledige offline voorbereiding;
* bruikbare resultaatkaart;
* GPS-devsimulator;
* afdwingen van finalevereisten;
* goede PWA-installatiestroom;
* fout- en randgevallen rond GPS, permissions, offline gebruik en synchronisatie.

Werk deze punten af voordat je nieuwe functionaliteit toevoegt.

---

# 1. Efficiënt werken

Ga zuinig om met tokens en wijzigingen.

## Inspectie

Lees eerst uitsluitend:

* de huidige `README.md`;
* `package.json`;
* de huidige takenlijst of eerdere eindrapportage;
* bestanden die horen bij:

  * teams;
  * lokale opslag;
  * synchronisatie;
  * GPS;
  * offline caching;
  * PWA-installatie;
  * finale;
  * resultaten;
  * Supabase;
* bestaande tests.

Gebruik `rg`, `find` en gerichte bestandslezingen.

Lees niet opnieuw de volledige repository.

## Wijzigingen

* Werk bestaande implementaties af.
* Voer geen brede refactor uit.
* Verander geen werkende architectuur zonder aantoonbare noodzaak.
* Voeg geen zware libraries toe.
* Gebruik bestaande componenten, hooks en patronen.
* Vermijd formatteringswijzigingen buiten aangepaste code.
* Maak kleine, logisch gegroepeerde patches.
* Plak in de eindrapportage geen volledige bestanden.

## Vragen

Stel geen vragen over gegevens die met een placeholder of configuratie kunnen worden opgelost.

Ontbrekende GPS-coördinaten, audio-opnames en Supabase-credentials zijn geen blokkade voor het implementeren en testen van de bijbehorende functionaliteit.

---

# 2. Eerst de huidige staat vaststellen

Controleer elk genoemd open punt in de daadwerkelijke code.

Maak intern een compacte matrix:

```text
Onderdeel
Huidige implementatie
Ontbrekend gedrag
Bestanden
Tests
```

Geef daarna maximaal tien korte bevindingen en begin direct met implementeren.

Neem de eerdere eindrapportage niet blind over. Controleer of onderdelen inmiddels al gedeeltelijk bestaan.

---

# 3. Team aanmaken volledig implementeren

De teamflow moet zonder Supabase bruikbaar zijn en met Supabase kunnen synchroniseren.

## 3.1 Nieuw team

Implementeer een volledig scherm voor het aanmaken van een team.

Velden:

* teamnaam, verplicht;
* namen van teamleden, optioneel;
* akkoord met korte privacyuitleg, indien nodig.

Validatie:

* teamnaam trimmen;
* minimale lengte van 2 tekens;
* maximale lengte van 40 tekens;
* geen team aanmaken met alleen spaties;
* dubbele submits voorkomen;
* duidelijke Nederlandstalige foutmeldingen.

Bij aanmaken:

1. genereer lokaal een UUID voor het team;
2. genereer een leesbare joincode;
3. sla het team direct lokaal op;
4. maak lokaal de initiële voortgang aan;
5. navigeer direct naar het voorbereidingsscherm;
6. probeer daarna Supabase te synchroniseren;
7. blokkeer het spel niet wanneer Supabase tijdelijk onbereikbaar is.

## 3.2 Joincode

Gebruik een code van zes goed leesbare tekens.

Gebruik bijvoorbeeld alleen:

```text
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

Vermijd:

```text
I
L
O
0
1
```

Normaliseer invoer:

* hoofdletters;
* spaties verwijderen;
* streepjes verwijderen.

## 3.3 Team hervatten

Bij het openen van de app:

* controleer lokale opslag;
* toon een kaart met het laatst gebruikte team;
* toon teamnaam;
* toon huidige voortgang;
* toon datum van laatste activiteit;
* bied “Verder spelen” aan;
* bied “Ander team gebruiken” aan;
* bied een veilige mogelijkheid om lokale teamdata te verwijderen.

Verwijderen moet een bevestiging vragen.

## 3.4 Team via code hervatten

Maak een flow waarin een teamcode kan worden ingevoerd.

Gedrag:

* valideer formaat;
* haal het team via een veilige Supabase-functie op;
* koppel de huidige anonieme gebruiker als teamlid;
* download de actuele voortgang;
* combineer deze veilig met eventuele lokale voortgang;
* sla het team lokaal op;
* navigeer naar de actuele spelpositie.

Wanneer Supabase niet is geconfigureerd:

* verberg of disable de joincode-flow;
* leg duidelijk uit dat cloudherstel niet beschikbaar is;
* laat lokaal spelen wel werken.

## 3.5 Eén primair team

Houd ondersteuning eenvoudig.

* Eén actief lokaal team is voldoende.
* Eerdere lokale teams mogen in een eenvoudige lijst zichtbaar blijven.
* Realtime gelijktijdig spelen op meerdere apparaten hoeft niet.
* Voorkom dat het koppelen van een apparaat voortgang terugzet.

---

# 4. Supabase-synchronisatie volledig implementeren

De huidige skeleton moet worden vervangen door een werkende synchronisatielaag.

## 4.1 Offline-first

Elke gebruikersactie wordt eerst lokaal opgeslagen.

De UI mag niet wachten op Supabase voor:

* team aanmaken;
* routepunt openen;
* antwoord registreren;
* hint gebruiken;
* routepunt voltooien;
* score bijwerken;
* spel afronden.

## 4.2 Queue-item

Gebruik een duidelijk model, bijvoorbeeld:

```ts
interface SyncQueueItem {
  id: string;
  teamId: string;
  eventType: string;
  stopId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}
```

Gebruik een unieke UUID als idempotency-id.

## 4.3 Te synchroniseren acties

Ondersteun minimaal:

* `team_created`;
* `team_updated`;
* `team_joined`;
* `game_started`;
* `stop_unlocked`;
* `stop_started`;
* `answer_attempted`;
* `hint_used`;
* `stop_completed`;
* `game_completed`.

## 4.4 Synchronisatiemomenten

Probeer te synchroniseren bij:

* openen van de app;
* aanmaken van een team;
* afronden van een opdracht;
* terugkeren naar de app;
* browser `online`-event;
* handmatig indrukken van een synchronisatieknop.

Gebruik daarnaast een beperkte retry zolang de app actief is.

Maak geen oneindige snelle retry-loop.

Gebruik oplopende wachttijden, bijvoorbeeld:

```text
5 seconden
15 seconden
30 seconden
60 seconden
maximaal 5 minuten
```

Stop automatische retries na een redelijk aantal fouten en laat handmatig opnieuw proberen toe.

## 4.5 Idempotentie

Een queue-item mag veilig meerdere keren naar Supabase worden gestuurd.

Gebruik de unieke `event_id` en een unieke databaseconstraint.

Een herhaalde sync mag:

* geen dubbele events maken;
* geen dubbele teamleden maken;
* geen hints dubbel tellen;
* geen score dubbel toekennen;
* geen pogingen dubbel ophogen.

## 4.6 Conflictregels

Gebruik voortgang die alleen vooruit kan gaan:

```text
locked
available
arrived
started
completed
```

Definieer centraal de prioriteit van deze statussen.

Bij samenvoegen:

* hoogste status wint;
* hoogste aantal pogingen wint;
* hoogste aantal gebruikte hints wint;
* vroegste `started_at` blijft behouden;
* eerste geldige `completed_at` blijft behouden;
* toegekende score mag niet dubbel worden opgeteld;
* verzamelde rewards worden als unieke set samengevoegd.

## 4.7 Synchronisatiestatus in de UI

Toon een kleine niet-storende status:

* alles opgeslagen;
* lokaal opgeslagen;
* synchroniseren;
* synchronisatie mislukt;
* offline.

Gebruik bijvoorbeeld:

```text
Alles opgeslagen
```

```text
Offline opgeslagen
```

```text
Synchronisatie mislukt – probeer opnieuw
```

Toon technische foutdetails alleen in development.

## 4.8 Handmatige actie

Maak onder instellingen een knop:

```text
Nu synchroniseren
```

Toon daarna:

* aantal gesynchroniseerde acties;
* aantal resterende acties;
* eventuele menselijke foutmelding.

## 4.9 Supabase uitgeschakeld

Bij ontbrekende of ongeldige environment variables:

* crasht de app niet;
* blijft lokaal spelen volledig functioneren;
* worden queue-items bewaard;
* wordt duidelijk gemaakt dat cloudback-up niet actief is;
* worden geen herhaalde mislukte netwerkrequests uitgevoerd.

---

# 5. Supabase-database en RLS controleren

Controleer of de migraties daadwerkelijk aansluiten op de frontend.

## 5.1 Migraties

Zorg dat migraties bestaan voor:

* `city_game_teams`;
* `city_game_team_members`;
* `city_game_progress`;
* `city_game_events`.

Voeg benodigde:

* foreign keys;
* indexes;
* unieke constraints;
* updated-at triggers;
* check constraints;

toe.

Gebruik geen destructieve wijziging van bestaande productietabellen.

## 5.2 Joinfunctie

Implementeer bij voorkeur een Supabase RPC voor het koppelen van een gebruiker via teamcode.

Bijvoorbeeld conceptueel:

```text
join_city_game_team(join_code)
```

Deze functie:

* normaliseert de code;
* zoekt exact één team;
* voegt de huidige geauthenticeerde gebruiker toe;
* retourneert alleen de benodigde teaminformatie;
* onthult geen lijst met andere teams;
* is veilig opnieuw aan te roepen.

## 5.3 RLS

Controleer met gerichte tests of:

* een gebruiker een eigen team kan maken;
* een teamlid het team kan lezen;
* een niet-teamlid het team niet kan lezen;
* een teamlid voortgang kan bijwerken;
* een niet-teamlid geen voortgang kan aanpassen;
* events alleen voor gekoppelde teams kunnen worden toegevoegd;
* de anon key geen algemene toegang geeft.

Documenteer hoe deze policies handmatig in Supabase getest kunnen worden.

---

# 6. Offline routepakket volledig implementeren

Het voorbereidingsscherm moet daadwerkelijk bestanden downloaden en controleren.

## 6.1 Assetmanifest

Maak een routegebonden lijst van alle benodigde assets:

* afbeeldingen;
* SVG’s;
* audio;
* optionele fonts;
* route-JSON voor zover extern geladen.

Leid deze lijst waar mogelijk automatisch af uit het gamepack.

Voorkom twee losse lijsten die uit elkaar kunnen lopen.

## 6.2 Voorbereidingsflow

Toon:

* aantal te downloaden bestanden;
* totaal aantal bestanden;
* afgeronde bestanden;
* voortgangspercentage;
* fouten;
* opnieuw proberen;
* doorgaan met alleen de beschikbare bestanden, wanneer verantwoord.

Voorbeeld:

```text
18 van 21 bestanden opgeslagen
```

## 6.3 Controle

Beschouw een bestand pas als beschikbaar wanneer:

* het request succesvol was;
* een bruikbare response in Cache Storage staat;
* een leeg of foutief bestand niet als succes wordt gezien.

## 6.4 Ontbrekende audio

Omdat echte opnames nog ontbreken:

* laat ontbrekende audiobestanden het offlinepakket niet permanent blokkeren;
* herken assets die bewust als placeholder zijn gemarkeerd;
* gebruik het transcript als fallback;
* maak in development zichtbaar welke echte audiobestanden ontbreken.

## 6.5 Cacheversies

Koppel caches aan:

* appversie;
* gamepackversie;
* mediaversie.

Verwijder alleen caches van deze PWA.

Raak nooit caches van de vriendenweekend-app aan.

## 6.6 Offline starten

Test dit scenario:

1. app online openen;
2. routepakket voorbereiden;
3. browser of PWA volledig sluiten;
4. netwerk uitschakelen;
5. app opnieuw openen;
6. team hervatten;
7. opdrachten bekijken;
8. audiofallback gebruiken;
9. voortgang opslaan;
10. later online synchroniseren.

Dit scenario moet werken.

---

# 7. GPS-devsimulator implementeren

De eerder afgesproken simulator moet nu volledig worden gebouwd.

## 7.1 Alleen development

De simulator is uitsluitend beschikbaar wanneer:

```ts
import.meta.env.DEV
```

of:

```text
VITE_ENABLE_DEV_TOOLS=true
```

Zorg dat productiebuilds standaard geen toegang hebben.

Gebruik daarnaast een production guard in de component zelf.

## 7.2 Mogelijkheden

De simulator moet minimaal ondersteunen:

* routepunt selecteren;
* simuleren dat speler exact op het routepunt staat;
* handmatig latitude instellen;
* handmatig longitude instellen;
* accuracy instellen;
* positie buiten de geofence simuleren;
* permission denied simuleren;
* position unavailable simuleren;
* timeout simuleren;
* simulator resetten;
* echte browsergeolocatie gebruiken.

## 7.3 Architectuur

Laat de gewone locatiecontrole niet rechtstreeks overal `navigator.geolocation` aanroepen.

Gebruik één injecteerbare locatieprovider:

```ts
interface LocationProvider {
  getCurrentPosition(options?: PositionOptions): Promise<LocationResult>;
}
```

Maak:

* browserprovider;
* development-simulatorprovider.

Hierdoor kan dezelfde spelcode en dezelfde UI getest worden.

## 7.4 Testen

Schrijf tests voor:

* locatie binnen straal;
* locatie buiten straal;
* slechte accuracy;
* geweigerde permission;
* timeout;
* fallback activeren;
* GPS-unlock registreren;
* handmatige unlock registreren.

---

# 8. GPS-permissions en edge-case UX afmaken

## 8.1 Voorafgaande uitleg

Vraag pas toestemming nadat de gebruiker uitleg heeft gezien en op een knop heeft gedrukt.

## 8.2 Loading state

Tijdens locatiebepaling:

* disable dubbele submits;
* toon duidelijke voortgang;
* bied na redelijke tijd annuleren aan;
* voorkom oneindige spinner.

## 8.3 Foutscenario’s

Ondersteun apart:

### Permission denied

Toon uitleg voor:

* iPhone Safari;
* Android Chrome;
* algemene browserinstellingen.

Houd de uitleg compact en apparaatafhankelijk.

### Position unavailable

```text
Je telefoon kan op dit moment geen locatie bepalen. Ga naar een open plek en probeer opnieuw.
```

### Timeout

```text
Het bepalen van je locatie duurde te lang. Probeer het opnieuw.
```

### Slechte accuracy

Toon:

* gemeten accuracy;
* gewenste accuracy;
* opnieuw proberen;
* handmatige locatiecontrole.

### Buiten geofence

Toon:

* geschatte afstand;
* geen exacte pijl of schijnnauwkeurige navigatie;
* routehint;
* externe kaartknop;
* opnieuw controleren.

## 8.4 Handmatige verificatie

Maak per stop een configureerbare observatievraag.

Voorbeeldstructuur:

```ts
manualVerification: {
  enabled: true,
  question: string,
  options?: string[],
  acceptedAnswers?: string[],
  successMessage: string
}
```

Gebruik geen universele overslaanknop.

Registreer:

```text
unlock_method = manual
```

---

# 9. Finalevoorwaarden afdwingen

De finale bij Bossche Brouwers mag niet alleen visueel vergrendeld zijn.

## 9.1 Centrale regel

Maak één centrale pure functie:

```ts
canStartFinale(gameProgress): FinaleEligibility
```

Deze controleert:

* alle vereiste voorgaande stops voltooid;
* alle vereiste rewards verzameld;
* finale niet al ongeldig gemarkeerd;
* locatie via GPS of handmatige verificatie geopend;
* gamepackversie komt overeen.

## 9.2 Bescherming op meerdere niveaus

Controleer de finalevoorwaarden:

* bij tonen van routeoverzicht;
* bij direct navigeren naar de finale-URL;
* bij laden van de finalepagina;
* bij indienen van het finaleantwoord;
* bij synchroniseren van `game_completed`.

Een gebruiker mag de finale niet starten door alleen een URL te typen.

## 9.3 Terugkoppeling

Wanneer voorwaarden ontbreken, toon precies wat nog nodig is:

```text
Nog 2 opdrachten te voltooien
```

Geen technische identifiers tonen.

## 9.4 Brouwvolgorde

Implementeer de configureerbare volgordeopdracht:

1. schroten;
2. maischen;
3. filteren;
4. koken;
5. koelen;
6. gisten.

Houd inhoud eenvoudig aanpasbaar.

Ondersteun:

* drag-and-drop;
* omhoog- en omlaagknoppen;
* reset;
* indienen;
* foutfeedback;
* score;
* hints.

## 9.5 Afronden

Een spel mag maar één keer definitief worden afgerond.

Herhaald openen van de finale mag:

* de bestaande uitslag tonen;
* geen extra score geven;
* geen tweede completion-event aanmaken;
* de eindtijd niet overschrijven.

---

# 10. Resultaatkaart volledig implementeren

De huidige minimale resultaatweergave moet een bruikbare eindervaring worden.

## 10.1 Inhoud

Toon:

* titel “Het Geheim van de Moerasdraak”;
* teamnaam;
* datum;
* totaalscore;
* speeltijd;
* aantal hints;
* aantal foutieve pogingen;
* zeven verzamelde symbolen;
* samengesteld fantasiewezen;
* route afgerond bij Bossche Brouwers;
* digitale etikettekst.

Voorbeeld:

```text
MOERASDRAAK
Team De Verdwaalde Oetels

Gebrouwen met water, moed,
verbeelding en een sterk verhaal.
```

## 10.2 Visueel

Maak een responsive HTML/CSS-resultaatkaart in ongeveer een staande 4:5-verhouding.

Gebruik:

* duidelijke typografie;
* draak-/watermotief;
* messing- of goudaccent;
* industriële details;
* geen gelicentieerde brouwerijlogo’s zonder aangeleverd bestand;
* geen automatisch gebruik van officiële merken of huisstijlen.

## 10.3 Export

Implementeer export als afbeelding.

Gebruik bij voorkeur een kleine bestaande dependency wanneer betrouwbaar exporteren zonder library onnodig complex wordt.

Voeg geen zware generieke grafische library toe.

Ondersteun:

* PNG genereren;
* downloaden;
* Web Share API waar bestanddelen ondersteund worden;
* fallback naar downloaden;
* tekstsamenvatting kopiëren.

## 10.4 Foutafhandeling

Wanneer afbeeldingsexport mislukt:

* blijft de resultaatpagina bruikbaar;
* kan tekst worden gekopieerd;
* verschijnt een menselijke foutmelding;
* wordt de score niet opnieuw berekend of verloren.

## 10.5 Hervatten

Een afgerond team moet later direct zijn bestaande resultaat kunnen openen.

Bewaar alle benodigde resultaatdata lokaal én in Supabase.

---

# 11. PWA-installatieflow afmaken

## 11.1 Installatiestatus

Detecteer:

* standalone mode;
* `beforeinstallprompt`;
* iOS Safari;
* browser zonder installatiemogelijkheid;
* eerder gesloten installatiemelding.

## 11.2 Android en Chromium

Bewaar het `beforeinstallprompt`-event.

Toon een duidelijke maar niet blokkerende installatiekaart.

Na klikken:

* roep de prompt aan;
* verwerk accepted of dismissed;
* toon niet direct opnieuw na afwijzen.

Gebruik een cooldown, bijvoorbeeld zeven dagen.

## 11.3 iOS

Toon alleen op passende iOS-browsercontext:

```text
Tik op het deelicoon en kies ‘Zet op beginscherm’.
```

Gebruik eventueel een eenvoudige illustratie met eigen CSS/SVG.

Toon dit niet:

* in standalone mode;
* op Android;
* op desktop;
* nadat gebruiker instructie recent heeft gesloten.

## 11.4 Spel niet blokkeren

Installeren blijft optioneel.

Een team moet:

* in de browser kunnen starten;
* routepakket kunnen voorbereiden;
* voortgang kunnen opslaan;
* het hele spel kunnen voltooien.

## 11.5 Appupdates

Wanneer een nieuwe service worker wacht:

* toon een updatebanner;
* herlaad niet automatisch;
* disable update alleen niet permanent;
* laat gebruiker zelf bijwerken;
* waarschuw wanneer een opdracht actief is;
* sla eerst lokale voortgang op;
* activeer update;
* herlaad daarna gecontroleerd.

---

# 12. Audioflow robuuster maken

Echte opnames blijven handmatig, maar de volledige technische flow moet werken.

## 12.1 Placeholderstatus

Markeer in de game-data expliciet of audio:

* definitief;
* placeholder;
* ontbrekend;

is.

Bij placeholder of ontbrekend:

* toon transcript;
* toon geen kapotte audiospeler;
* maak developmentwaarschuwing zichtbaar;
* laat productie schoon en begrijpelijk blijven.

## 12.2 Eén speler tegelijk

Gebruik een centrale audiomanager.

Bij starten van nieuw fragment:

* pauzeer vorig fragment;
* reset indien nodig;
* werk UI-status bij.

## 12.3 Navigatie

Stop audio bij:

* verlaten van de stop;
* sluiten van modal;
* wisselen naar nieuwe opdracht;
* afronden van stop.

## 12.4 Offline

Controleer dat definitieve audio na het voorbereiden uit Cache Storage kan worden afgespeeld.

Gebruik geen streamingvereiste voor korte verhaalfragmenten.

---

# 13. Definitieve iconen en afbeeldingen voorbereiden

Codex kan geen echte fotografie of definitieve illustratiekeuze verzorgen, maar moet wel de technische en visuele placeholders afronden.

## 13.1 PWA-iconen

Maak nette eigen SVG-broniconen met:

* eenvoudige drakensilhouet;
* watergolf;
* goed contrast;
* geen tekst in het kleine pictogram.

Genereer of documenteer benodigde formaten:

```text
192x192
512x512
maskable 512x512
apple-touch-icon
favicon
```

Wanneer automatische rastergeneratie beschikbaar is in het project, genereer deze bestanden.

Gebruik geen pictogrammen van de vriendenweekend-app.

## 13.2 Afbeeldingsfallback

Maak een herbruikbare afbeeldingscomponent die:

* lazy loading gebruikt;
* aspect ratio bewaakt;
* placeholder toont;
* alttekst vereist;
* ontbrekende bestanden netjes opvangt.

## 13.3 Assetdocumentatie

Werk `docs/media-assets.md` of het bestaande audiodocument bij met:

* vereiste afbeeldingen;
* bestandsnamen;
* aanbevolen afmetingen;
* locatie;
* gebruik;
* rechtenstatus;
* placeholderstatus.

---

# 14. Domein en deployment corrigeren

Gebruik voor deze PWA niet automatisch:

```text
vriendenweekend.markvermeltfoort.nl
```

De standaarddoelnaam voor deze app is:

```text
denbosch.markvermeltfoort.nl
```

of een via environment/config ingestelde zelfstandige subdomainnaam.

## 14.1 CNAME

Maak alleen een `CNAME` met:

```text
denbosch.markvermeltfoort.nl
```

wanneer dit de afgesproken production deployment is.

Zet de domeinnaam anders configureerbaar en documenteer de stap.

## 14.2 Vite base

Controleer dat:

* custom domain vanaf `/` werkt;
* previewdeployment eventueel met repository-base kan werken;
* manifest `start_url` en `scope` overeenkomen;
* service-worker-scope correct is.

## 14.3 Geen conflicten

Controleer expliciet dat:

* manifest uniek is;
* servicworkerregistratie uniek is;
* caches unieke namen hebben;
* localStorage-keys een Moerasdraak-prefix hebben;
* IndexedDB een unieke databasenaam heeft;
* Supabase-tabellen `city_game_`-prefix gebruiken.

---

# 15. Automatische game-data-validatie

Voeg een validatiefunctie en tests toe voor het routepakket.

Controleer minimaal:

* unieke stop-id’s;
* unieke volgordenummers;
* geldige startstop;
* geldige finalestop;
* finale staat als laatste;
* GPS-straal is positief;
* maximale accuracy is positief;
* ontbrekende coördinaten zijn gemarkeerd als te verifiëren;
* elke challenge heeft een valide configuratie;
* elk routepunt heeft minstens één fallback;
* alle lokale assets hebben geldige paden;
* alle beloningssymbolen zijn uniek waar vereist;
* antwoordsets zijn niet leeg;
* finalevoorwaarden verwijzen naar bestaande stops.

Laat development vroeg en duidelijk falen bij ongeldige game-data.

Laat productie een gebruikersvriendelijke foutpagina tonen in plaats van een wit scherm.

---

# 16. Testdekking uitbreiden

Voeg tests toe voor alle nu afgeronde kritieke flows.

## 16.1 Teams

* geldige teamnaam;
* ongeldige teamnaam;
* joincode normaliseren;
* lokaal team hervatten;
* cloudteam samenvoegen;
* lokaal verwijderen;
* dubbele submit voorkomen.

## 16.2 Synchronisatie

* queue-item toevoegen;
* succesvolle sync verwijderen;
* tijdelijke fout bewaren;
* retrycounter verhogen;
* dubbele event-id;
* offline geen request;
* conflict zet voortgang niet terug;
* completed-event geeft niet dubbel score.

## 16.3 Offline

* assetmanifest samenstellen;
* succesvolle cache;
* gedeeltelijk mislukte cache;
* retry;
* ontbrekende placeholderaudio;
* oude eigen cache verwijderen;
* vreemde cache ongemoeid laten.

## 16.4 Finale

* finale geblokkeerd zonder stops;
* finale geblokkeerd zonder locatiecheck;
* finale beschikbaar na vereisten;
* directe URL wordt tegengehouden;
* juiste brouwvolgorde;
* foutieve volgorde;
* dubbele afronding geeft geen dubbele score.

## 16.5 Resultaat

* resultaatdata berekenen;
* afgerond resultaat hervatten;
* exportfallback;
* tekstsamenvatting;
* totaal hints en pogingen.

## 16.6 PWA

Test pure detectiehulpfuncties voor:

* standalone;
* iOS;
* installatie beschikbaar;
* cooldown;
* update veilig toepassen.

Browser-specifieke installatieprompts mogen in de handmatige checklist blijven.

---

# 17. Handmatige gegevens duidelijk isoleren

Na deze implementatie mogen alleen onderstaande zaken nog echt handmatig nodig zijn.

## 17.1 GPS

Per routepunt:

* echte positie ter plaatse meten;
* accuracy op verschillende toestellen testen;
* geofence-radius controleren;
* fallbackvraag inhoudelijk controleren.

Maak één centraal configuratiebestand of datadeel waarin dit eenvoudig aangepast kan worden.

## 17.2 Audio

Per fragment:

* tekst definitief maken;
* stem opnemen;
* MP3 exporteren;
* bestand op verwachte plek zetten;
* transcript controleren;
* offline download testen.

## 17.3 Content en fotografie

* definitieve foto’s of illustraties kiezen;
* gebruiksrechten controleren;
* altteksten controleren;
* observatievragen ter plaatse testen.

## 17.4 Supabase-configuratie

* project aanmaken;
* URL invullen;
* anon key invullen;
* migraties uitvoeren;
* anonymous authentication activeren;
* policies testen.

De code, migraties en documentatie hiervoor moeten wel volledig klaarstaan.

## 17.5 DNS

* DNS-record maken;
* GitHub Pages custom domain instellen;
* HTTPS-certificaat controleren.

## 17.6 Fysieke routecontrole

* veiligheid;
* bereikbaarheid;
* werkzaamheden;
* openingstijden;
* toegankelijkheid;
* loopafstand;
* finale bij Bossche Brouwers.

Alle andere eerder genoemde beperkingen moeten door deze opdracht worden opgelost.

---

# 18. Documentatie actualiseren

Werk minimaal bij:

```text
README.md
docs/architecture.md
docs/deployment.md
docs/gps-calibration.md
docs/audio-assets.md
docs/test-checklist.md
```

Voeg indien nog niet aanwezig toe:

```text
docs/supabase-setup.md
docs/offline-behaviour.md
docs/manual-content-checklist.md
```

## README

Beschrijf:

* lokale start;
* lokale modus zonder Supabase;
* Supabase-modus;
* teamflow;
* offline routepakket;
* GPS-simulator;
* PWA-installatie;
* build;
* deployment;
* testcommando’s.

## Supabase-handleiding

Geef concrete stappen voor:

* project aanmaken;
* environment variables;
* migraties;
* anonymous authentication;
* RLS-test;
* lokaal testen;
* resetten van testdata.

## Handmatige checklist

Maak een afvinkbare tabel met alle zeven stops en kolommen voor:

* GPS gemeten;
* accuracy getest;
* radius goedgekeurd;
* routehint gecontroleerd;
* handmatige verificatie gecontroleerd;
* audio geplaatst;
* transcript gecontroleerd;
* afbeelding geplaatst;
* veiligheidscontrole;
* inhoud goedgekeurd.

---

# 19. Uitvoervolgorde

Werk in deze volgorde:

1. huidige code en open punten controleren;
2. centrale types en game-data-validatie;
3. team aanmaken en hervatten;
4. offline-first lokale voortgang;
5. volledige syncqueue;
6. Supabase-migraties, RPC en RLS;
7. GPS-provider en simulator;
8. permission- en fallback-UX;
9. finalevoorwaarden;
10. resultaatkaart en export;
11. offline assetpakket;
12. PWA-installatie en updates;
13. audiofallbacks;
14. iconen en assetfallbacks;
15. tests;
16. documentatie;
17. productiebuild.

Voer na iedere groep gerichte tests uit.

Voer aan het einde uit:

```bash
npm run lint
npm run test
npm run build
```

Voer daarnaast bestaande typecheck- of validatiecommando’s uit wanneer aanwezig.

---

# 20. Definition of Done voor deze vervolgronde

Deze opdracht is pas afgerond wanneer:

1. Een team volledig lokaal kan worden aangemaakt.
2. Een team na sluiten van de app kan worden hervat.
3. Een team via joincode uit Supabase kan worden geladen.
4. De app zonder Supabase blijft werken.
5. Alle spelacties eerst lokaal worden opgeslagen.
6. De synchronisatiequeue werkelijk data naar Supabase synchroniseert.
7. Synchronisatie idempotent is.
8. Voortgang bij conflicten nooit terugloopt.
9. Synchronisatiestatus zichtbaar is.
10. Handmatig opnieuw synchroniseren werkt.
11. Het offline routepakket werkelijk assets cachet.
12. De app na voorbereiding offline opnieuw geopend kan worden.
13. De GPS-simulator in development werkt.
14. Permission denied, timeout, slechte accuracy en buiten-geofence apart worden afgehandeld.
15. Iedere stop een handmatige locatieverificatie kan hebben.
16. De finale technisch wordt geblokkeerd zolang vereisten ontbreken.
17. Directe navigatie naar de finale geen beveiliging omzeilt.
18. Afronden niet dubbel score of events geeft.
19. De resultaatkaart volledig bruikbaar is.
20. De resultaatkaart als PNG geëxporteerd kan worden.
21. Delen of een betrouwbare fallback werkt.
22. Het eindresultaat later opnieuw geopend kan worden.
23. De installatiestroom op ondersteunde Chromium-browsers werkt.
24. iOS passende installatie-instructies krijgt.
25. Een update nooit ongemerkt midden in een opdracht herlaadt.
26. Ontbrekende audio een transcriptfallback gebruikt.
27. PWA-iconen en image fallbacks aanwezig zijn.
28. De app geen cache- of opslagconflict met de vriendenweekend-app heeft.
29. De custom-domainconfiguratie standaard naar `denbosch.markvermeltfoort.nl` verwijst of duidelijk configureerbaar is.
30. Kritieke flows tests hebben.
31. Lint slaagt.
32. Tests slagen.
33. Productiebuild slaagt.
34. Documentatie aansluit op de daadwerkelijke implementatie.
35. Alleen werkelijk fysieke of externe configuratietaken nog handmatig overblijven.

---

# 21. Eindrapportage

Gebruik na afronding exact deze indeling.

## Afgerond

Maximaal vijftien korte bullets met daadwerkelijk werkende functionaliteit.

## Belangrijkste wijzigingen

Noem alleen relevante bestanden en mappen.

## Database

Noem:

* migraties;
* RPC’s;
* RLS;
* nog uit te voeren Supabase-stappen.

## Uitgevoerde controles

Rapporteer het concrete resultaat van:

```text
lint
tests
build
```

Noem aantallen tests wanneer beschikbaar.

## Alleen nog handmatig nodig

Deze lijst mag uitsluitend externe of fysieke taken bevatten:

* echte GPS-metingen;
* echte audio-opnames;
* definitieve content/media;
* Supabase-projectgegevens;
* DNS/Pages-configuratie;
* fysieke routecontrole.

Zet hier geen programmeerwerk meer onder.

## Bekende beperkingen

Noem alleen beperkingen die bewust buiten het MVP vallen.

Gebruik niet opnieuw formuleringen als:

```text
nog minimaal
skeleton
nog niet volledig
later uitwerken
```

voor onderdelen die volgens deze opdracht onderdeel van de Definition of Done zijn.

Commit en push niets tenzij daar expliciet opdracht voor is gegeven.
