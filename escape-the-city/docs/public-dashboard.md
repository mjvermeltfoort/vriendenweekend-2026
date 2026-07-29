# Openbaar realtime teamdashboard

Open `/escape-the-city/dashboard.html` rechtstreeks op een desktopvenster van minimaal 1100 pixels breed. Het dashboard staat los van de spelersrouter, navigatie, manifest en serviceworkerregistratie.

## Belangrijke waarschuwing

Dit is nadrukkelijk geen beveiligde beheeromgeving. Anonymous Auth verbergt alleen de technische aanmelding; iedere anonieme gebruiker krijgt de database-rol `authenticated`. **Iedereen met de URL kan teamcodes, teamlocaties en actieve deelnemers bekijken, teams aanmaken of wijzigen, voortgang resetten, runs beëindigen en sessies intrekken.**

Er wordt uitsluitend een publieke Supabase URL en publishable/anon-key gebruikt. De beperkte projectie en RPC's minimaliseren de blootgestelde data en mogelijke wijzigingen, maar vormen geen toegangscontrole.

## Werking

- De eerste laadactie haalt één `get_dashboard_snapshot()` op voor Moerasdraak versie 1.
- Daarna luistert precies één Realtime-kanaal naar volledige teamrecords uit `dashboard_team_projection`.
- Een event vervangt één team in de lokale store.
- Bij verbindingsverlies verschijnt “Verbinding herstellen…” en start snapshotpolling om de 10 seconden.
- Bij herstel stopt de polling direct. De lokale klok houdt sessie- en locatieouderdom actueel zonder database-event.
- De MapLibre-kaart initialiseert eenmaal en werkt route-, stop-, marker- en accuracysources bij met `setData`.

## Beheer

Teamcode vervangen, uitschakelen, resetten, actieve run beëindigen en sessie intrekken gebruiken bevestigingsdialogen. Iedere beheer-RPC valideert Anonymous Auth, team/game-scope en invoer, en schrijft een audit-event met een lokaal dashboard-client-ID. Codes, hashes en GPS-coördinaten worden niet in auditpayloads opgeslagen.

Migration 019 roteert bestaande codes omdat de hashes uit migration 018 niet omkeerbaar zijn. Oude codes werken daarna niet meer voor nieuwe deelnemers; bestaande sessies blijven verbonden.
