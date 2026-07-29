# GPS-kalibratie

De voorlopige aankomstdrempel is voor alle stops `35 m`, met maximaal `40 m`
GPS-accuracy. Deze waarden zijn bewust nog niet als veldgekalibreerd aangemerkt.
Activeer afwijkende waarden uitsluitend met een opvolgmigratie `022_*`.

| Stop | Coördinaat | Radius 35 m op locatie getest | Accuracy 40 m haalbaar | Veilige aankomstzone | Datum | Opmerkingen |
| --- | --- | --- | --- | --- | --- | --- |
| Drakenfontein | 51.690506, 5.296208 |  |  |  |  |  |
| Zoete Lieve Gerritje | 51.689817, 5.299926 |  |  |  |  |  |
| Herman Moerkerkpark / Waterpoort | 51.689641, 5.305190 |  |  |  |  |  |
| Huis van Bosch | 51.688968, 5.304617 |  |  |  |  |  |
| Sint-Jan | 51.687992, 5.308464 |  |  |  |  |  |
| Kruithuis | 51.693656, 5.305112 |  |  |  |  |  |
| Bossche Brouwers | 51.696900, 5.299290 |  |  |  |  |  |

Controleer per stop vanuit meerdere looprichtingen en op minimaal twee
verschillende toestellen. Noteer gebouwen, smalle straten en andere oorzaken van
GPS-reflectie. De server gebruikt uitsluitend een meting van maximaal 30 seconden
oud uit een teamsessie die maximaal 60 seconden inactief is.

## Observatiefallback

Migratie `021_location_verification.sql` seedt primaire en reservevragen met
`requires_on_site_validation = true`. Daardoor worden ze nog niet aan spelers
getoond. Zet deze vlag pas via `022_*` uit nadat beide details fysiek zijn
goedgekeurd. Bossche Brouwers blijft geblokkeerd totdat een permanent, veilig
zichtbaar detail is bevestigd. De openbare dashboardvrijgave blijft altijd de
operationele fallback.
