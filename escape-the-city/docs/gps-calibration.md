# GPS-kalibratie

- Gebruik echte coördinaten per stop en controleer radius en accuracy op locatie.
- Radius standaard 60m
- Accuracy standaard 120m

## Handmatige locatiebevestiging

`needsOnSiteVerification: true` betekent dat spelers hun aanwezigheid zelf mogen
bevestigen wanneer GPS niet werkt. De huidige stop-pagina biedt daarvoor
“GPS werkt niet? Handmatig controleren” en registreert de ontgrendeling als
`manual`.

De vlag wordt nog niet gebruikt om deze bediening per stop aan of uit te zetten;
de handmatige actie staat momenteel bij iedere stop. `[TODO]` Koppel de vlag aan
de bediening wanneer stops hierin moeten verschillen.
