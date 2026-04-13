# Create ARCHITECTURE.md — Single Source of Truth

## Agent
`base-template-generator` (lead) with `api-designer` consult. No such agents will exist yet at repo root — until prompt 03 imports them, the executor must treat this task as pure reading + writing. The executor MUST NOT hallucinate architecture — every claim in the document must be grounded in a real file read.

## Depends on
none — this is the first prompt and blocks every subsequent prompt.

## Goal
Produce `/home/serverlessbase/whynot/ARCHITECTURE.md` at repo root as the authoritative, exhaustive, and living system-architecture document for `whynot`. This file becomes the **single source of truth** that every Claude agent, every opencode agent, every skill, every `.cursorrules` rule, and every subsequent migration prompt file (03–62) will reference. Also produce/update `CLAUDE.md` and `AGENTS.md` at repo root to point at `ARCHITECTURE.md`.

## Task

### 1. Read the entire repo exhaustively BEFORE writing a single line of `ARCHITECTURE.md`
Mandatory reads (expand as needed — do not skip any):
- `package.json` at repo root and in every sub-package (`frontend/`, `admin-frontend/`, `gateway/`, `services/*/`, `shared/`).
- `.cursorrules` — summarize its guidance into section 17 (Conventions).
- Every top-level folder listing (one-level `ls` minimum; deeper where needed).
- `docker-compose*.yml` files at repo root and inside any service.
- `gateway/src/api/main.ts` (route index).
- `gateway/src/middleware/*.ts` (auth, rate limiters, credit-gate, feature-gate, subscription-check).
- `services/qa-loop-executor/src/v2/` — **READ ONLY**. Catalog entry points (`orchestrator.ts`, `agent-board.ts`, `agents/*.ts`, `tools/*.ts`) but do not modify.
- `services/qa-loop-executor/src/mcp-browser.ts` — **READ ONLY**.
- `services/database/migrations/` — list every file, note the highest ordinal and the purpose of each migration (one short sentence each).
- `shared/database/repositories/*.ts` — list repositories and the tables they wrap.
- `shared/logger/*`, `shared/types/*`, `shared/utils/*`.
- `frontend/src/pages/*` and `frontend/src/components/*` — catalog every page and top-level component.
- `admin-frontend/src/pages/*` and `admin-frontend/src/components/*`.
- `services/ai-service/` entry points (Python FastAPI).
- `services/test-executor/` entry points.

After this pass, the executor MUST be able to answer (privately) for every sub-section of the template below: "which file(s) back this claim?"

### 2. Write `ARCHITECTURE.md` with exactly these 20 sections, in this order, each non-empty

#### Section 1 — System overview
- 1 paragraph elevator description (≤120 words) of what whynot does: autonomous QA agents for web apps with multi-model AI, test execution, visual regression, subscription + PAYG billing.
- ASCII or Mermaid diagram showing: user → frontend → gateway → [ai-service | test-executor | qa-loop-executor] → Postgres / Redis / external (Stripe, LLM providers).
- Glossary preview: AI agents (QA Lead, API Tester, Auto Tester, Exploratory Tester, Security Tester), workspaces, projects, test cases, executions, PAYG credits, feature flags.

#### Section 2 — Monorepo layout
A table with columns **Folder | Purpose | Tech | Key entry files | Owner convention**. One row per top-level folder. Must include (exhaustive — verify every folder exists before listing):
- `frontend/` — user-facing Vite+React+TS SPA; port 5183; entry `src/main.tsx`, `src/App.tsx`.
- `admin-frontend/` — Vite+React+TS superadmin SPA; port 5184; entry `src/main.tsx`.
- `gateway/` — Express+TS API orchestrator; entry `src/index.ts`, routes `src/api/main.ts`.
- `services/ai-service/` — Python FastAPI; LLM test generation.
- `services/test-executor/` — Node+TS Playwright runner; entry `src/api/routes.ts`.
- `services/qa-loop-executor/` — autonomous agent runner; **v2/ and mcp-browser.ts are untouchable**.
- `services/database/` — SQL migrations; **untouchable except with user coordination**.
- `shared/` — cross-service types, repositories, logger, utilities.
- `docs/` — 5-language documentation (created in later prompts).
- `examples/`, `scripts/` — one-off helpers.
- `prompts/` — this migration's prompt files.
- `.claude/`, `.opencode/` — agent/skill/rule definitions (populated by prompt 03).

#### Section 3 — Runtime topology
- Docker-compose services list with their ports, env vars (grouped: required / optional / secrets), dependencies, health checks.
- Networking: which service talks to which, and over what protocol (HTTP / Postgres / Redis).
- Docker-only execution rule: `no host-installed Node; every command runs inside docker compose`.
- Volume mounts (source, data, logs).

#### Section 4 — Data plane
- Postgres schema overview: every table from `services/database/migrations/` (by name, purpose, primary FKs). Do not copy SQL — summarize.
- FK diagram (Mermaid ER): users → workspaces → projects → test_cases → executions; users → subscriptions → plans; usage-events, audit-logs.
- Migration convention: path `services/database/migrations/`, naming `NNN_short_name.sql`, rollback file, highest ordinal = `042_session_report_data.sql` (update to the real number when writing).
- **Untouchable rule**: do not edit existing migration files; new migrations require user coordination.
- Raw-SQL repository pattern: repositories in `shared/database/repositories/`, each wrapping `pg.Pool`, returning camelCase objects, org-scoped by `orgId`.
- **Money**: stored as `bigint` cents everywhere. No floats. No `numeric`. Conversion helpers live in `shared/utils/money.ts` (will be created in phase 7).

#### Section 5 — API surface
- Gateway Express routes — catalog the top-level routers (`/api/auth`, `/api/projects`, `/api/executions`, `/api/qa-loop`, `/api/webhooks/stripe`, etc.). One line per router.
- Auth middleware: JWT in `Authorization: Bearer`, decoded in `gateway/src/middleware/auth.ts`, attaches `req.user` with `userId`, `orgId`, `role`.
- Rate limiters: per-endpoint limits in `gateway/src/middleware/rate-limit.ts`.
- Org-scoping rule: every query joins on `org_id`; repositories enforce it; cross-org reads forbidden.
- Cursor pagination rule: list endpoints accept `?cursor=<base64>&limit=<n≤100>` and return `{ items, nextCursor }`. No offset pagination.
- ISO 8601 rule: all timestamps serialized as ISO 8601 UTC strings.
- camelCase rule: all JSON bodies and responses use camelCase.
- Error envelope: `{ error: { code, message, details? } }` where `message` is already localized via `Accept-Language` (see section 14).

#### Section 6 — AI subsystem
- **v2 engine is the core** (`services/qa-loop-executor/src/v2/`): read-only from this migration's perspective. Catalog entry points (`orchestrator.ts`, `agent-board.ts`, `agent-context-builder.ts`, `agents/qa-lead.ts`, `agents/api-tester.ts`, `agents/auto-tester.ts`, `agents/exploratory-tester.ts`, `agents/security-tester.ts`, `tools/*.ts`). Note the providers it uses: `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`, `ai` (Vercel AI SDK).
- `mcp-browser.ts` — read-only.
- AI provider factory (to be added in phase 6, prompt 27): all **non-v2** AI calls in the gateway MUST route through `gateway/src/utils/ai/select-ai-provider.ts`. The v2 engine keeps its own provider wiring intact.
- BYO-keys multi-model architecture: users store their own keys in `user_ai_config` (prompt 29); `selectAIProvider()` resolves the right SDK instance per request.
- OpenRouter note: must use `createOpenAICompatible(...)`, not the Responses API — see commit `e231a08` on branch `v2`.

#### Section 7 — Frontend architecture
- Vite + React 18 + TypeScript.
- Shadcn design system (added in phase 1, prompt 07): zinc base, oklch CSS variables, `.dark` class selector, `STYLES.md` is the token reference.
- `components.json` at `frontend/components.json` and `admin-frontend/components.json`.
- Routing: TanStack Router or React Router (document which — verify from current code).
- State: React Query for server state, Context for feature flags + theme + i18n.
- i18n (phase 4, prompt 17): `react-i18next`, 5 locales (en, ar, fr, de, es), files under `public/locales/`, switcher component in header.
- RTL: Arabic only, toggled via `<html dir="rtl">` driven by i18n detect.
- Dark mode: class-based, toggle persisted to `localStorage.theme`.
- Mobile-first: every Tailwind class starts mobile, adds `sm:`/`md:`/`lg:` progressively.
- Feature flag hook: `useFeatureFlag(key)` from `frontend/src/hooks/useFeatureFlag.ts` (phase 5, prompt 25).

#### Section 8 — Admin architecture
- `admin-frontend/` runs on port 5184.
- `requireSuperadmin` middleware (phase 8, prompt 41) gates all `/api/superadmin/*` routes.
- Management page taxonomy: Users, Orgs, Plans, BillingConfig, FeatureFlags, AIProviders, Audit, Analytics, Announcements, Usage, SystemSettings.
- Cursor-paginated tables throughout. All data camelCase + ISO 8601.

#### Section 9 — Billing & payments
- Stripe via `gateway/src/payments/payment-service.ts` (phase 7, prompt 33, ported from reference).
- Two user tiers:
  - **BYO-keys**: ~$20/mo (price overridable from `billing_config`); user brings own LLM API keys from Settings > AI tab.
  - **Managed + PAYG**: ~$20/mo base + pay-as-you-go credits charged via `chargePayg()` from the usage-events rollup.
- Free trial: duration configurable via superadmin → `billing_config.trial_days` (default 7).
- Money: `bigint` cents everywhere, never float.
- Webhook idempotency: `payment_webhooks_idempotency` table, dedupe on Stripe `event.id`.
- Pricing override: `shared/constants/pricing.ts` defines defaults; `billing_config` row overrides at runtime.

#### Section 10 — Feature flag system
- Tables: `feature_flags` (global defaults) + `organization_feature_flags` (per-org overrides).
- Registry: `shared/constants/platform-features.ts` exports `PLATFORM_FEATURES` enum and `isValidFeatureKey()` guard.
- Gateway util: `gateway/src/utils/feature-flags.ts` with 60-second TTL in-memory cache.
- Middleware: `gateway/src/middleware/require-flag.ts` — 403 with localized error if flag disabled.
- React hook: `frontend/src/hooks/useFeatureFlag.ts` — fetches `/api/me/flags` and exposes `useFeatureFlag(key)`.
- Admin UI: `admin-frontend/src/pages/FeatureFlagsPage.tsx`.
- Audit: every flag mutation writes to `audit_logs`.

#### Section 11 — Usage tracking
- Table: `usage_events` (id, orgId, userId, eventType, metadata jsonb, creditsCharged bigint, createdAt).
- Tracker: `gateway/src/utils/usage-tracker.ts` — `trackEvent(orgId, userId, type, metadata, credits)` with batched writes.
- Hook points: test run, AI call, visual diff, report export, any metered feature.
- Rollup: monthly job aggregates events → `chargePayg()` for Managed+PAYG tier users.
- Exposed to users via Settings > Usage tab, and to superadmins via UsageTrackingPage.

#### Section 12 — Observability
- Logger: `shared/logger/` (pino or similar — verify from code).
- Audit log table: captures every superadmin mutation + every flag change + every AI key change + every payment event + every auth event.
- Trace IDs: injected by gateway middleware, propagated to downstream services via `X-Trace-Id` header.
- Metrics: document whether Prometheus / OpenTelemetry is wired; if not, mark "TODO (future prompt)".

#### Section 13 — Security model
- Auth: JWT in `Authorization: Bearer`, signing key from env `JWT_SECRET`, 24h expiry (verify).
- Org-scoping: every repository method requires `orgId`; cross-org queries impossible by construction.
- Password hashing: `bcryptjs` (10 rounds).
- API-key hashing at rest: sha256, shown once on creation.
- Secrets encryption: user LLM API keys encrypted with AES-256-GCM using env `AI_CONFIG_ENCRYPTION_KEY`.
- Superadmin role: `users.role = 'superadmin'`, gated by `requireSuperadmin` middleware.
- Rate limits: per-endpoint, per-IP, per-user.

#### Section 14 — i18n & accessibility
- 5 languages: en, ar, fr, de, es.
- RTL: Arabic — `<html dir="rtl">` via i18next language-detector; Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`) preferred.
- Backend: `Accept-Language` header → `req.t(key)` helper → response envelope's `error.message` already localized.
- WCAG 2.1 AA target.
- axe-core runs on every Playwright test.
- Lighthouse ≥95 performance / 100 SEO / ≥95 a11y on landing page (phase 9).
- Translation completeness tests (phase 4, prompt 20) assert identical key sets across all 5 locales.

#### Section 15 — Testing
- Vitest + `@vitest/coverage-v8` for unit / integration in `frontend/`, `admin-frontend/`, `gateway/`, `shared/`, each service.
- Playwright for e2e UI — projects: desktop + mobile × light + dark × ltr + rtl (ar) × 5 languages for critical flows, 1×1×1 for non-critical.
- Supertest for gateway API.
- axe-core + `@axe-core/playwright` for a11y.
- lighthouse-ci for performance/SEO.
- **Docker-only**: all tests via `docker compose -f docker-compose.test.yml up --abort-on-container-exit`. Never `npm test` on host.
- Coverage thresholds (enabled in final phase, prompt 61): `lines/branches/functions/statements: 100`.
- Excludes (authoritative): `services/qa-loop-executor/src/v2/**`, `services/qa-loop-executor/src/mcp-browser.ts`, generated files.
- Canonical test commands (update as actual scripts land):
  - `docker compose -f docker-compose.test.yml run --rm gateway bun vitest run`
  - `docker compose -f docker-compose.test.yml run --rm frontend bunx playwright test`
  - `docker compose -f docker-compose.test.yml run --rm gateway bun vitest run --coverage`

#### Section 16 — Untouchable paths (AUTHORITATIVE)
Reproduced verbatim in every subsequent prompt file and every agent definition:

```
- services/qa-loop-executor/src/v2/
- services/qa-loop-executor/src/mcp-browser.ts
- services/database/migrations/   (no edits to existing files; new migrations require user coordination)
```

Reason:
- `v2/` is the production agent engine; changing it risks production incidents and invalidates thousands of runs.
- `mcp-browser.ts` is the MCP integration that the engine depends on.
- `migrations/` is append-only by convention; editing existing migrations breaks every downstream deployment and seed script.

#### Section 17 — Conventions
Reproduce the full list (each with a 1-line rationale):
- **Docker-only execution** — parity across dev/CI/prod.
- **bigint cents for money** — no float rounding errors.
- **Org-scoped data access** — multi-tenant safety.
- **Cursor-based pagination** — stable under inserts.
- **ISO 8601 dates** — unambiguous across timezones.
- **camelCase API responses** — matches TS conventions.
- **Mobile-first** — 70%+ expected traffic.
- **Dark mode** — first-class, not retrofitted.
- **RTL support** — Arabic is a supported language.
- **No backwards-compat shims** — delete old code in the same PR that replaces it.
- **No comments unless the WHY is non-obvious**.
- **Tests accompany every change** — no orphan code.

#### Section 18 — Agent & skill registry
Table with columns **Name | Type (claude/opencode/skill/rule) | Path | Purpose | ARCHITECTURE.md section it reads**. Populated initially with a placeholder row `TBD - prompt 03` and updated in prompt 04's validation pass once the assets are imported. The final row count must match `find .claude/agents .claude/skills .claude/rules .opencode/agent .opencode/command -type f | wc -l`.

#### Section 19 — How to update this file
- Any prompt/commit that introduces or changes a subsystem MUST amend the relevant section in the same commit.
- PRs that change architecture without updating this file are rejected by the reviewer.
- Section numbering is stable. New sections append with the next number and an entry in the Glossary.
- Do not delete sections — mark them `(deprecated YYYY-MM-DD)` instead.

#### Section 20 — Glossary
Alphabetical, ≥25 entries. Include: API Gateway, Audit Log, BYO-keys, camelCase rule, Credits ledger, Cursor pagination, Dark mode class, Feature flag, i18n, ISO 8601, JWT, LLM provider, Managed+PAYG, Migration, Mobile-first, OKLCH, Org-scoping, PAYG, QA Loop, RTL, Shadcn, STYLES.md, Superadmin, Trial days, Untouchable path, Usage event, v2 engine, Vitest, WCAG 2.1 AA, Webhook idempotency.

### 3. Write/update `CLAUDE.md` and `AGENTS.md` at repo root
Both files are short (≤80 lines each) and their first paragraph must read, verbatim:

> **Single source of truth**: See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for authoritative system architecture, conventions, untouchable paths, data model, API surface, and testing strategy. This file covers only per-branch conventions and agent invocation rules. When in conflict, `ARCHITECTURE.md` wins.

Then list:
- Top 10 rules (the user's constraint list) as a bulleted quickref.
- Agent invocation quickref: which agents live where, when to use which.
- Command quickref: the canonical Docker test commands from section 15.

### Files to create/modify
- `/home/serverlessbase/whynot/ARCHITECTURE.md` — **new**, ≥2500 lines (section 4's table + section 2's table + section 20's glossary push this naturally).
- `/home/serverlessbase/whynot/CLAUDE.md` — new (or overwrite if exists).
- `/home/serverlessbase/whynot/AGENTS.md` — new (or overwrite if exists).

### Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/` — read only to gather entry points for section 6.
- `services/qa-loop-executor/src/mcp-browser.ts` — read only.
- `services/database/migrations/` — read only (list files, do not edit).

### Tests
No runtime tests in this prompt — the validation prompt 02 performs every check. However, the executor MUST:
- Run `git status` after writing; assert only the three files above changed.
- Run `wc -l ARCHITECTURE.md` and print the count (target: ≥1500 substantive lines, prefer ≥2500 with tables).
- Run `grep -c "^## " ARCHITECTURE.md` and assert count == 20 (top-level sections).

### i18n
N/A for this prompt — `ARCHITECTURE.md` itself is English. However, `ARCHITECTURE.md` section 14 documents the 5-language policy that every subsequent prompt enforces.

### Documentation
`ARCHITECTURE.md` is itself the documentation. No separate `/docs` page this prompt.

### Acceptance criteria
- [ ] `/home/serverlessbase/whynot/ARCHITECTURE.md` exists with all 20 sections populated from real file reads (no hallucinated paths).
- [ ] Every file path mentioned in the document points to a file that exists right now (`test -e` check).
- [ ] All 20 section headings are present and in the required order.
- [ ] Section 16 contains the three untouchable paths verbatim.
- [ ] Section 2 lists every top-level folder in the repo.
- [ ] Section 4 references the highest-numbered migration in `services/database/migrations/`.
- [ ] `CLAUDE.md` and `AGENTS.md` open with the "Single source of truth" paragraph verbatim.
- [ ] `git status` shows only `ARCHITECTURE.md`, `CLAUDE.md`, `AGENTS.md` as changed (plus this prompts folder which was created earlier).
- [ ] No other files in the repo have been modified.
