# Repository Guidelines

## Project Structure & Module Organization

This is a static GitHub Pages PWA for *Het Verzegelde Dossier*. The root holds the main application pages (`index.html`, `dashboard.html`), shared browser code (`supabase-api.js`, `app-update.js`), PWA files (`manifest.webmanifest`, `service-worker.js`), and runtime configuration (`config.js`).

Individual games live in `games/`: each game is a standalone HTML page, while `game-shell.js`/`.css` provide shared gate and layout behavior. Keep reusable game UI in shared files rather than duplicating it across games. Images belong in `assets/`; PWA icons belong in `icons/`. Database schema and operational changes are ordered SQL files in `supabase/migrations/`; read `supabase/legacy-import.md` before importing historical data. `Code.gs` is a rollback-only legacy copy—do not wire it into the current frontend.

## Build, Test, and Development Commands

No package manager, bundler, or automated test suite is configured. Serve the repository over HTTP so service-worker behavior is realistic:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`, configure Supabase using `config.example.js` as a starting point, then manually test registration, game access, score submission, dashboard data, and replay behavior. After changes that affect cached assets, increment the cache version in `service-worker.js` and verify an update reaches a previously loaded page.

## Coding Style & Naming Conventions

Use two-space indentation for JavaScript, HTML, CSS, and SQL. Keep browser scripts dependency-free, wrapped in an IIFE where appropriate, and use `window.VriendenweekendApi` for backend calls—do not call Supabase tables directly from pages. Prefer `camelCase` for JavaScript functions and variables, kebab-case for CSS classes and asset filenames, and descriptive Dutch UI copy consistent with the existing interface. Use `textContent` for dynamic text unless HTML is deliberately required.

## Database, Security, and Configuration

Add migrations with the next zero-padded numeric prefix (for example, `013_add_feature.sql`); never edit an applied migration. The frontend may contain only the Supabase URL and publishable key. Never commit service-role keys, passwords, JWT secrets, local exports, or player data. Keep score calculation and access rules in security-definer RPCs.

## Commit & Pull Request Guidelines

History uses concise imperative subjects, often Conventional Commit prefixes: `feat: add dashboard filter`, `fix: restore player session`, or `Bump service worker cache version`. Keep each commit focused. Pull requests should explain the user-visible change, list any migration and cache-version implications, link relevant issues, and include screenshots for UI changes. State the manual test cases you ran.
