# Vriendenweekend 2026 PWA

Deze map bevat een installeerbare PWA-schil rond de bestaande Google Apps Script-webapp.
De spelgegevens, scores en vrijgave blijven via Apps Script en Google Sheets lopen.

## 1. Apps Script-link instellen

Open `config.js` en vervang:

```js
https://script.google.com/macros/s/VERVANG_DIT_DOOR_JOUW_ID/exec
```

door jouw volledige gepubliceerde `/exec`-URL.

Controleer in Apps Script:

- uitvoeren als: **Ik**;
- toegang: **Iedereen**;
- `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` staat in `doGet()`.

## 2. Gratis publiceren met GitHub Pages

1. Maak op GitHub een nieuwe openbare repository, bijvoorbeeld `vriendenweekend-2026`.
2. Upload alle bestanden en de map `icons` uit dit pakket naar de hoofdmap.
3. Open in de repository **Settings → Pages**.
4. Kies **Deploy from a branch**.
5. Kies branch `main` en map `/ (root)`.
6. Sla op.

De site komt dan op een adres zoals:

`https://jouwgebruikersnaam.github.io/vriendenweekend-2026/`

Een eigen domein kan later via dezelfde Pages-instellingen worden gekoppeld.

## 3. Installeren op telefoon

### Android / Chrome

Open de PWA-URL. Gebruik de knop **Installeer app** of kies in Chrome **App installeren / Toevoegen aan startscherm**.

### iPhone / Safari

Open de PWA-URL in Safari, tik op **Delen** en kies **Zet op beginscherm**.

## Mobiele werking

De PWA vult de volledige beschikbare schermhoogte met `100dvh`, ondersteunt safe areas bij iPhones en toont de Apps Script-webapp in een schermvullend iframe.

## Offline gedrag

De PWA-schil en iconen worden gecachet. De spellen en scores hebben een internetverbinding nodig omdat Apps Script en Google Sheets online worden geladen.
