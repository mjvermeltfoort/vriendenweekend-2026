# Supabase setup

1. Maak een Supabase-project en schakel Anonymous Auth in.
2. Voer alle rootmigrations t/m `supabase/migrations/019_public_team_dashboard.sql` op volgorde uit. Migration 018 voegt teamsessies, gedeelde GPS en game-runs toe; migration 019 voegt het publieke dashboard toe.
3. Stel `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in via `.env` of publieke runtimeconfiguratie.
4. Controleer deelnemen met `join_team_by_code`, heartbeat, locatie-update en Realtime.
5. Voer `supabase/tests/019_public_team_dashboard_regression.sql` uit op een testdatabase; het script rolt alle testdata terug.

## Publiek dashboard

`/escape-the-city/dashboard.html` meldt een gebruiker stil aan met Anonymous Auth. Zo'n gebruiker heeft technisch de Postgres-rol `authenticated`. Er is geen beheerderscontrole: **iedereen met de URL kan alle zichtbare teamgegevens bekijken en alle dashboard-RPC's uitvoeren**. De URL niet linken en `noindex` zijn geen beveiliging.

Migration 019:

- roteert de niet-omkeerbare bestaande teamcodes naar leesbare codes van zes tekens;
- bewaart `join_code` voor weergave en `code_hash` voor validatie;
- publiceert uitsluitend `public.dashboard_team_projection` via `supabase_realtime`;
- houdt teams, voortgang, sessies, locaties en game-runs zelf afgeschermd;
- verleent snapshot- en beheer-RPC's alleen aan `authenticated`;
- registreert beheeracties zonder codes, hashes of GPS-coördinaten in de auditpayload.

De migratie maakt bestaande codes ongeldig voor nieuwe deelnemers. Reeds verbonden sessies blijven bruikbaar. Zet nooit een service-role-key, databasewachtwoord of andere geheime sleutel in de browserconfiguratie.

## Realtime en GPS

Een teamsessie geldt 60 seconden als actief; een locatie geldt 30 seconden als actueel en t/m 50 meter als nauwkeurig. De dashboardkaart begrenst alleen de getekende accuracycirkel op 250 meter en toont de echte accuracy altijd als tekst.

De spelersapp houdt de heartbeat op 20 seconden. GPS-updates worden maximaal één keer per 5 seconden verzonden, vanaf 8 meter verplaatsing of 10 meter accuracyverbetering, en uiterlijk na 10 seconden. Bij Realtime-uitval haalt het dashboard elke 10 seconden een snapshot op; polling stopt zodra het kanaal weer verbonden is.
