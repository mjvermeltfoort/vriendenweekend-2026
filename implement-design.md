# Codex-opdracht: implementeer het Moerasdraak-design

Implementeer het aangeleverde designconcept in de bestaande PWA **Het Geheim van de Moerasdraak**.

De referentieafbeelding staat in de repository als:

```text
docs/design-reference.png
```

Gebruik deze afbeelding als belangrijkste visuele referentie voor:

* sfeer;
* kleuren;
* typografie;
* schermindeling;
* knoppen;
* kaarten;
* navigatie;
* iconografie;
* voortgang;
* hintdialogen;
* opdrachtweergave;
* eindresultaat.

De bestaande technische functionaliteit is leidend en moet behouden blijven.

---

# 1. Hoofddoel

Geef de huidige werkende PWA een samenhangend visueel ontwerp dat sterk overeenkomt met het designconcept:

* donker en mysterieus;
* middeleeuws;
* Bossche historie;
* draken en water;
* goudkleurige details;
* donkergroene oppervlakken;
* perkament voor verhaal en opdrachten;
* industriële details richting Bossche Brouwers;
* goed leesbaar en bruikbaar op een mobiele telefoon.

De app moet eruitzien als een professioneel mobiel avonturenspel en niet als een generieke webapp.

---

# 2. Belangrijkste beperking

Dit is primair een **design- en frontendopdracht**.

Behoud bestaande functionaliteit voor:

* teams;
* spelvoortgang;
* GPS;
* handmatige locatiecontrole;
* audio;
* hints;
* scores;
* offline caching;
* IndexedDB;
* Supabase;
* synchronisatie;
* finalevoorwaarden;
* resultaatexport;
* PWA-installatie.

Voer geen brede technische refactor uit.

Wijzig businesslogica alleen wanneer dit strikt noodzakelijk is om bestaande functionaliteit correct in de nieuwe interface te tonen.

---

# 3. Efficiënt token- en contextgebruik

Werk gericht.

Bekijk eerst alleen:

* `package.json`;
* globale styling;
* bestaande design tokens;
* app-shell;
* routing;
* algemene componenten;
* startpagina;
* routepagina;
* stopscherm;
* opdrachtscherm;
* hintdialog;
* teamscherm;
* resultaatpagina;
* PWA-installatiecomponent;
* GPS-statuscomponent;
* synchronisatiestatus.

Gebruik `rg`, `find` en gerichte bestandslezingen.

Lees geen grote bestanden volledig wanneer alleen een onderdeel nodig is.

Maak eerst maximaal:

* 10 bevindingen;
* 10 concrete implementatiestappen;
* 5 risico’s.

Begin daarna direct met implementeren.

Vermijd:

* herhaald analyseren;
* volledige bestanden opnieuw genereren zonder noodzaak;
* formatteringswijzigingen buiten aangepaste code;
* nieuwe dependencies voor kleine visuele details;
* uitleg na iedere kleine wijziging.

---

# 4. Designrichting

## 4.1 Algemene sfeer

Het ontwerp moet aanvoelen als:

```text
middeleeuws mysterie
+ Bossche stadslegendes
+ duistere draak
+ verborgen water
+ elegante escape-room
+ modern mobiel gebruiksgemak
```

Het mag sfeervol en donker zijn, maar nooit slecht leesbaar.

Vermijd een goedkope Halloween-, fantasy- of casinostijl.

Gebruik decoratie beheerst. Primaire acties en teksten moeten altijd duidelijk blijven.

---

# 5. Kleurenpalet

Maak centrale CSS-variabelen of bestaande design tokens.

Gebruik ongeveer dit kleurenpalet:

```css
:root {
  --color-background: #07100d;
  --color-background-deep: #030806;
  --color-surface: #0c1813;
  --color-surface-raised: #10221b;
  --color-surface-green: #12392c;

  --color-gold: #c4974d;
  --color-gold-light: #e0bc78;
  --color-gold-dark: #765326;

  --color-parchment: #d7c097;
  --color-parchment-light: #e7d6b4;
  --color-parchment-dark: #a98b5c;
  --color-parchment-text: #352617;

  --color-text: #ead8af;
  --color-text-strong: #f4e6c5;
  --color-text-muted: #ad9a74;

  --color-success: #5e9b76;
  --color-warning: #c4974d;
  --color-error: #b66655;

  --color-border: rgba(196, 151, 77, 0.55);
  --color-border-subtle: rgba(196, 151, 77, 0.22);
  --color-overlay: rgba(2, 7, 5, 0.82);
}
```

Gebruik goud voornamelijk voor:

* randen;
* titels;
* iconen;
* voortgangsdetails;
* actieve statussen;
* belangrijke accenten.

Gebruik goud niet als grote felle achtergrond.

---

# 6. Typografie

Gebruik bij voorkeur:

```text
Titels: Cinzel
Lopende tekst: Lora
Interface-elementen: Lora of goed leesbare systeemfont
```

Wanneer deze fonts al aanwezig zijn, hergebruik ze.

Wanneer externe fonts nog niet worden gebruikt:

* voeg alleen deze twee fonts toe;
* zorg voor goede fallbacks;
* blokkeer rendering niet;
* cache fonts via de PWA wanneer lokaal of extern gebruikt.

Fallbacks:

```css
--font-title: "Cinzel", Georgia, serif;
--font-body: "Lora", Georgia, serif;
--font-ui: "Lora", system-ui, sans-serif;
```

Gebruik sierlijke typografie alleen voor:

* paginatitels;
* hoofdstuktitels;
* kaarttitels;
* resultaten.

Gebruik geen sierlijke hoofdletters voor lange alinea’s.

---

# 7. Globale app-shell

Maak een herbruikbare mobiele app-shell.

Deze bevat:

* donkere achtergrond;
* subtiele textuur;
* centrale contentkolom;
* veilige ruimte voor iPhone safe areas;
* vaste visuele identiteit;
* optionele topbar;
* optionele onderste navigatie.

Gebruik:

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

De app moet goed werken vanaf ongeveer:

```text
320 px schermbreedte
```

Primair optimaliseren voor:

```text
360–430 px
```

Desktopweergave mag de mobiele app gecentreerd tonen, maar niet als uitgerekte website.

Gebruik op grotere schermen een maximale contentbreedte van ongeveer:

```text
480–520 px
```

---

# 8. Achtergrond en texturen

De referentie gebruikt subtiele donkere texturen.

Implementeer dit bij voorkeur met lichte CSS-effecten:

* zachte radiale achtergrond;
* subtiele vignette;
* fijne ruistextuur;
* zeer subtiel draakschubbenpatroon;
* geen grote zware achtergrondafbeelding nodig.

Gebruik pseudo-elementen en CSS-gradients waar mogelijk.

Voorbeeldrichting:

```css
background:
  radial-gradient(circle at top, rgba(27, 69, 52, 0.2), transparent 42%),
  linear-gradient(180deg, #08120e 0%, #030806 100%);
```

Voeg eventueel één zeer kleine herhaalbare textuur toe wanneer dit aantoonbaar beter oogt.

De app moet snel blijven laden.

---

# 9. Gouden kaders

Maak een herbruikbare component voor decoratieve randen.

Voorbeelden:

```text
OrnamentalPanel
OrnamentalButton
OrnamentalHeader
ParchmentCard
```

De gouden randen moeten:

* dun zijn;
* hoekaccenten kunnen hebben;
* voldoende contrast geven;
* niet overdreven glanzen;
* geen zware schaduwen gebruiken.

Gebruik bij voorkeur CSS:

* borders;
* pseudo-elementen;
* kleine hoeklijnen;
* inset shadows.

Geen complexe grote SVG-rand voor iedere kaart.

---

# 10. Knoppen

## Primaire knop

Ontwerp zoals in de referentie:

* donkergroene achtergrond;
* goudkleurige rand;
* goudkleurige tekst;
* lichte hoekversiering;
* minimaal 48 px hoog;
* volledige breedte waar passend;
* duidelijke pressed-, focus- en disabled-state.

Voorbeeldcomponent:

```text
OrnamentalButton
```

Varianten:

```text
primary
secondary
ghost
danger
```

## Primaire stijl

```css
background: linear-gradient(180deg, #164433, #0d2e23);
border: 1px solid var(--color-gold);
color: var(--color-gold-light);
```

## Interactie

* subtiele verschuiving of donkere tint bij indrukken;
* geen grote hoveranimaties op mobiel;
* duidelijke toetsenbordfocus;
* loading-state zonder wijziging van knopbreedte.

---

# 11. Iconografie

Gebruik één consistente iconenstijl.

Gebruik bestaande iconenlibrary alleen wanneer deze al geïnstalleerd is.

Anders:

* gebruik eenvoudige inline SVG-iconen;
* maak geen nieuwe iconenlibrarydependency;
* gebruik goudkleurige lijniconen.

Benodigde iconen:

* draak;
* kaartpin;
* perkament;
* sleutel;
* lamp/hint;
* schild;
* route/kompas;
* team;
* score/ster;
* klok;
* munt;
* informatie;
* audio;
* GPS;
* offline;
* synchronisatie;
* menu;
* terug;
* delen.

Maak een eigen eenvoudig draakembleem als SVG.

Gebruik geen beschermd logo van Bossche Brouwers.

---

# 12. Startscherm

Bouw het startscherm op basis van het linkerbovenpaneel uit het concept.

## Structuur

Bovenaan:

* grote hero-sectie;
* donkere Bossche skyline;
* silhouet of illustratie van de Moerasdraak;
* subtiele mist;
* Sint-Jan herkenbaar, maar gebruik eigen of rechtenvrije illustratie.

Daaronder:

```text
HET GEHEIM VAN DE
MOERASDRAAK
DEN BOSCH
```

Subtitel:

```text
Een escape the city-avontuur
vol raadsels, geheimen en
Bossche legendes.
```

Primaire knop:

```text
BEGIN AVONTUUR
```

Secundaire actie:

```text
Hoe werkt het?
```

Toon eventueel:

* geschatte speelduur;
* afstand;
* aantal opdrachten;
* eindlocatie.

Bijvoorbeeld:

```text
2–2,5 uur
circa 4 km
7 opdrachten
finale bij Bossche Brouwers
```

Zorg dat een bestaand team ook een duidelijke actie krijgt:

```text
Verder met team [teamnaam]
```

---

# 13. Verhaalschermen

Gebruik een perkamentachtig verhaalspaneel.

## Opbouw

* donkere buitenachtergrond;
* terugknop;
* titel in goud;
* perkamentillustratie of kaart bovenaan;
* verhaaltitel in groen of donkerbruin;
* leesbare tekst;
* primaire knop onderaan.

Voorbeeld:

```text
DE MOERASDRAAK
```

Het perkament mag onregelmatige randen suggereren, maar:

* geen onleesbare gescheurde vorm;
* geen tekst over drukke illustraties;
* geen zware bitmap nodig.

Gebruik eventueel een CSS-mask of lichte SVG-rand.

---

# 14. Routeoverzicht

Het routescherm moet aansluiten op het middelste bovenpaneel uit de referentie.

Bovenaan:

* titel `ROUTE`;
* menuknop;
* eventuele schildbadge;
* tabs `KAART` en `LIJST`.

## Kaartweergave

Wanneer al een echte kaartcomponent bestaat:

* pas alleen de styling aan;
* gebruik donkere kaartoverlay;
* toon routepunten als groene/gouden medaillons;
* huidige stop duidelijk accentueren;
* voltooide stops herkenbaar maken;
* finale als bijzonder goud/oranje routepunt tonen.

Wanneer geen kaartcomponent bestaat:

* maak geen nieuwe zware kaartintegratie;
* gebruik de bestaande lijst of een eenvoudige schematische routeweergave.

## Routepuntmarker

Statussen:

```text
locked
available
current
completed
final
```

Ontwerp:

* rond medaillon;
* gouden rand;
* donker groene basis;
* nummer centraal;
* vinkje bij voltooid;
* slot bij locked;
* finale met gebouw-, vat- of brouwerijicoon.

## Onderste routekaart

Toon:

* nummer stop;
* naam;
* afstand;
* routehint;
* primaire actie.

Voorbeeld:

```text
Volgende stop
Zoete Lieve Gerritje
450 m
```

---

# 15. Lijstweergave route

Maak een visuele route-tijdlijn.

Per routepunt:

* rond nummermedaillon;
* titel;
* korte locatie;
* status;
* reward-icoon;
* eventueel afstand.

Voltooide punten:

* zachter groen;
* vinkje;
* verzamelde herinnering.

Huidige punt:

* gouden rand;
* subtiele gloed;
* primaire actie.

Vergrendelde punten:

* lager contrast;
* slot;
* geen onnodige details of spoilertekst.

---

# 16. Opdrachtscherm

Bouw opdrachten zoals het middelste paneel in de referentie.

## Bovenbalk

Toon:

```text
OPDRACHT
2 / 7
```

Verder:

* terugknop;
* schildicoon;
* eventueel score.

## Hoofdkaart

Gebruik een grote perkamentkaart met:

* opdrachttitel;
* verhalende uitleg;
* afbeelding;
* interactie;
* feedback;
* primaire knop;
* hintactie.

De perkamentkaart gebruikt donkere tekst.

## Afbeelding

* afgeronde subtiele hoeken;
* vaste aspect ratio;
* goede fallback;
* geen grote schaduw;
* volledige breedte binnen perkament.

## Antwoordvelden

Maak antwoordvakjes duidelijk en groot.

Voor code-invoer:

* vierkante invoervelden;
* donkere of lichte perkamentkleur;
* duidelijke focusrand;
* mobiel toetsenbord passend bij invoertype.

## Primaire actie

```text
CONTROLEER ANTWOORD
```

## Hintknop

```text
HINT GEBRUIKEN
```

Toon de kosten compact:

```text
−1 draakmunt
```

Of, wanneer het bestaande spel punten gebruikt:

```text
−100 punten
```

Gebruik de bestaande scorelogica als bron van waarheid.

---

# 17. Opdrachtfeedback

## Goed antwoord

Toon een sfeervolle successtate:

* groen/goud;
* reward-symbool;
* verzamelde herinnering;
* korte verhaaltekst;
* knop naar volgende routepunt.

Voorbeeld:

```text
HERINNERING HERSTELD
Water
```

## Fout antwoord

Toon:

* menselijke feedback;
* geen harde rode foutpagina;
* subtiel warm rood;
* aantal pogingen wanneer relevant;
* opnieuw proberen;
* hintmogelijkheid.

Animaties moeten kort en optioneel zijn.

Respecteer:

```css
prefers-reduced-motion
```

---

# 18. Hintdialog

Implementeer zoals het rechter middenpaneel.

De dialog bevat:

* donkere achtergrond;
* gouden rand;
* sluitknop;
* groot hinticoon;
* titel `HINT`;
* kosten;
* bevestiging;
* annuleren;
* resterende draakmunten of score-impact.

Voorbeeldtekst:

```text
Een hint kost 1 draakmunt.
Weet je het zeker?
```

Knop:

```text
HINT TONEN
```

Gebruik een echte toegankelijke dialog:

* focus trap;
* escape-toets;
* focus terug naar oorspronkelijke knop;
* goede aria-labels.

Gebruik geen native `window.confirm`.

---

# 19. GPS-scherm en locatiecontrole

Geef de GPS-flow dezelfde visuele stijl.

## Zoeken naar locatie

Toon:

* kompas- of pinicoon;
* subtiele pulserende cirkel;
* tekst `Je locatie wordt bepaald`;
* knop `Annuleren` wanneer mogelijk.

## Binnen bereik

Toon:

```text
LOCATIE GEVONDEN
```

Met:

* groen/gouden bevestiging;
* afstand;
* knop om opdracht te openen.

## Buiten bereik

Toon:

* geschatte afstand;
* routehint;
* knop naar externe kaart;
* `Opnieuw controleren`.

## Slechte nauwkeurigheid

Toon een duidelijke maar rustige waarschuwing.

Gebruik niet alleen technische GPS-termen.

## Handmatige controle

Plaats deze als secundaire actie:

```text
GPS werkt niet? Controleer de locatie handmatig
```

---

# 20. Audio

Pas de bestaande audioplayer visueel aan.

Stijl:

* donker paneel;
* gouden voortgang;
* grote play/pause-knop;
* transcriptknop;
* resterende tijd;
* audio-icoon.

Gebruik geen skeuomorfe audiocassette of zware decoratie.

Placeholderaudio:

* toon geen kapotte speler;
* toon een perkamentblok met transcript;
* label eventueel `Tekstversie`.

---

# 21. Teamsscherm

Baseer dit scherm op het rechteronderpaneel.

Toon:

* titel `TEAM`;
* teamnaam;
* bewerkicoon indien toegestaan;
* avatars of initialen;
* rol van eigenaar subtiel;
* voortgang;
* draakmunten of score;
* synchronisatiestatus.

Wanneer geen profielfoto’s bestaan:

* gebruik initialen;
* maak gekleurde of groene medaillons;
* geen stockfoto’s toevoegen.

## Voortgang

Toon:

```text
7 / 7 opdrachten voltooid
```

Met een goud/groene voortgangsbalk.

## Teamcode

Toon veilig:

* joincode;
* deelactie;
* korte uitleg.

Gebruik geen te grote prominence tijdens normaal spelen.

---

# 22. Onderste navigatie

Implementeer een mobiele navigatiebalk zoals in het concept.

Tabs:

```text
Route
Team
Kaart
Info
```

Pas de tabs aan op bestaande routes.

Bijvoorbeeld wanneer route en kaart gecombineerd zijn:

```text
Route
Team
Spel
Info
```

Eigenschappen:

* donker oppervlak;
* dunne gouden bovenrand;
* safe-area padding;
* goud of groen voor actieve tab;
* iconen boven labels;
* minimaal 48 px aanraakgebied;
* geen horizontale overflow.

Verberg de onderste navigatie waar dit logisch is:

* op startscherm;
* tijdens volledige verhaalintro;
* tijdens modals;
* eventueel tijdens resultaatsexport.

---

# 23. Informatie- en instellingenpagina

Gebruik overzichtelijke secties zonder zware dashboardstijl.

Mogelijke secties:

* Hoe werkt het?
* GPS en privacy
* Geluid
* Offline beschikbaarheid
* Installeren als app
* Synchronisatie
* Team herstellen
* Over deze route

Gebruik gouden sectietitels en donkere panelen.

Laat technische ontwikkelinformatie alleen in development zien.

---

# 24. Synchronisatiestatus

Integreer synchronisatiestatus subtiel.

Statussen:

```text
Alles opgeslagen
Lokaal opgeslagen
Synchroniseren
Offline
Synchronisatie mislukt
```

Gebruik:

* klein icoon;
* korte tekst;
* geen grote permanente melding.

Toon een duidelijke call-to-action alleen wanneer handmatige actie nodig is.

---

# 25. Offline voorbereiding

Maak het voorbereidingsscherm aantrekkelijk.

Gebruik:

* draakmedaillon;
* voortgangsbalk;
* lijst van onderdelen;
* vinkjes;
* foutstatus;
* opnieuw proberen.

Voorbeeld:

```text
SPEL VOORBEREIDEN

✓ Route opgeslagen
✓ Afbeeldingen opgeslagen
✓ Geluidsfragmenten opgeslagen
✓ Klaar voor vertrek
```

Toon downloadgrootte en voortgang alleen wanneer beschikbaar.

---

# 26. PWA-installatie

Pas bestaande installatiemeldingen visueel aan.

Gebruik een compacte kaart:

```text
Installeer de Moerasdraak
Sneller openen en beter offline spelen.
```

Acties:

```text
INSTALLEREN
LATER
```

Voor iOS:

* eigen compacte instructiedialog;
* deelicoon;
* `Zet op beginscherm`;
* geen generieke browsertekstmuur.

De installatie blijft optioneel.

---

# 27. Eindscherm

Baseer de eindervaring op het onderste middelste paneel uit het concept.

## Bovenaan

```text
AVONTUUR VOLTOOID!
```

Daaronder:

* groot draakmedaillon;
* korte afsluittekst;
* scoreoverzicht.

## Statistieken

Toon maximaal vier kerncijfers:

* tijd;
* hints;
* score;
* pogingen.

Gebruik iconen en korte labels.

## Resultaatkaart

Toon het digitale bieretiket als opvallend visueel onderdeel.

Tekst:

```text
MOERASDRAAK
Team [teamnaam]

Gebrouwen met water, moed,
verbeelding en een sterk verhaal.
```

Toon:

* samengesteld fantasiewezen;
* zeven symbolen;
* datum;
* finale bij Bossche Brouwers.

Acties:

```text
RESULTAAT DELEN
AFBEELDING OPSLAAN
TERUG NAAR HOME
```

Behoud bestaande canvasexport.

Verbeter alleen de visuele vormgeving en betrouwbaarheid waar nodig.

Bouw geen nieuwe screenshotrenderer.

---

# 28. Draakmunten

Het designconcept gebruikt draakmunten.

Controleer eerst de huidige spelmechaniek.

## Wanneer de app al punten gebruikt

Vervang niet automatisch het scoresysteem.

Gebruik draakmunten alleen als visuele representatie van hints wanneer dit zonder datamigratie mogelijk is.

Bijvoorbeeld:

```text
3 hints beschikbaar
```

kan visueel als drie draakmunten worden getoond.

## Wanneer draakmunten functioneel toegevoegd moeten worden

Voeg ze alleen toe als dunne presentatielaag boven de bestaande hintlimieten.

Maak geen nieuw economisch systeem.

Geen aankopen, betalingen of microtransacties.

---

# 29. Herbruikbare componenten

Maak of verbeter ongeveer deze componenten:

```text
GameShell
GameTopBar
BottomGameNavigation
OrnamentalButton
OrnamentalPanel
ParchmentCard
StoryCard
RouteMarker
RouteStopCard
ProgressMedallion
DragonCoin
DragonEmblem
HintDialog
AudioPanel
LocationStatus
SyncStatus
RewardBadge
ResultLabel
TeamAvatar
```

Maak geen component voor ieder klein tekstfragment.

Houd componenten eenvoudig en goed herbruikbaar.

---

# 30. Design tokens

Centraliseer minimaal:

* kleuren;
* fonts;
* spacing;
* radii;
* borders;
* shadows;
* z-index;
* animatieduur;
* contentbreedtes.

Voorbeeld:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;

  --radius-small: 6px;
  --radius-medium: 12px;
  --radius-large: 18px;

  --border-gold: 1px solid var(--color-border);

  --shadow-inset-gold:
    inset 0 0 0 1px rgba(224, 188, 120, 0.06);

  --duration-fast: 140ms;
  --duration-normal: 240ms;

  --content-width-mobile: 480px;
}
```

Gebruik geen tientallen bijna-identieke tinten.

---

# 31. Responsiviteit

Test minimaal:

```text
320 × 568
360 × 800
390 × 844
412 × 915
430 × 932
768 × 1024
desktop
```

Controleer:

* geen horizontaal scrollen;
* knoppen blijven zichtbaar;
* dialogen passen binnen scherm;
* onderste navigatie overlapt geen content;
* perkamentkaart schaalt goed;
* toetsenbord bedekt invoer niet permanent;
* safe areas werken;
* lange Nederlandse teksten breken goed af;
* grote systeemtekst blijft bruikbaar.

---

# 32. Toegankelijkheid

Behoud of verbeter:

* semantische HTML;
* toetsenbordbediening;
* labels;
* focus;
* aria-live;
* contrast;
* reduced motion;
* transcripts;
* alternatieven voor drag-and-drop;
* fouten niet alleen via kleur;
* minimaal 44 px touch targets.

Decoratieve SVG’s:

```text
aria-hidden="true"
```

Betekenisvolle iconen:

* toegankelijke naam;
* of zichtbare tekst ernaast.

Controleer dat goud op donkergroen voldoende contrast heeft. Gebruik voor kleine tekst eventueel de lichtere goudkleur of de normale tekstkleur.

---

# 33. Assets

De referentieafbeelding is inspiratie en mag niet rechtstreeks als appachtergrond of scherm worden gebruikt.

Maak de interface met echte HTML, CSS en SVG.

Gebruik voor definitieve illustraties:

* eigen assets;
* aangeleverde assets;
* rechtenvrije beelden;
* eenvoudige tijdelijke SVG-illustraties.

Documenteer ontbrekende assets in:

```text
docs/design-assets.md
```

Vermeld per asset:

* bestandsnaam;
* scherm;
* doel;
* aanbevolen formaat;
* huidige placeholder;
* definitief nog nodig.

---

# 34. Afbeeldingfouten

Alle afbeeldingen moeten gebruikmaken van de bestaande of verbeterde fallbackcomponent.

Bij ontbrekende afbeelding:

* behouden aspect ratio;
* toon donker illustratievlak;
* toon passend lijnicoon;
* geen broken-image-icoon;
* app blijft bruikbaar.

---

# 35. Animaties

Gebruik alleen subtiele animaties:

* mist langzaam bewegen;
* draakmedaillon heel licht ademen;
* routepunt beschikbaar worden;
* progressbar;
* dialog fade;
* succesreward.

Gebruik geen:

* grote bounce-effecten;
* langdurige introanimaties;
* parallax tijdens lopen;
* zware canvasanimaties;
* continu bewegende achtergrond die batterij verbruikt.

Respecteer reduced motion.

---

# 36. Bestaande functionaliteit koppelen

Gebruik bestaande applicatiestatus.

Maak geen losse statische demoversie.

Alle nieuwe schermen en componenten moeten gekoppeld worden aan echte data:

* echte teamnaam;
* echte voortgang;
* echte stop;
* echte score;
* echte hints;
* echte GPS-status;
* echte synchronisatiestatus;
* echte verzamelde rewards;
* echt samengesteld fantasiewezen;
* echte eindresultaten.

Gebruik alleen placeholders waar content of media werkelijk ontbreekt.

---

# 37. Design preview

Maak een development-only pagina:

```text
/dev/design-system
```

Alleen beschikbaar in development.

Toon daarop:

* kleuren;
* typografie;
* knoppen;
* panelen;
* perkamentkaart;
* iconen;
* routepunten;
* statussen;
* hintdialog;
* inputs;
* audioplayer;
* resultaatcomponent;
* teamavatars.

Deze pagina helpt om het design consistent te controleren.

Verwijder of blokkeer deze route in productie.

---

# 38. Visuele regressiecontrole

Wanneer het project al Playwright of screenshottests gebruikt:

* voeg enkele gerichte screenshots toe;
* startscherm;
* route;
* opdracht;
* hintdialog;
* resultaat.

Wanneer geen screenshot-infrastructuur bestaat:

* voeg die niet alleen voor deze opdracht toe;
* maak een handmatige visuele checklist.

Maak:

```text
docs/design-test-checklist.md
```

Checklist:

* startscherm;
* onboarding;
* team aanmaken;
* routekaart;
* routelijst;
* verhaalscherm;
* GPS zoeken;
* GPS fout;
* opdracht;
* fout antwoord;
* goed antwoord;
* hintdialog;
* audio;
* offline voorbereiding;
* team;
* installatie;
* resultaat;
* dark mode is niet apart nodig, want dit ontwerp is standaard donker.

---

# 39. Testen

Behoud alle bestaande tests.

Voeg alleen tests toe waar nieuwe presentatielogica gedrag bevat, bijvoorbeeld:

* navigatie active state;
* hintdialog openen/sluiten;
* installatiemelding sluiten;
* resultaatgegevens zichtbaar;
* fallbackafbeelding;
* synchronisatiestatus;
* GPS-statusmelding.

Test geen pure CSS-details met uitgebreide unit tests.

Voer uiteindelijk uit:

```bash
npm run lint
npm run test
npm run build
```

Voer ook bestaande typecheckcommando’s uit wanneer aanwezig.

---

# 40. Implementatievolgorde

Werk in deze volgorde:

1. huidige designstructuur inspecteren;
2. design tokens en fonts;
3. app-shell en achtergronden;
4. knoppen, panelen en iconen;
5. topbar en onderste navigatie;
6. startscherm;
7. verhaalsscherm;
8. routeoverzicht;
9. opdrachten;
10. hintdialog;
11. GPS-states;
12. audio;
13. team;
14. offline en installatie;
15. eindresultaat;
16. development-designpagina;
17. responsive correcties;
18. toegankelijkheid;
19. documentatie;
20. lint, tests en build.

Werk per stap bestaande schermen af. Maak niet eerst een volledig parallel designsysteem dat nog nergens gebruikt wordt.

---

# 41. Definition of Done

Deze opdracht is afgerond wanneer:

1. De app visueel duidelijk overeenkomt met `docs/design-reference.png`.
2. De app een consistente Moerasdraak-huisstijl heeft.
3. Het startscherm professioneel en sfeervol is.
4. Verhaalsteksten op perkamentachtige panelen staan.
5. Routepunten als medaillons herkenbaar zijn.
6. De huidige, voltooide en vergrendelde stop visueel verschillen.
7. Opdrachten volledig in de nieuwe stijl werken.
8. Hintdialogen toegankelijk en in stijl zijn.
9. GPS-states in de nieuwe stijl werken.
10. Audio en transcript in de stijl passen.
11. Teamnaam, voortgang en joincode goed zichtbaar zijn.
12. Offline- en synchronisatiestatussen duidelijk maar niet storend zijn.
13. Installatiemeldingen visueel geïntegreerd zijn.
14. Het eindresultaat een overtuigende digitale avonturenkaart en bieretiket bevat.
15. Bestaande spel-, GPS-, offline- en Supabase-functionaliteit behouden blijft.
16. De app geen statische mockup is, maar echte data gebruikt.
17. Alle primaire knoppen minimaal ongeveer 48 px hoog zijn.
18. De app bruikbaar is vanaf 320 px breedte.
19. Er geen horizontale overflow is.
20. Safe areas op iPhone worden gerespecteerd.
21. Focus en toetsenbordbediening blijven werken.
22. Reduced motion wordt gerespecteerd.
23. Afbeeldingfallbacks werken.
24. Ontbrekende audio blijft een nette tekstfallback tonen.
25. De designpreview in development beschikbaar is.
26. De productiebuild geen development-designroute blootstelt.
27. Geen onnodige zware dependencies zijn toegevoegd.
28. Geen bestaande tabellen, migraties of speldata onnodig zijn aangepast.
29. Lint slaagt.
30. Tests slagen.
31. Build slaagt.
32. Documentatie is bijgewerkt.

---

# 42. Eindrapportage

Gebruik na afronding exact deze indeling:

## Visueel afgerond

Maximaal vijftien korte bullets.

## Belangrijkste componenten

Noem alleen de belangrijkste aangepaste of nieuwe componenten.

## Schermen

Geef per scherm kort de status:

```text
Start
Route
Verhaal
Opdracht
Hint
GPS
Audio
Team
Offline
Installatie
Resultaat
```

## Bestaande functionaliteit

Bevestig welke bestaande flows behouden en handmatig gecontroleerd zijn.

## Uitgevoerde controles

Rapporteer:

```text
lint
tests
build
responsive controle
toegankelijkheidscontrole
```

## Nog handmatig nodig

Noem alleen:

* definitieve illustraties;
* definitieve fotografie;
* eventuele font- of mediarechten;
* visuele controle op echte telefoons;
* laatste contentcorrecties.

Zet hier geen programmeerwerk onder dat onderdeel is van deze opdracht.

## Bewuste afwijkingen van het concept

Noem alleen afwijkingen die nodig waren voor:

* gebruiksgemak;
* toegankelijkheid;
* prestaties;
* bestaande functionaliteit.

Commit of push niets tenzij daar expliciet opdracht voor is gegeven.
