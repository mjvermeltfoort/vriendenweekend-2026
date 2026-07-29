# Testing Patterns

## Core Sections (Required)

### 1) Test Stack and Commands

- Primary automated framework: Vitest 3.2.7 with jsdom 26.1.0, city app only.
- Assertions/mocks: Vitest `expect` and `vi`; React DOM `createRoot` for small component checks.
- Verified on 2026-07-29 in this checkout: TypeScript lint passed; 17 files/54 tests passed; production build passed with a chunk-size warning.

```bash
cd escape-the-city
npm test
npm run lint
npm run build

# Watch mode
npm run test:watch

# Root/manual serving
python3 -m http.server 8080

# Coverage and automated E2E
[TODO] No commands are configured.
```

### 2) Test Layout

- City tests are co-located beside source as `*.test.ts` and `*.test.tsx`.
- Global setup: `escape-the-city/src/test/setup.ts`, loaded by `vitest.config.ts`.
- Setup replaces `localStorage` with an in-memory implementation suitable for jsdom.
- Manual matrices/checklists live in `escape-the-city/docs/`.
- A dated production browser report and screenshots live under `escape-the-city/docs/test-results/`.
- Root dossier app and SQL migrations have no automated test files/config.

### 3) Test Scope Matrix

| Scope | Covered? | Typical target | Notes |
|-------|----------|----------------|-------|
| Unit | Yes, city only | Scoring, state, validation, distance, GeoJSON mapping, storage, audio config, sync payloads. | Pure helpers dominate; 17 current test files. |
| Component | Partial, city only | Contrast controller, install banner, map marker. | Uses jsdom and direct React roots; no broad page-flow suite. |
| Integration | Partial | Local file existence, generated PWA config text, Supabase payload mapping. | Tests do not call a real Supabase project or apply SQL migrations. |
| E2E | Manual evidence only | Production route, GPS, audio, accessibility, PWA, cloud team flow. | Playwright MCP report exists, but no checked-in executable Playwright suite/config. |
| Root app | Manual only | Registration, access, score, dashboard, replay, service-worker update. | Required flow is documented in `AGENTS.md`. |

### 4) Mocking and Isolation Strategy

- Small browser surfaces are faked directly: in-memory `localStorage`, `vi.fn()`, and provider fakes.
- Most game-rule tests call pure functions with the checked-in `gamePack`.
- Supabase tests validate RPC payload and remote merge logic without mocking network calls because transport functions are not exercised.
- Vitest isolates test modules; storage tests clear the fake `localStorage` in `beforeEach`.
- Common gap: IndexedDB-backed full provider flows, service-worker upgrades, real geolocation permission behavior, and SQL authorization require manual or browser/integration testing.

### 5) Coverage and Quality Signals

- Coverage tool + threshold: `[TODO]` none configured.
- Current reported coverage: `[TODO]` no coverage report exists.
- Current deterministic signal: `npm run lint`, `npm test`, and `npm run build` pass.
- Build quality signal: Vite reports `index` at about 543 kB and `maplibre-gl` at about 1,053 kB minified, both above its 500 kB warning threshold.
- Manual quality signals: viewport/accessibility checklist, content/GPS checklist, offline checklist, and dated Playwright MCP production report.
- Known gaps: root dossier automation, SQL/RLS tests, executable E2E suite, automated offline transition, and an enforced coverage threshold.

### 6) Evidence

- `escape-the-city/package.json`
- `escape-the-city/package-lock.json`
- `escape-the-city/vitest.config.ts`
- `escape-the-city/src/test/setup.ts`
- `escape-the-city/src/features/game/gameState.test.ts`
- `escape-the-city/src/lib/supabase/sync.test.ts`
- `escape-the-city/docs/test-checklist.md`
- `escape-the-city/docs/design-test-checklist.md`
- `escape-the-city/docs/test-results/playwright-mcp-report.md`
- `AGENTS.md`
