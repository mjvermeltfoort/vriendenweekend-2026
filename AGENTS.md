# Repository Overview

## Project Description
- What this project does
  - Hosts a static GitHub Pages PWA for “Het Verzegelde Dossier”: registration, ten puzzle games, leaderboard, and a guarded final-location guess.
  - Contains a second app under escape-the-city/: a React/TypeScript PWA for the city game “Het Geheim van de Moerasdraak” with team flow, GPS, offline cache, and an operators’ dashboard.
- Main purpose and goals
  - Run fully in the browser with offline support; use Supabase only for anonymous auth and approved RPCs.
  - Keep server-authoritative scoring and access control in Postgres RPCs; never expose table grants to clients.
  - Publish both apps via one GitHub Pages deployment without a custom backend.
- Key technologies used
  - Root app: HTML/CSS/vanilla JS, custom service worker, Supabase JS v2 via CDN, Postgres SQL RPCs.
  - City app: React 19, TypeScript 5.9, Vite 7, vite-plugin-pwa (Workbox), MapLibre GL, Vitest.
  - CI/CD: GitHub Actions Pages; runtime config via config.js; .nvmrc pins Node 26.5.0 for local dev.

## Architecture Overview
- High-level architecture
  - Two PWAs, one Supabase project and one GitHub Pages site.
  - Root dossier app is a static multi-page site; escape-the-city is an independently built SPA published at /escape-the-city/.
- Main components and their relationships
  - Root HTML pages call window.VriendenweekendApi (supabase-api.js) which maps named actions to security-definer RPCs. service-worker.js caches the app shell and explicitly avoids controlling the city subpath.
  - dashboard.html is a standalone root dashboard that creates its own Supabase client and calls get_dashboard_activity.
  - City app composes providers/contexts, persists progress locally first, and optionally syncs to Supabase via dedicated RPCs defined in supabase/migrations (015+).
- Data flow and system interactions
  - Root: Page -> VriendenweekendApi -> anonymous Supabase session -> public RPC -> private tables -> JSON -> DOM.
  - City: React route -> GameProvider/local queue -> optional Supabase RPCs -> city_game tables -> merged cloud state -> React UI.
  - Deployment: GitHub Actions builds the city app, generates config.js from repo variables, and assembles a single Pages artifact where only /escape-the-city/ contains the city build.

## Directory Structure
- Important directories and their purposes
  - games/: Ten standalone dossier games (each an HTML page) plus shared UI (game-shell.js/.css, game-assistant.js/.css).
  - escape-the-city/: React/TypeScript SPA with src/, public/, docs/, dist/ (build output), tests via Vitest.
  - supabase/migrations/: Ordered SQL schema, RLS, RPCs, imports, and dashboard functions for both apps.
  - docs/: Reference architecture/stack/structure, design assets, and operational notes.
  - .github/: Pages workflow and script to generate public runtime config.
  - assets/, icons/: Root images and PWA icons.
- Key files and configuration
  - index.html, dashboard.html: Root entry pages.
  - supabase-api.js: Single frontend adapter for root app RPC calls and auth lifecycle; includes localDevMode fallbacks.
  - service-worker.js: Root offline shell cache and navigation fallbacks; ignores the /escape-the-city/ scope.
  - manifest.webmanifest: Root PWA metadata and icons.
  - config.js and config.example.js: Public runtime configuration (Supabase URL and publishable key only).
  - escape-the-city/package.json, vite.config.ts, manifest.webmanifest: City build, versioning, and PWA config (base '/escape-the-city/').
- Entry points and main modules
  - Root: index.html and games/*.html plus service-worker.js; operators’ dashboard at /dashboard.html.
  - City: escape-the-city/index.html -> src/main.tsx; routes and providers compose the SPA.

## Development Workflow
- How to build/run the project
  - Root app (serve over HTTP to exercise the service worker):
    - python3 -m http.server 8080 and open http://localhost:8080
    - Fill config.js using config.example.js as a template.
  - City app:
    - cd escape-the-city && npm install && npm run dev
    - For builds: npm run build (uses base '/escape-the-city/')
  - GitHub Actions deploys both apps to Pages; it generates config.js using repo variables SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY and publishes the city build under /escape-the-city/.
- Testing approach
  - Root app: manual testing (registration, access, gameplay, scoring, replay, final-location guess, dashboard fetch).
  - City app: Vitest + jsdom. Commands: npm test, npm run test:watch. See escape-the-city/src and vitest.config.ts.
- Development environment setup
  - Supabase: enable Anonymous provider; run migrations in order (001–014 for dossier; 015+ for city features).
  - Config: copy .env.example to .env in escape-the-city when developing locally; the app can also fall back to root config.js at runtime.
  - Node: .nvmrc pins 26.5.0 (the CI also uses Node 26.5.0). Browsers are the runtime for the root app.
- Lint and format commands
  - City lint: npm run lint (tsc --noEmit). No ESLint/Prettier config is present.
  - No formatter is configured repo-wide; follow two-space indentation for JS/HTML/CSS/SQL.
- Operational and release notes
  - Root: bump CACHE_NAME in service-worker.js when changing cached assets and verify update flow on previously loaded clients.
  - City: for any deployable change, bump the same patch version in package.json, package-lock.json, and manifest.webmanifest (the Workbox cacheId includes the package version). Verify the new service worker activates and updates an already installed app.
  - Security: never commit service-role keys, DB passwords, JWT secrets, local exports, or player data. Clients may contain only the Supabase URL and publishable key. Keep score calculation and access control in security-definer RPCs.
  - Known constraints: The root dashboard at /dashboard.html is intentionally open to anyone with the URL; do not link it from player flows. Root game pages are large single files—prefer shared utilities in games/ to avoid drift.
