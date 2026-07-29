# Playwright MCP testrapport

## Testomgeving

- Datum: 29 juli 2026
- Branch: `main`
- Commit: `733d6e041e5c638e75c57f31d83fda48081614cc`
- Browser: Chromium via Playwright MCP 1.62.0-alpha
- Viewports: 320×568, 360×800, 390×844, 430×932, 768×1024 en 1440×900
- URL: `https://vriendenweekend.markvermeltfoort.nl/escape-the-city/`
- Modus: productie, Supabase/cloudsync actief; testteam `Playwright Drakenvangers`
- Developmenttools: niet actief in de productiebuild
- Service worker: actief, scope `/escape-the-city/`, script `/escape-the-city/sw.js`

## Samenvatting

- P0: 2
- P1: 3
- P2: 6
- P3: 0
- Eindoordeel: afkeuren voor een volledige spelronde. De locatiepoort is te omzeilen, de voorgeschreven code van opdracht 5 wordt afgewezen en een onvoltooid spel kan rechtstreeks als voltooid resultaat worden geopend en geëxporteerd.

## Hertest na herstel

Hertest uitgevoerd op 29 juli 2026 tegen de productiebuild van commits
`79ce82a`, `bccaf61` en `85030fc`.

| Bevinding | Hertestresultaat |
|---|---|
| Resultaatroute vóór finale | Geslaagd: `#/resultaat` stuurt bij 4/7 terug naar `#/route` |
| Directe challenge zonder unlock | Geslaagd: toont “Controleer eerst jullie locatie” |
| Buiten geofence | Geslaagd: 5.769 km wordt leesbaar getoond en “Opdracht starten” is disabled |
| Bellende-engelcode `3142` | Geslaagd: opdracht 5 wordt voltooid en opdracht 6 ontgrendeld |
| Reguliere audio | Geslaagd: Kruithuis speelt, pauzeknop verschijnt en duur is 0:33 |
| Hoogcontrastmodus | Geslaagd: `data-contrast="high"` blijft na reload behouden |
| “Hoe werkt het?” | Geslaagd: 44 px hoog en focus gaat naar “Jullie avontuur” |
| Teamvalidatie | Geslaagd: alert en `aria-describedby` verdwijnen bij geldige invoer |
| Manifesticon | Geslaagd: juiste URL en HTTP 200 `image/svg+xml` |
| Kaartcontrols | Geslaagd: locatie- en zoomknoppen zijn 44 px |
| Kaartattributie-overlap | Geslaagd na cacheverversing: locatieknop eindigt op y=531, attributie begint op y=546 |
| Favicon | Geslaagd: expliciete SVG-favicon staat in de live HTML en antwoordt HTTP 200 |

Na herstel:

- `npm run lint`: geslaagd.
- `npm run test`: 16 testbestanden en 53 tests geslaagd.
- `npm run build`: geslaagd; alleen de bestaande waarschuwing voor chunks groter dan 500 kB blijft.
- Offline-contextwissel blijft door de gebruikte MCP-transportconfiguratie niet betrouwbaar automatiseerbaar.

## Blokkerende problemen

### [P0] Bellende-engelcode 3142 wordt afgewezen

- Scherm: opdracht 5, Het Hemelse Bericht
- Viewport: 390×844 en 320×568
- Stappen: open Sint-Jan, start opdracht, vul eerst `1234` en daarna `3142` in, activeer “Controleer antwoord”.
- Verwacht: `1234` wordt afgewezen en `3142` voltooit de opdracht.
- Werkelijk: beide codes geven `alert: Nog niet juist`; normale progressie stopt op 4/7.
- Bewijs: [09-bell-puzzle-390x844.png](playwright-mcp/09-bell-puzzle-390x844.png), [09-bell-puzzle-320x568.png](playwright-mcp/09-bell-puzzle-320x568.png)
- Console/network: daarnaast een 404 voor het manifesticon; geen relevante exception bij de codecontrole.
- Aanbevolen oplossing: corrigeer de verwachte antwoorddata/normalisatie en voeg een regressietest voor exact `3142` toe.

### [P0] Resultaatroute accepteert onvoltooide voortgang

- Scherm: resultaat
- Viewport: 390×844 en 1440×900
- Stappen: voltooi slechts vier opdrachten en navigeer direct naar `#/resultaat`.
- Verwacht: terugsturen naar route/finale met begrijpelijke ontbrekende voorwaarden.
- Werkelijk: “Avontuur voltooid!”, score 3750, tijd 0 min en slechts vier symbolen worden getoond. PNG-export werkt ook.
- Bewijs: [12-result-mobile.png](playwright-mcp/12-result-mobile.png), [12-result-desktop.png](playwright-mcp/12-result-desktop.png)
- Console/network: export maakt zonder fout `moerasdraak-resultaat.png` met canvas 1080×1350.
- Aanbevolen oplossing: valideer alle finalevoorwaarden en een opgeslagen finale-completion-event vóór renderen of exporteren.

### [P1] Opdracht start ondanks locatie miljoenen meters buiten bereik

- Scherm: De Drakenfontein
- Viewport: 390×844
- Stappen: simuleer latitude 0, longitude 0, accuracy 20 m; voer GPS-controle uit; activeer “Opdracht starten”.
- Verwacht: opdracht blijft geblokkeerd en toont herstelacties.
- Werkelijk: status meldt 5.769.181 meter afstand, maar de knop opent `#/challenge/drakenfontein`.
- Bewijs: [06-gps-outside.png](playwright-mcp/06-gps-outside.png)
- Aanbevolen oplossing: maak de challenge-route en startactie afhankelijk van een geldige GPS- of handmatige unlockregistratie.

### [P1] Verhaalaudio ontbreekt

- Scherm: voorbereiding, stops, resultaat
- Viewport: 390×844
- Stappen: open een verhaalspeler.
- Verwacht: afspelen, pauzeren en herhalen van het fragment, met transcriptfallback.
- Werkelijk: spelers tonen steeds `0:00 / 0:00` en een disabled positieslider. De bellende-engelknoppen gebruiken wel een werkende synthetische afspeelstate.
- Aanbevolen oplossing: lever de audiobestanden mee of presenteer expliciet een tekst-only placeholder zonder kapotte speler.

### [P1] Hoogcontrastmodus ontbreekt

- Scherm: Instellingen
- Viewport: 390×844
- Stappen: open `#/instellingen`.
- Verwacht: checkbox/switch “Hoger contrast voor buiten” en persistente `data-contrast="high"`.
- Werkelijk: alleen Geluid, Sfeermuziek, Synchronisatie en lokaal verwijderen zijn aanwezig.
- Bewijs: [10-settings-normal.png](playwright-mcp/10-settings-normal.png)
- Aanbevolen oplossing: voeg de instelling met persistente gebruikersvoorkeur toe en test kaart, perkament en controls in beide standen.

## Overige belangrijke bevindingen

### [P2] “Hoe werkt het?” opent geen uitleg

De link wijzigt de hash naar `#/`, maar er verschijnt geen pagina of dialog. Escape/focustests konden daardoor niet zinvol worden uitgevoerd.

### [P2] Meerdere touch targets zijn kleiner dan 44 px

- “Hoe werkt het?” op home: 34 px hoog.
- Route/Lijst-tabs: 36 px.
- MapLibre zoomknoppen: 36 px.
- “Mijn locatie”: 42 px.

### [P2] Manifesticon ontbreekt

Het manifest laadt, maar `assets/icons/icon.svg` geeft 404. Chromium meldt dat het icon niet kan worden gebruikt. Het enige icon heeft `purpose: any maskable`, zodat ook geen geldig maskable alternatief overblijft.

### [P2] Locatieknop overlapt kaartattributie

Op mobiel ligt “Mijn locatie” over de OpenFreeMap/OpenMapTiles-attributie. Beide worden visueel moeilijk leesbaar.

### [P2] Validatiefout blijft staan na geldige invoer

Na leeg of alleen-spaties verschijnt terecht een toegankelijk alert. Na invullen van een geldige teamnaam blijft die oude fout zichtbaar totdat opnieuw wordt verzonden.

### [P2] Afstand buiten bereik is niet menselijk geformatteerd

De UI toont “ongeveer 5769181 meter” in plaats van bijvoorbeeld “ongeveer 5.769 km”.

## Contrastbevindingen

Steekproef op de gerenderde hoofdachtergrond `#030806`. Transparante en gradientoppervlakken zijn tevens visueel beoordeeld; onderstaande waarden zijn geen claim van volledige WCAG-conformiteit.

| Element | Voorgrond | Achtergrond | Ratio | Vereist | Resultaat |
|---|---|---|---:|---:|---|
| Bodytekst | `#ead8af` | `#030806` | 14.35:1 | 4.5:1 | Geslaagd |
| Gouden titel | `#e0bc78` | `#030806` | 11.17:1 | 3:1 | Geslaagd |
| Sectielabel goud | `#c4974d` | `#030806` | 7.57:1 | 4.5:1 | Geslaagd |
| Muted tekst | `#ad9a74` | `#030806` | 7.35:1 | 4.5:1 | Geslaagd |
| Primaire knoptekst | `#e0bc78` | semitransparant donkergroen | n.v.t. | 4.5:1 | Visueel voldoende; exacte compositing niet betrouwbaar gemeten |

Niet gemeten door ontbrekende toestand: hoogcontrastmodus. Kaartlabels gebruiken raster/vectorlagen met variabele samengestelde achtergronden en zijn visueel beoordeeld.

## Responsive bevindingen

- 320×568: geen horizontale app-overflow op home, route of bellende engel; lange pagina’s blijven verticaal bereikbaar.
- 360×800: route schaalt zonder aangetoonde horizontale overflow.
- 390×844: primaire volledige flow; vaste bottomnav neemt veel ruimte in maar inhoud blijft scrollbaar.
- 430×932: kaart schaalt correct.
- 768×1024: kaartcontainer blijft bruikbaar.
- 1440×900: resultaat herschikt zonder exportfout.

## Toegankelijkheid

- Belangrijke schermen hebben een `main`; route heeft een benoemde hoofdnavigatie.
- Home en opdrachten hebben één logische h1. Team gebruikt “Team aanmaken” als h2 zonder h1, wat de paginastructuur verzwakt.
- Formuliervelden, radio’s, comboboxen en de vier klokken hebben toegankelijke namen.
- Foutfeedback verschijnt als `alert`; opslag en GPS-feedback als `status`.
- Toetsenbordfocus op home is zichtbaar met een 3 px lichte outline.
- De route heeft een lijstalternatief; de kaart is niet de enige routebediening.
- De hintdialog heeft rol, naam, titel en sluitknop. Escape herstelt focus; een verborgen dialognode blijft in de DOM.
- Diverse touch targets halen 44 px niet.
- Deze MCP-controle vervangt geen volledige handmatige toegankelijkheidsaudit.

## Functionele flows

| Flow | Status | Opmerking |
|---|---|---|
| Team aanmaken | Geslaagd met opmerkingen | Leeg/spaties afgewezen; stale alert na corrigeren |
| Hervatten | Geslaagd | Home toont het testteam en route |
| Voorbereiding | Geslaagd met opmerkingen | 35 assets gemeld; audio 0:00 |
| Routekaart | Geslaagd met opmerkingen | kaart zichtbaar; kleine controls en attributie-overlap |
| Routelijst | Geslaagd | huidige/vergrendelde status tekstueel aanwezig |
| GPS | Mislukt | buiten-geofence opent opdracht; devsimulator ontbreekt in productie |
| Handmatige locatiecontrole | Niet betrouwbaar testbaar | niet volledig doorlopen wegens locatiepoortbug |
| Gewone opdracht | Geslaagd | fout, hint en correct antwoord getest |
| Hint | Geslaagd met opmerkingen | eenmaal afgeschreven; verborgen dialognode blijft bestaan |
| Audio | Mislukt | reguliere fragmenten blijven 0:00 |
| Bellende engel | Mislukt | correcte namen/layout, maar `3142` wordt afgewezen |
| Teamspagina | Geslaagd met opmerkingen | team en cloudstatus aanwezig |
| Instellingen | Mislukt | hoogcontrastinstelling ontbreekt |
| Offline | Niet betrouwbaar testbaar | MCP-transport viel weg bij `setOffline(true)` |
| Finale | Mislukt | normale progressie blokkeert op opdracht 5 |
| Resultaat | Mislukt | direct toegankelijk vóór finale |
| Resultaatexport | Geslaagd technisch | download werkt, maar exporteert ongeldig vroeg resultaat |

## Console- en netwerkproblemen

- Herhaalde 404: `https://vriendenweekend.markvermeltfoort.nl/escape-the-city/assets/icons/icon.svg`.
- Chromium-manifestwaarschuwing voor hetzelfde onbruikbare icon.
- Geen relevante React-crash of uncaught exception waargenomen.
- MapLibre-kaart werd geladen; geen blokkerende tegelerror aangetoond.

## PWA-controle

- Manifest: geladen.
- `name`: Het Geheim van de Moerasdraak.
- `short_name`: Moerasdraak.
- `start_url` en `scope`: `/escape-the-city/`.
- `display`: `standalone`.
- Service worker: actief met correcte scope.
- Cache Storage: Workbox-precache en Moerasdraak font/audio-caches aanwezig.
- Icon/maskable: mislukt door 404.
- Native installatieprompt: niet betrouwbaar af te dwingen in deze Chromium-testomgeving.

## Screenshots

- [Start productie 390×844](playwright-mcp/01-home-prod-390x844.png)
- [Ingevuld teamformulier](playwright-mcp/02-team-filled.png)
- [Na teamcreatie](playwright-mcp/03-after-team-create.png)
- [Routekaart 320×568](playwright-mcp/04-route-map-320x568.png)
- [Routekaart 390×844](playwright-mcp/04-route-map-390x844.png)
- [Routekaart 430×932](playwright-mcp/04-route-map-430x932.png)
- [Routekaart tablet](playwright-mcp/04-route-map-768x1024.png)
- [Routelijst](playwright-mcp/05-route-list.png)
- [GPS buiten bereik](playwright-mcp/06-gps-outside.png)
- [Gewone opdracht](playwright-mcp/07-challenge.png)
- [Hintdialog](playwright-mcp/08-hint-dialog.png)
- [Bellende engel mobiel](playwright-mcp/09-bell-puzzle-390x844.png)
- [Instellingen](playwright-mcp/10-settings-normal.png)
- [Resultaat mobiel](playwright-mcp/12-result-mobile.png)
- [Resultaat desktop](playwright-mcp/12-result-desktop.png)

## Projectcontroles

- `npm run lint`: geslaagd, exitcode 0.
- `npm run test`: geslaagd, 16 testbestanden en 49 tests.
- `npm run build`: geslaagd, 123 modules; waarschuwing voor chunks groter dan 500 kB.
- Apart typecheckcommando: niet aanwezig; `npm run lint` voert `tsc --noEmit` uit.

## Aanbevolen herstelvolgorde

1. Blokkeer `#/resultaat` en export zonder geldige finale-completion.
2. Accepteer bellende-engelcode `3142` en voeg een regressietest toe.
3. Dwing GPS/handmatige unlock af in zowel UI als routeguard.
4. Lever reguliere audio-assets of een nette tekst-only fallback.
5. Voeg de persistente hoogcontrastmodus toe.
6. Repareer manifesticon, touch targets en kaartattributie-overlap.
7. Repareer “Hoe werkt het?” en wis validatiefeedback zodra invoer geldig wordt.
