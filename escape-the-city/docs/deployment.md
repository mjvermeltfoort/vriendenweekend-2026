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

## Versie 0.1.52: fout antwoord en bedenktijd

Voer `supabase/migrations/042_wrong_answer_cooldown.sql` uit in de Supabase SQL-editor, na migratie 041 en vóór de frontenddeploy. De migratie voegt drie voortgangskolommen toe en vervangt de bestaande spel-RPC's; bestaande pogingen worden niet achteraf belast. Zonder deze migratie blijft de oude serverwerking actief.

Een fout antwoord verwerkt de bestaande puntenformule meteen en legt een gedeelde deadline van 60 seconden vast. Hints en kaart blijven beschikbaar. Voltooien vervangt de tijdelijke negatieve scoreboeking door de uiteindelijke opdrachtscore, zodat er geen dubbele aftrek ontstaat. De totale score kan vóór de eerste voltooide opdracht negatief zijn. Bonusopdrachten behouden hun bestaande factoren en scorevloer; de melding toont de werkelijke aftrek, ook als die nul is.

CI voert de migratie en regressies uit op een geïsoleerde PostgreSQL 16-database, inclusief twee gelijktijdige teaminzendingen. De SQL-fixture in `supabase/tests/` is uitsluitend voor die lege testdatabase en mag niet op de spelomgeving worden uitgevoerd.
