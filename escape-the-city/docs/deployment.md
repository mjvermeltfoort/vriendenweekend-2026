# Deployment

- Build: `npm run build`
- GitHub Actions `.github/workflows/escape-the-city.yml` stelt een schone `_site` samen
- De bestaande statische root-app wordt ongewijzigd naar `/` gekopieerd
- Alleen `escape-the-city/dist/` wordt naar `/escape-the-city/` gekopieerd
- De root-serviceworker negeert `/escape-the-city/`; die subapp beheert daar zijn eigen Workbox-cache
- Custom domain wordt repo-breed ingesteld
- De Vite-build bevat `index.html` en het losse `dashboard.html`; het dashboard registreert geen serviceworker en staat niet in de spelersmanifest
- Dashboardentry en dashboardstylesheet worden niet door de spelers-PWA geprecachet
- Voor iedere deploybare wijziging moeten `package.json`, `package-lock.json` en `manifest.webmanifest` dezelfde patchversie bevatten
- Controleer na `npm run build` de versie in de gegenereerde manifest en `sw.js`/cache-ID
