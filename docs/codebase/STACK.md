# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

| Area | Value | Evidence |
|------|-------|----------|
| Primary languages | Root app: HTML, CSS, browser JavaScript, SQL. City app: TypeScript/TSX and CSS. | `index.html`, `supabase-api.js`, `supabase/migrations/`, `escape-the-city/src/` |
| Runtime + version | Browser runtime. City deploy build uses Node.js 22; no local Node version is pinned. `[TODO]` Choose and record a supported local Node version. | `.github/workflows/escape-the-city.yml`, `escape-the-city/package.json` |
| Package manager | Root app: none. City app: npm with lockfile version 3. | `escape-the-city/package-lock.json` |
| Module/build system | Root app: unbundled classic scripts and a hand-written service worker. City app: ES modules, Vite, TypeScript, Workbox through `vite-plugin-pwa`. | `index.html`, `service-worker.js`, `escape-the-city/package.json`, `escape-the-city/vite.config.ts` |

### 2) Production Frameworks and Dependencies

Versions below are installed versions from `package-lock.json`/`npm ls`; manifest constraints begin at the lower versions in `package.json`.

| Dependency | Installed version | Role in system | Evidence |
|------------|-------------------|----------------|----------|
| React / React DOM | 19.2.8 | City app UI and provider tree. | `escape-the-city/package-lock.json`, `escape-the-city/src/main.tsx` |
| React Router DOM | 7.18.1 | Hash-based routing compatible with GitHub Pages. | `escape-the-city/package-lock.json`, `escape-the-city/src/main.tsx`, `escape-the-city/src/app/App.tsx` |
| Supabase JavaScript | npm 2.111.0; root CDN requests major v2 | Anonymous auth and RPC transport. | `escape-the-city/package-lock.json`, `escape-the-city/src/lib/supabase/client.ts`, `index.html` |
| MapLibre GL | 5.24.0 | Interactive city route map. | `escape-the-city/package-lock.json`, `escape-the-city/src/features/map/RouteMap.tsx` |
| vite-plugin-pwa | 1.3.0 | Generates city service worker and Workbox caches. | `escape-the-city/package-lock.json`, `escape-the-city/vite.config.ts` |
| PostgreSQL/Supabase | Managed service; version not declared `[TODO]` | Stores dossier players/scores and city teams/progress/events; exposes RPCs. | `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/015_city_game_schema.sql`, `supabase/migrations/016_city_game_sync_rpcs.sql` |

Root pages also load `@supabase/supabase-js@2` from jsDelivr without npm or a lockfile.

### 3) Development Toolchain

| Tool | Purpose | Evidence |
|------|---------|----------|
| TypeScript 5.9.3 | Strict type checking; `npm run lint` is `tsc --noEmit`. | `escape-the-city/package-lock.json`, `escape-the-city/tsconfig.json`, `escape-the-city/package.json` |
| Vite 7.3.6 | City development server and production build. | `escape-the-city/package-lock.json`, `escape-the-city/package.json` |
| Vitest 3.2.7 + jsdom 26.1.0 | City unit/component tests in a browser-like DOM. | `escape-the-city/package-lock.json`, `escape-the-city/vitest.config.ts` |
| Python `http.server` | Serves the unbundled root app locally over HTTP. | `README.md`, `AGENTS.md` |
| GitHub Actions | Node 22 build, Pages artifact assembly, deployment. | `.github/workflows/escape-the-city.yml` |

No formatter, ESLint configuration, container runtime, or performance-test tool is present.

### 4) Key Commands

```bash
# Root app
python3 -m http.server 8080

# City app, from escape-the-city/
npm ci
npm run build
npm test
npm run lint
```

### 5) Environment and Config

- Root config: `config.js` / `config.example.js` populate `window.VRIENDENWEEKEND_CONFIG`.
- City config: `escape-the-city/.env.example`; runtime falls back to root `config.js`.
- Deployment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; workflow maps them to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Other city variables: `VITE_GAME_SLUG`, `VITE_ENABLE_DEV_TOOLS`, `VITE_ENABLE_SUPABASE_SYNC`, `VITE_PUBLIC_BASE_URL`, `VITE_MAP_STYLE_URL`.
- Deployment constraint: root files publish at `/`; built city app publishes at `/escape-the-city/`.
- City release constraint: `package.json`, `package-lock.json`, and `manifest.webmanifest` must share a bumped patch version for deployable city changes.

### 6) Evidence

- `README.md`
- `escape-the-city/package.json`
- `escape-the-city/package-lock.json`
- `escape-the-city/tsconfig.json`
- `escape-the-city/vite.config.ts`
- `.github/workflows/escape-the-city.yml`
- `config.example.js`
- `escape-the-city/.env.example`
