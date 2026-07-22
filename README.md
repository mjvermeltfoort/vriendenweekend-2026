# Het Verzegelde Dossier - PWA

Deze map bevat een installeerbare PWA met statische HTML-pagina's op GitHub Pages.
Google Apps Script wordt alleen gebruikt als JSON API voor spelstatus, toegang, starts en scores.

## Architectuur

- Frontend (GitHub Pages):
	- indexpagina met spelernaam en speloverzicht
	- statische spelpagina's in `games/`
	- service worker voor app shell caching
- Backend (Google Apps Script + Sheets):
	- API-routes in `Code.gs`
	- opslag in werkbladen `Spellen`, `Scores`, `Spelstarts`

Er is geen iframe-laag meer en geen template-rendering via Apps Script nodig.

## 1. Apps Script-link instellen

Open `config.js` en vervang:

```js
https://script.google.com/macros/s/VERVANG_DIT_DOOR_JOUW_ID/exec
```

door jouw volledige gepubliceerde `/exec`-URL.

Controleer in Apps Script:

- uitvoeren als: **Ik**
- toegang: **Iedereen**

## 2. API-contract

De frontend gebruikt exact deze routes:

- `GET ?action=state&playerName=Mark`
- `GET ?action=access&gameId=mozaiek&playerName=Mark`
- `POST action=start + payload={...}`
- `POST action=heartbeat + payload={...}`
- `POST action=replay + payload={...}`
- `POST action=score + payload={...}`

De routes `state` en `access` lezen de spelinformatie uit het werkblad
`Spellen`. Een spelobject bevat: `id`, `title`, `description`, `status`,
`state`, `openFrom`, `closeAt`, `hint`, `maxPoints`, `order` en `completed`.
De Nederlandse kolomnamen in de Sheet worden op headernaam gekoppeld.

Voer bij een bestaande installatie eenmalig `addSchaduwzoekerGame()` uit in
Apps Script als **Schaduwzoeker** nog niet geregistreerd is.

Voer daarnaast eenmalig `addTussenDeLettersGame()` uit om **Tussen de Letters**
te registreren en `addDwaalspoorGame()` om **Dwaalspoor** toe te voegen. Deze
migratiefuncties voegen alleen de ontbrekende spelregel toe
en laten de bestaande werkbladen, spelinstellingen en scores ongemoeid.

Voer voor **Kettingreactie** eenmalig `addKettingreactieGame()` uit. Ook deze
migratie voegt uitsluitend de ontbrekende regel aan `Spellen` toe en verandert
geen bestaande instellingen of scores.

De `state`-response bevat daarnaast `activePlayers`. Een geopende spelpagina
stuurt iedere 10 seconden een heartbeat; zonder heartbeat verdwijnt een speler
na 30 seconden uit deze lijst. Een ingeleverde score verwijdert de speler
direct.
De overzichtspagina ververst deze actieve spelers, het leaderboard en het
spelersaantal iedere 10 seconden en zodra de app opnieuw op de voorgrond komt.

Voor POST wordt in de frontend `URLSearchParams` gebruikt:

```txt
action=score&payload={...json...}
```

## 3. Gratis publiceren met GitHub Pages

1. Maak op GitHub een openbare repository, bijvoorbeeld `vriendenweekend-2026`.
2. Upload alle bestanden en de map `icons` naar de hoofdmap.
3. Open in de repository **Settings -> Pages**.
4. Kies **Deploy from a branch**.
5. Kies branch `main` en map `/ (root)`.
6. Sla op.

De site komt dan op een adres zoals:

`https://jouwgebruikersnaam.github.io/vriendenweekend-2026/`

## 4. Installeren op telefoon

### Android / Chrome

Open de PWA-URL. Gebruik de knop **Installeer app** of kies in Chrome **App installeren / Toevoegen aan startscherm**.

### iPhone / Safari

Open de PWA-URL in Safari, tik op **Delen** en kies **Zet op beginscherm**.

## 5. Mobiele werking

De PWA gebruikt `100dvh`, safe areas op iPhone en directe navigatie naar de statische spelpagina's.

## 6. Offline gedrag

De app shell en spelpagina's worden gecachet.
API-calls naar Apps Script en score-opslag vereisen internet.

## 7. Nieuwe versie publiceren

Verhoog bij iedere nieuwe publicatie het versienummer in `CACHE_NAME` bovenaan
`service-worker.js` (bijvoorbeeld van `v30` naar `v31`). Zodra de nieuwe versie
online staat, controleert de app hier iedere minuut op en opnieuw wanneer iemand
de app opent of naar de app terugkeert. Er verschijnt dan op iedere pagina een
melding met de knop **Vernieuwen**. De nieuwe versie wordt pas geactiveerd nadat
de gebruiker op die knop drukt.
