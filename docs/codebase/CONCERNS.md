# Codebase Concerns

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern | Evidence | Impact | Suggested action |
|----------|---------|----------|--------|------------------|
| High | GPS/content production readiness remains unresolved: README calls coordinates placeholders and every on-site checklist cell is empty, while precise coordinates ship in `game.ts`. This is separate from `needsOnSiteVerification`, which denotes player confirmation when GPS is unavailable. | `escape-the-city/README.md`, `escape-the-city/docs/gps-calibration.md`, `escape-the-city/docs/manual-content-checklist.md`, `escape-the-city/src/game-data/moerasdraak/game.ts` | Players can be blocked or unlocked at wrong physical locations if the coordinates themselves remain unverified. | Calibrate every stop on site and record approval before event use. |
| Medium | Root pages depend on unpinned-major Supabase JavaScript from jsDelivr; root service worker ignores cross-origin requests. | `index.html`, `games/memory.html`, `service-worker.js` | Fresh offline loads and upstream major-v2 changes rely on CDN/browser cache behavior. | Self-host a pinned browser build or explicitly document/test CDN dependency. |
| Medium | Root app has no automated tests; city has no executable E2E or SQL/RLS test suite. | `AGENTS.md`, `escape-the-city/vitest.config.ts`, `escape-the-city/docs/test-results/playwright-mcp-report.md` | Regressions in registration, score, auth, migration, PWA update, and full route flow need manual discovery. | Add smoke E2E plus database authorization tests around highest-risk flows. |
| Medium | Several root games combine HTML, CSS, rendering, game state, and lifecycle in files over 1,000 lines. | `games/rebus.html`, `games/dwaalspoor.html`, `games/kettingreactie.html`, `games/tussen-de-letters.html` | Changes are hard to isolate; shared behavior can drift. | Extract reusable gate, heartbeat, error, and lifecycle behavior incrementally. |
| Low | City production build passes but emits chunks above 500 kB. | `escape-the-city/src/features/map/RouteMap.tsx`, `escape-the-city/package.json` | Slower first load and update downloads on mobile networks. | Lazy-load map route/component and measure resulting chunks. |

### 2) Technical Debt

| Debt item | Why it exists | Where | Risk if ignored | Suggested fix |
|-----------|---------------|-------|-----------------|---------------|
| Dashboard bypasses root adapter | Dashboard implements anonymous auth/client/RPC inline; decision is to leave this unchanged. | `dashboard.html`, `supabase-api.js`, `AGENTS.md` | Timeout/error/auth behavior can diverge from other root pages. | Treat as a documented exception. |
| Manual-location flag is not wired to UI | `needsOnSiteVerification` expresses manual player confirmation when GPS is unavailable, but the stop page currently offers manual unlock for every stop without reading the flag. | `escape-the-city/src/game-data/moerasdraak/game.ts`, `escape-the-city/src/pages/StopPage.tsx`, `escape-the-city/docs/gps-calibration.md` | Stops cannot yet vary whether manual confirmation is offered. | `[TODO]` Use the flag when differentiated per-stop behavior is needed. |
| Duplicate guard | `unlockStop` checks `if (!progress) return;` twice. | `escape-the-city/src/app/gameContext.tsx` | Tiny readability cost; suggests missed cleanup in high-churn coordinator. | Remove duplicate during next scoped change. |
| Sequential offline downloads | `precacheRouteAssets` fetches and caches each media asset in a serial loop. | `escape-the-city/src/features/offline/offlinePack.ts` | Route preparation time grows with asset count/latency. | Use measured, bounded concurrency and preserve per-asset failure handling. |
| Documentation status drift | README says real audio is missing, while 26 audio files are present and latest report says regular audio passed retest. | `escape-the-city/README.md`, `escape-the-city/public/audio/README.md`, `escape-the-city/docs/test-results/playwright-mcp-report.md` | Maintainers act on obsolete limitations. | Update known limitations from verified current assets/results. |

### 3) Security Concerns

| Risk | OWASP category | Evidence | Current mitigation | Gap |
|------|---------------|----------|--------------------|-----|
| Privileged city RPC boundary | A01 Broken Access Control | `supabase/migrations/016_city_game_sync_rpcs.sql`, `supabase/migrations/017_enforce_city_game_rpc_only.sql` | Migration 017 revokes direct browser-role table/schema/helper access; public RPCs check authentication and team access. | Migration still requires application to the target Supabase project and post-apply authorization tests. |
| Client-supplied city score/progress | A04 Insecure Design | `escape-the-city/src/app/gameContext.tsx`, `escape-the-city/src/lib/supabase/sync.ts`, `supabase/migrations/016_city_game_sync_rpcs.sql` | RPC checks authentication/team ownership or membership and validates required fields. | Server accepts `totalScore`, stop states, timestamps, and event data from client; no authoritative city-game rule validation is visible. |
| Public runtime config | N/A | `config.js`, `.github/scripts/generate-config.mjs` | Only URL and publishable key are allowed; private tables/RPC auth provide security boundary. | Rotation procedure and automated secret scanning are not configured. |
| User-visible raw city RPC errors | A09 Security Logging and Monitoring Failures / information exposure | `escape-the-city/src/lib/supabase/sync.ts` | Known errors are mapped to Dutch messages. | Unknown Supabase error messages pass through verbatim; review before exposing new RPC internals. |

### 4) Performance and Scaling Concerns

| Concern | Evidence | Current symptom | Scaling risk | Suggested improvement |
|---------|----------|-----------------|-------------|-----------------------|
| Large city bundles | Vite build; `escape-the-city/src/features/map/RouteMap.tsx` | Build warning: app chunk about 543 kB and MapLibre chunk about 1,053 kB minified. | Slower mobile download/parse and PWA updates. | Route-level dynamic import, especially map UI; compare gzip and real-device load. |
| Serial route media caching | `escape-the-city/src/features/offline/offlinePack.ts` | One network/cache round trip completes before next begins. | Preparation latency grows linearly with 35+ assets. | Add small concurrency pool; retain progress and partial-success reporting. |
| Full city progress upsert per event | `escape-the-city/src/lib/supabase/sync.ts`, `supabase/migrations/016_city_game_sync_rpcs.sql` | Every queued event sends all progress and loops through every stop. | Payload/write cost grows with route length and event frequency. | Measure first; consider versioned delta sync only if event/route volume grows. |
| Root monolithic pages | `games/rebus.html`, `games/dwaalspoor.html` | Large cached/downloaded documents and repeated page-specific code. | More cache churn and parse cost as games grow. | Extract stable shared modules without introducing a root build dependency unless chosen. |

### 5) Fragile/High-Churn Areas

| Area | Why fragile | Churn signal | Safe change strategy |
|------|-------------|-------------|----------------------|
| `index.html` | Large orchestrator with registration, state, leaderboard, assistant, and install behavior. | 42 changes in recent 90-day scan. | Narrow section edits; manually retest registration, state refresh, leaderboard, and install. |
| `service-worker.js` | Cache list/version and routing determine updates/offline behavior. | 40 changes in recent 90-day scan. | Bump cache version for cached-asset changes; test an already controlled client. |
| `games/mozaiek.html`, `games/rebus.html` | Large inline games plus API/lifecycle code. | 18 and 15 changes in recent 90-day scan. | Preserve shared API/gate contract; test start, heartbeat, score, hint, replay, cleanup. |
| `escape-the-city/src/styles/global.css` | One 1,820-line global stylesheet spans all pages/components. | 8 changes in recent 90-day scan. | Run all viewport, contrast, focus, and outdoor-accessibility checks. |
| `escape-the-city/src/app/gameContext.tsx` | Central local persistence, game rules, and cloud queue coordinator. | 5 changes in recent 90-day scan. | Add state/queue tests before modifying transitions or sync order. |

### 6) `[ASK USER]` Questions

No unresolved intent questions.

### 7) Evidence

- `README.md`
- `AGENTS.md`
- `service-worker.js`
- `dashboard.html`
- `supabase/migrations/015_city_game_schema.sql`
- `supabase/migrations/016_city_game_sync_rpcs.sql`
- `supabase/migrations/017_enforce_city_game_rpc_only.sql`
- `escape-the-city/README.md`
- `escape-the-city/src/app/gameContext.tsx`
- `escape-the-city/src/features/offline/offlinePack.ts`
- `escape-the-city/docs/manual-content-checklist.md`
- `escape-the-city/docs/test-results/playwright-mcp-report.md`
