# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item | Rule | Example | Evidence |
|------|------|---------|----------|
| Root files/classes | Kebab-case. | `game-shell.js`, `.secondary-action` | `games/game-shell.js`, `games/game-shell.css` |
| City React files/types | PascalCase for component/page files and exported types/interfaces. | `ChallengePage.tsx`, `GameContextValue` | `escape-the-city/src/pages/ChallengePage.tsx`, `escape-the-city/src/app/gameContext.tsx` |
| Utility files | camelCase or lowercase by existing feature convention. | `gameState.ts`, `offlinePack.ts`, `storage.ts` | `escape-the-city/src/features/` |
| Functions/variables | camelCase. | `ensureAuth`, `scheduleSync`, `buildAssetManifest` | `supabase-api.js`, `escape-the-city/src/app/gameContext.tsx` |
| SQL parameters/variables | `p_` parameters and `v_` local variables in dossier RPCs; descriptive snake_case in city schema. | `p_game_id`, `v_uid`, `owner_user_id` | `supabase/migrations/013_rebusmachine_score_formula.sql`, `supabase/migrations/015_city_game_schema.sql` |
| Constants/env vars | Upper snake case. | `TIMEOUT_MS`, `VITE_MAP_STYLE_URL` | `supabase-api.js`, `escape-the-city/.env.example` |

### 2) Formatting and Linting

- Indentation: repository guideline requires two spaces for JavaScript, HTML, CSS, and SQL.
- Formatter: none configured.
- Linter: no ESLint; `npm run lint` runs TypeScript with `strict: true`, `target: ES2022`, and bundler module resolution.
- Relevant enforced rules: strict TypeScript checking, no emit during lint, JSX transform `react-jsx`.
- Commands: `cd escape-the-city && npm run lint`; no automated root-app lint command exists.

### 3) Import and Module Conventions

- Root browser scripts are dependency-free IIFEs where reusable globals are needed; pages load them with classic `<script>` tags.
- City code uses ES module imports, normally external imports before relative imports.
- City imports use relative paths; there are no `paths` aliases in `tsconfig.json`.
- No barrel (`index.ts`) export policy appears in `src/`.
- Browser pages must use `window.VriendenweekendApi` for dossier backend calls. `dashboard.html` currently differs by creating a client itself.

### 4) Error and Logging Conventions

- Root adapter: rejects with user-readable Dutch `Error` messages, maps auth/network failures, and applies a 12-second RPC timeout.
- Root pages: catch failures at UI actions and render Dutch blocked/error states; selected background failures use `console.warn`/`console.error`.
- City domain helpers: throw on invalid configuration/data; page actions catch unknown values and convert them to visible Dutch messages.
- City offline sync: persists attempts and last errors, stops a queue flush at first failed event, and exposes status through context.
- Logging: browser console only; no structured logging library or required context-field format.
- Sensitive-data rule: repository policy forbids service-role keys, passwords, JWT secrets, exports, and player data. `[TODO]` No executable redaction/logging policy is configured.

### 5) Testing Conventions

- City tests are co-located as `*.test.ts` or `*.test.tsx`.
- Tests import `describe`, `it`, `expect`, lifecycle helpers, and `vi` directly from Vitest.
- Browser globals are replaced with small local fakes/spies; `src/test/setup.ts` installs a deterministic `localStorage`.
- Root app and SQL use documented manual flows rather than automated tests.
- Coverage expectation: `[TODO]` no coverage provider, command, threshold, or current report is configured.

### 6) Evidence

- `AGENTS.md`
- `supabase-api.js`
- `games/game-shell.js`
- `escape-the-city/tsconfig.json`
- `escape-the-city/package.json`
- `escape-the-city/src/app/gameContext.tsx`
- `escape-the-city/src/test/setup.ts`
- `escape-the-city/src/lib/supabase/sync.test.ts`
