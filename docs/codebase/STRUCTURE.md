# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

| Path | Purpose | Evidence |
|------|---------|----------|
| `index.html` | Dossier registration, game overview, leaderboard, install UI, and root-app orchestration. | `index.html` |
| `dashboard.html` | Standalone activity dashboard using `get_dashboard_activity`. | `dashboard.html` |
| `games/` | Ten standalone dossier game pages plus shared gate, assistant, and styling. | `games/game-shell.js`, `games/game-assistant.js` |
| `supabase-api.js` | Root frontend adapter for anonymous auth and dossier RPC calls. | `supabase-api.js` |
| `app-update.js`, `service-worker.js` | Root PWA registration/update UI and offline shell. | `app-update.js`, `service-worker.js` |
| `assets/`, `icons/` | Root game images and PWA icons. | `service-worker.js`, `manifest.webmanifest` |
| `supabase/migrations/` | Ordered Postgres schema, RPC, authorization, import, and scoring changes for both apps. | `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/016_city_game_sync_rpcs.sql` |
| `escape-the-city/` | Independently built React/Vite city-game app, assets, docs, and tests. | `escape-the-city/package.json`, `escape-the-city/src/main.tsx` |
| `.github/` | Config generator and combined GitHub Pages workflow. | `.github/scripts/generate-config.mjs`, `.github/workflows/escape-the-city.yml` |

### 2) Entry Points

- Root main entry: `index.html`.
- Root secondary entries: `dashboard.html`, ten `games/*.html` pages, `service-worker.js`.
- City main entry: `escape-the-city/index.html` loads `src/main.tsx`; `src/app/App.tsx` selects pages through `HashRouter`.
- Database entry surface: public security-definer functions created by migrations; clients call them through Supabase RPC.
- Deployment selection: `.github/workflows/escape-the-city.yml` copies root static files and only `escape-the-city/dist/` into the city subpath.

### 3) Module Boundaries

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| Root pages and `games/` | DOM UI, game interaction, calls to `window.VriendenweekendApi`. | Direct table access or service-role credentials. |
| `supabase-api.js` | Root Supabase client lifecycle, anonymous auth, timeout/error mapping, RPC mapping, local-dev responses. | Game rendering and scoring formulas. |
| `supabase/migrations/` | Tables, RLS/grants, validation, access checks, authoritative dossier score rules. | Browser-only state or secret values. |
| `escape-the-city/src/app` and `pages` | Provider composition, routing, use-case coordination, page UI. | Raw Supabase setup or migration logic. |
| `escape-the-city/src/features` | Game, audio, location, map, offline, and PWA feature logic. | Deployment assembly. |
| `escape-the-city/src/lib/supabase` | Optional city cloud client, RPC payload mapping, join/sync calls. | Local rendering and route content. |
| `escape-the-city/src/game-data` | Typed, data-driven game pack and stop content. | UI component state. |
| `escape-the-city/public` | Files copied verbatim into built app. | TypeScript source. |

### 4) Naming and Organization Rules

- Root shared files and CSS classes use kebab-case; browser functions and variables use camelCase.
- Root games use Dutch kebab-case filenames such as `tussen-de-letters.html`.
- City React component/page files use PascalCase; utilities, contexts, and feature directories use camelCase or lowercase.
- City source is organized first by app/page/component, then by feature (`audio`, `game`, `location`, `map`, `offline`, `pwa`).
- City imports are relative; `tsconfig.json` declares no path aliases and no barrel-export convention is present.
- Migrations use increasing three-digit prefixes. Applied migrations must not be edited.
- `escape-the-city/dist/` and `node_modules/` are generated/dependency directories and are not source.

### 5) Evidence

- `README.md`
- `AGENTS.md`
- `service-worker.js`
- `supabase-api.js`
- `escape-the-city/src/main.tsx`
- `escape-the-city/src/app/App.tsx`
- `escape-the-city/tsconfig.json`
- `.github/workflows/escape-the-city.yml`
