# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: two client-side PWAs sharing one deployment and Supabase project.
- Root app style: static multi-page application with inline game modules, shared browser adapters, and RPC-oriented backend.
- City app style: feature-organized React SPA with a context-based application layer, local-first persistence, queued optional cloud sync, and data-driven game content.
- Primary constraints: GitHub Pages has no application server; both apps must work as installable PWAs; browser code may contain only public Supabase configuration; city routes live below `/escape-the-city/`.

### 2) System Flow

Root dossier flow:

```text
index/game HTML -> window.VriendenweekendApi -> anonymous Supabase session
-> public security-definer RPC -> private Postgres tables -> JSON -> DOM
```

1. `index.html` loads public config, Supabase browser v2, and `supabase-api.js`.
2. `supabase-api.js` creates one persisted anonymous client/session and maps named frontend actions to RPCs.
3. A game asks `get_game_access`, registers a start/heartbeat, and submits timing/attempt detail.
4. SQL RPCs validate the user, game state, and payload; dossier scoring is calculated in Postgres.
5. The returned state/hint is rendered by the page; `service-worker.js` handles same-origin shell fallback.

City-game flow:

```text
React route -> GameProvider -> IndexedDB queue/local progress
-> optional Supabase RPC -> city_game tables -> merged cloud state -> React UI
```

1. `src/main.tsx` registers the PWA and mounts providers plus `HashRouter`.
2. `App.tsx` validates `gamePack` and routes to page components.
3. `GameProvider` applies game rules, persists team/progress/queue locally, and updates React state.
4. Pending events serialize through `scheduleSync`; online, visibility, and manual actions trigger retries.
5. `sync.ts` establishes anonymous auth and calls `sync_city_game_state` or `join_city_game_team`.
6. SQL verifies membership, upserts team/progress, deduplicates events by event ID, and returns cloud state.

### 3) Layer/Module Responsibilities

| Layer or module | Owns | Must not own | Evidence |
|-----------------|------|--------------|----------|
| Root HTML/game pages | Presentation and game interaction. | Supabase table queries and server-authoritative dossier scoring. | `index.html`, `games/memory.html`, `AGENTS.md` |
| `supabase-api.js` | Root auth/client singleton, RPC transport, errors/timeouts. | Page-specific UI. | `supabase-api.js` |
| Dossier SQL RPCs | Access, validation, score calculation, persistence. | Browser presentation. | `supabase/migrations/013_rebusmachine_score_formula.sql` |
| City `App`/pages | Route composition and user-facing flows. | Storage implementation and raw cloud calls. | `escape-the-city/src/app/App.tsx` |
| City `GameProvider` | Use cases, state transitions, queue scheduling, local-first coordination. | SQL schema and visual map implementation. | `escape-the-city/src/app/gameContext.tsx` |
| City feature modules | Focused domain/browser capabilities. | Deployment workflow. | `escape-the-city/src/features/` |
| City Supabase library | Client creation and RPC DTO mapping. | React UI. | `escape-the-city/src/lib/supabase/` |
| SQL migrations | Durable schemas, RLS/grants, RPC authorization. | Frontend state. | `supabase/migrations/` |

### 4) Reused Patterns

| Pattern | Where found | Why it exists |
|---------|-------------|---------------|
| Adapter/facade | `supabase-api.js` | Gives root pages one named RPC interface and one auth/client lifecycle. |
| Lazy singleton | `supabase-api.js` (`client`, `authPromise`) | Reuses client and concurrent anonymous-session setup. |
| Provider/context | `escape-the-city/src/app/providers.tsx`, `gameContext.tsx`, `audioContext.tsx` | Shares game and audio state across routed pages. |
| Local-first outbox | `features/offline/storage.ts`, `app/gameContext.tsx` | Commits play locally before optional cloud sync. |
| Serialized async chain | `scheduleSync` in `gameContext.tsx` | Prevents overlapping queue flushes. |
| Data-driven game | `game-data/moerasdraak/game.ts` | Keeps seven stop definitions separate from generic page/feature logic. |
| Security-definer RPC boundary | dossier and city sync migrations | Centralizes privileged database operations and membership checks. |
| Separate cache scopes | root `service-worker.js`, city Workbox config | Prevents root service worker from controlling city subapp. |

### 5) Known Architectural Risks

- Root game pages are large inline HTML/CSS/JS units (several exceed 1,000 lines), so shared behavior can drift despite `game-shell.js` and `game-assistant.js`.
- Two PWA implementations, config paths, and version mechanisms must remain coordinated during one Pages deployment.
- `dashboard.html` creates its own Supabase client and calls an RPC directly, unlike the stated single-adapter rule. This known exception remains unchanged by decision.
- City score/progress is computed locally and accepted by a sync RPC, while dossier scores are server-calculated. This is a trust-model difference, not one uniform scoring boundary.

### 6) Evidence

- `README.md`
- `supabase-api.js`
- `service-worker.js`
- `supabase/migrations/013_rebusmachine_score_formula.sql`
- `supabase/migrations/016_city_game_sync_rpcs.sql`
- `escape-the-city/src/main.tsx`
- `escape-the-city/src/app/gameContext.tsx`
- `escape-the-city/src/features/offline/storage.ts`
- `escape-the-city/src/lib/supabase/sync.ts`
- `escape-the-city/vite.config.ts`
