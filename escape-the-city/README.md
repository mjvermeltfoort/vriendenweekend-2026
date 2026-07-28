# Het Geheim van de Moerasdraak

Escape the City PWA voor Den Bosch.

## Stack
- React
- TypeScript
- Vite
- vite-plugin-pwa
- Supabase
- Vitest

## Starten
```bash
cd escape-the-city
npm install
npm run dev
```

## Lokaal zonder Supabase
- Laat `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` leeg
- Team, voortgang en queue blijven lokaal werken
- Cloudherstel en sync worden automatisch uitgeschakeld

## Environment
Kopieer `.env.example` naar `.env`.
De GitHub Pages-workflow gebruikt de repositoryvariabelen `SUPABASE_URL` en `SUPABASE_PUBLISHABLE_KEY` voor zowel de publieke `config.js` als `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`. Bij een lokale productiebuild zonder Vite-variabelen gebruikt de app de publieke Supabase-configuratie uit `config.js`.

## Supabase
- Zet `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`
- Schakel Anonymous auth in
- Run `supabase/migrations/015_city_game_schema.sql`
- Run `supabase/migrations/016_city_game_sync_rpcs.sql`
- Lees `docs/supabase-setup.md`

## Teamflow
- Nieuw team maken
- Team hervatten uit lokale opslag
- Teamcode gebruiken wanneer Supabase beschikbaar is

## Offline routepakket
- Voorbereidingsscherm cachet app-assets
- Status staat in `docs/offline-behaviour.md`

## GPS
- Browser geolocation
- Dev simulator in development
- Kalibratie: `docs/gps-calibration.md`

## Build / test / lint
```bash
npm run lint
npm test
npm run build
```

## Deploy
- GitHub Actions publiceert repo voor Pages
- Subpath app draait onder `/escape-the-city/`
- Custom domain en Pages-instellingen blijven repo-breed

## Bekende beperkingen
- Echte GPS-coördinaten nog placeholders
- Echte audio-opnames ontbreken
- Resultaatkaart export is functioneel maar eenvoudig
