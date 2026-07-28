# Deployment

- Build: `npm run build`
- GitHub Actions `.github/workflows/escape-the-city.yml` stelt een schone `_site` samen
- De bestaande statische root-app wordt ongewijzigd naar `/` gekopieerd
- Alleen `escape-the-city/dist/` wordt naar `/escape-the-city/` gekopieerd
- De root-serviceworker negeert `/escape-the-city/`; die subapp beheert daar zijn eigen Workbox-cache
- Custom domain wordt repo-breed ingesteld
