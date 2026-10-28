# Teamspreiding

Vanaf 0.1.53, na migratie 043.

## Organisatie

Open het bestaande teamdashboard. Kies bij **Teamspreiding** de teams die nog niet
zijn begonnen, zet ze in vertrekvolgorde en kies het eerste vertrekmoment. De
standaard is 5 minuten tussen teams en waarschuwen onder 100 meter. Elk plan is
een aparte speelsessie: alleen de gekozen teams worden vergeleken.

De tijdinvoer gebruikt de lokale tijdzone van de dashboardbrowser. Een team kan
maar aan één speelsessie deelnemen. Opnieuw plannen vervangt de planning van de
gekozen, nog niet gestarte teams. De organisatie kan een afzonderlijke starttijd
wijzigen of begeleiding voor een hele speelsessie uit- en weer inschakelen.
Uitschakelen geeft ook de geplande starts vrij.

## Spelers

Op het routescherm verschijnt vóór vertrek een afteller. Zodra het tijd is, start
het team met **Start jullie avontuur**. Het daadwerkelijke vertrekmoment wordt
voor het hele team opgeslagen en gebruikt voor de speelduur. Een tweede toestel
of herladen zet deze tijd niet opnieuw. Een voortgangsreset wist het vertrek.
De server controleert de starttijd ook bij direct openen van een opdracht.

Henk geeft advies op het routescherm als een voorganger minstens 30 seconden te
dichtbij loopt of een opdrachtlocatie nog bezet houdt. Hij onderbreekt geen
puzzel, vertelling of bestaand dialoogvenster. De melding is leesbaar en bevat een
nieuwe opname met Hint Henks eigen stem (ElevenLabs eleven_v4). Geluid volgt de
bestaande instellingen. Een passende, zichtbare, onafgeronde schub binnen 350m
op dezelfde etappe kan als omweg worden voorgesteld. Er zijn geen extra punten,
straffen of verplichte wachttijden bij nabijheid.

## Detectie en grenzen

- Serverberekening op de bestaande wandelroute; geen onderlinge GPS-downloads.
- Alleen dezelfde actuele hoofdetappe en dezelfde speelsessie tellen mee.
- GPS maximaal 30 seconden oud en maximaal 40m onnauwkeurig; een actieve,
  niet-ingetrokken teamsessie moet de bron zijn. Metingen buiten de routecorridor
  van 40m worden genegeerd, bijvoorbeeld tijdens een schub-omweg.
- Een routeafstand groter dan de gezamenlijke GPS-onzekerheid bepaalt wie
  vooroploopt. Bij dezelfde opdrachtlocatie kan een eerdere aankomst dit bepalen.
- Standaard 100m voor detectie en 150m voor vrijgeven. Een onderbreking van meer
  dan 15 seconden in controles zet de observatieperiode opnieuw.
- Maximaal één bericht per aaneengesloten ontmoeting en minstens 10 minuten
  tussen nieuwe berichten. Sluiten wordt gedeeld tussen teamtoestellen.
- Polling om de 5 seconden zolang de app zichtbaar en online is. Oud dashboard-
  advies vervalt na 15 seconden zonder controles. Scherm uit of offline betekent
  dus geen betrouwbare onderlinge controle; het spel blijft beschikbaar.
- De startplanning en nabijheidsbegeleiding zijn online functies. Bij uitval
  blokkeert de client het bestaande spel niet; de server controleert bij
  hervatten de geplande start. Een fysieke onderlinge afstand is geen garantie.

## Backend en controles

Migratie 043 voegt alleen interne `city_game`-tabellen en gerichte RPCs toe. De
bestaande openbare dashboardbevoegdheden blijven van toepassing. Spelers krijgen
alleen hun eigen vertrekschema en een anoniem meldingstoken.

De CI controleert TypeScript, unit tests, mobiele browserflows, geïsoleerde
SQL-regressies en een volledige herbouw van migraties 001–043 met de werkelijke
team-RPCs. Test de afstandsgrenzen nog met meerdere teams op straat.
