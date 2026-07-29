# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System | Type | Purpose | Auth model | Criticality | Evidence |
|--------|------|---------|------------|-------------|----------|
| Supabase Auth + PostgREST RPC | Auth/API/DB | Anonymous sessions, dossier state/scores, city team sync/recovery. | Public publishable key plus persisted anonymous JWT; RPC checks `auth.uid()`. | High | `supabase-api.js`, `escape-the-city/src/lib/supabase/client.ts`, `supabase/migrations/016_city_game_sync_rpcs.sql` |
| jsDelivr | CDN | Supplies Supabase JavaScript v2 to root pages. | Public, none. | High for a fresh online root load | `index.html`, `games/memory.html` |
| OpenFreeMap/MapLibre | Map API/client | Interactive route basemap. | Public style URL, no credential in repo. | Medium; fallback route map exists | `escape-the-city/src/features/map/mapStyle.ts`, `escape-the-city/src/features/map/RouteMap.tsx` |
| Google Fonts | CDN | Cinzel and Lora webfonts. | Public, none. | Low | `escape-the-city/src/styles/global.css`, `escape-the-city/vite.config.ts` |
| Google Maps / Apple Maps | External navigation links | Opens walking/search directions for a stop. | Public URL handoff. | Low | `escape-the-city/src/features/map/mapTypes.ts`, `escape-the-city/src/pages/StopPage.tsx` |
| Browser Geolocation | Device API | Checks distance and reported GPS accuracy before unlocking stops. | User browser permission. | High for normal route flow | `escape-the-city/src/features/location/browserProvider.ts`, `escape-the-city/src/features/location/geolocation.ts` |
| GitHub Pages + Actions | CI/CD/hosting | Builds, assembles, and publishes both PWAs. | GitHub workflow permissions and repository variables. | High | `.github/workflows/escape-the-city.yml` |

No message broker, server-side API gateway, service mesh, APM, metrics, or tracing integration is present.

### 2) Data Stores

| Store | Role | Access layer | Key risk | Evidence |
|-------|------|--------------|----------|----------|
| Supabase `private` schema | Dossier games, players, starts, activity, scores. | Public security-definer RPCs via `supabase-api.js`. | Migration order and RPC grants define all client access. | `supabase/migrations/001_initial_schema.sql`, `supabase-api.js` |
| Supabase `city_game` schema | City teams, members, stop progress, events. | Public sync/join RPCs; migration 017 revokes direct browser-role access to schema, tables, and internal helpers. | Security-definer RPC authorization remains the access boundary. | `supabase/migrations/016_city_game_sync_rpcs.sql`, `supabase/migrations/017_enforce_city_game_rpc_only.sql` |
| IndexedDB `moerasdraak-storage` | Local city teams, progress, and sync queue. | `features/offline/storage.ts`. | Browser/site-data clearing removes unsynced state. | `escape-the-city/src/features/offline/storage.ts` |
| `localStorage` | Remembered dossier name and city settings/last team ID. | Root pages and city storage helper. | Per-browser/device state only. | `index.html`, `escape-the-city/src/features/offline/storage.ts` |
| Cache Storage | Root shell and city Workbox/media assets. | Root service worker, Workbox, offline pack. | Cache names/version bumps must stay coordinated. | `service-worker.js`, `escape-the-city/vite.config.ts`, `escape-the-city/src/features/offline/offlinePack.ts` |

### 3) Secrets and Credentials Handling

- Public sources: root `config.js`, generated from `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; city Vite variables fall back to that runtime config.
- GitHub repository variables feed deployment; `.env` is ignored under `escape-the-city/`.
- Hardcoding check: a live Supabase URL and publishable key are committed in `config.js`; repository documentation explicitly permits only these public values.
- Forbidden values: service-role keys, database passwords, JWT secrets, local exports, and player data.
- Rotation/lifecycle: `[TODO]` no rotation procedure is documented for the publishable key or project URL.

### 4) Reliability and Failure Behavior

- Root Supabase calls use a 12-second timeout; no retry/backoff or circuit breaker is implemented.
- Root local-dev mode returns deterministic in-browser responses when enabled.
- City works without Supabase, queues events in IndexedDB, and retries on app open, browser `online`, visibility return, or manual sync.
- City queue flushes are serialized and stop at the first failure; no timed exponential backoff exists.
- City clients can execute the two public RPCs but cannot directly access `city_game` tables or internal helper functions after migration 017.
- Map rendering has a local fallback image for style errors; story audio has visible transcript fallback.
- Root service worker ignores cross-origin CDN requests, so it does not explicitly precache jsDelivr’s Supabase browser script.

### 5) Observability for Integrations

- Root logs selected refresh/update/game configuration failures to the browser console.
- City sync exposes user-visible status and persists per-item attempts, timestamp, and last error.
- No centralized logs, metrics, traces, alerting, or Supabase-call dashboards are configured in this repository.
- Visibility gaps: production sync failure rates, RPC latency, CDN availability, geolocation failure rates, and offline-pack failures.

### 6) Evidence

- `config.example.js`
- `.github/scripts/generate-config.mjs`
- `.github/workflows/escape-the-city.yml`
- `supabase-api.js`
- `supabase/migrations/015_city_game_schema.sql`
- `supabase/migrations/016_city_game_sync_rpcs.sql`
- `supabase/migrations/017_enforce_city_game_rpc_only.sql`
- `escape-the-city/.env.example`
- `escape-the-city/src/lib/supabase/client.ts`
- `escape-the-city/src/features/offline/storage.ts`
- `escape-the-city/vite.config.ts`
