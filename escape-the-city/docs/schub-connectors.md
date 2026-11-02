# Wandelverbindingen vanaf schubben

De kaart toont één turquoise stippellijn vanaf de geselecteerde of laatst bezochte zichtbare schub naar een bestaand punt op de actieve hoofdroute. Afgeronde schubben tellen mee. De GPS-selectie blijft behouden tijdens het teruglopen en vervalt bij het bereiken van de hoofdroute of een andere schub. De lijn geeft geen extra teksten, knoppen of camerabewegingen.

`src/game-data/moerasdraak/schub-connectors.json` bevat vooraf berekende verbindingen voor alle zes schubben naar elk van de zes etappes. Dat ondersteunt ook schubben die later dan het aanbevolen moment worden bezocht. Verborgen schubben en de nog niet vrijgegeven finale krijgen geen lijn. De data zit in de appbundel en werkt daardoor ook offline, zonder GPS naar een routeringsdienst te sturen. Dezelfde geometrie wordt op de interactieve en offline kaart getekend. De afwijkingsdetectie accepteert ook deze wandelverbinding als corridor.

## Herkomst en verversen

Bron: [OpenStreetMap-bijdragers](https://www.openstreetmap.org/copyright), ODbL-1.0. Extract opgehaald op 2 november 2026 via `https://api.openstreetmap.org/api/0.6/map?bbox=west,zuid,oost,noord`.

Het gebied is verdeeld in negen map-extracten om onder de API-limiet te blijven: begin bij `(5.293, 51.686)` en gebruik drie kolommen van `0.0065` lengtegraad en drie rijen van `0.0042` breedtegraad. Bewaar de XML-resultaten als `.osm`-bestanden buiten de repository. Genereer daarna opnieuw vanuit `escape-the-city/`:

```sh
python3 scripts/build-schub-connectors.py --osm-dir /pad/naar/osm-extracten
npm test -- src/features/map
```

Het script gebruikt alleen verbonden, voor voetgangers toegestane straten/paden. Expliciet verboden/private toegang en `foot=use_sidepath` worden uitgesloten. De schubpositie wordt op een straatsegment geprojecteerd (maximaal 30 meter aansluiting vanaf het exacte herkenningspunt); de verbinding eindigt op een exact bestaand routepunt, maximaal 10 meter van het wegennet. OSM-way-ID's en straatnamen blijven in de data staan voor controle. Er wordt geen rechte verbinding naar de dichtstbijzijnde hoofdroute getekend.

Bij Bolwerk Sint-Jan loopt de verbinding naar etappe 2 via de paden/trappen bij het bolwerk, Sint Janssingel en de oversteek van de Sint Jansstraat. Controleer bij toekomstige verversingen met name kanaaloversteken en poorten. De kaartgegevens beschrijven de ingetekende loopverbindingen; tijdelijke afsluitingen en actuele toegang zijn niet ter plekke geverifieerd.
