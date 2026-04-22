# Final end-to-end validation: every feature, every language, every theme, every direction

## Agent
`api-designer` (lead) + `design-ui-designer` + `translation-manager`

## Depends on
`61-reach-100-percent-coverage-and-ci-gate.md`

## Goal
Run a full-system validation suite that exercises every critical user journey in 5 languages × dark/light × ltr/rtl, with Lighthouse on landing, Axe on every page, and a final ARCHITECTURE.md completeness audit. This is the migration's exit gate.

## Single source of truth
`ARCHITECTURE.md` — full audit at the end.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Validation steps

### 1. Static + unit + coverage gate
- `bun typecheck`, `bun lint`, `bun vitest run --coverage` in every package → exit 0; coverage 100%.

### 2. Critical user journeys (Playwright)
For each journey: run in en, ar, fr, de, es × light + dark; assert Arabic is RTL.

- **Sign-up + onboarding**: visit landing → click Get Started → sign up → verify email → land in dashboard.
- **Trial subscription**: open Settings > Billing → start trial → trial banner visible → cancel trial.
- **Pro Managed upgrade**: trial → upgrade to Pro Managed → top-up credits → invoice history reflects.
- **AI config + use**: Settings > AI → add provider → test connection → run a feature that consumes AI → verify the right provider was hit.
- **Test runner end-to-end**: run a real (seeded) test → live updates stream → results visible → export results.
- **Admin impersonation**: superadmin → impersonate user → user-side banner → end impersonation.
- **Feature flag toggle**: superadmin toggles a flag → user-side feature visibility flips.
- **Account deletion**: Danger Zone → re-auth → soft-delete → grace period.

### 3. Landing page Lighthouse
- Lighthouse mobile + desktop on `/` per locale: Performance ≥ 95, SEO = 100, A11y ≥ 95, Best Practices ≥ 95.

### 4. Axe a11y full sweep
- Axe scan on every page (auth, dashboard, runner, results, settings tabs, admin pages, landing). Zero violations.

### 5. Backend i18n sweep
- Supertest hits 20 representative endpoints with each `Accept-Language`. All response messages localized.

### 6. Untouchable path audit
- `git diff main...HEAD --name-only` → no files inside `services/qa-loop-executor/src/v2/`, no edits to `services/qa-loop-executor/src/mcp-browser.ts`, no edits to existing migration files.

### 7. Quality-gate matrix (per-prompt audit)
- Walk every prior prompt (01–61). For each:
  - Tests exist + pass + coverage 100%.
  - i18n keys exist in 5 languages.
  - Docs exist in 5 languages where applicable.
  - Agents/skills referenced.

### 8. ARCHITECTURE.md final audit
- Run the same 20 canned questions used in prompt 02 against the current ARCHITECTURE.md. All 20 answerable from the doc.
- Confirm every section that should have been updated by phases 1–10 has been updated (compare against a diff of the file across the migration).

### 9. Load smoke
- Run a small load test (e.g. 50 RPS for 60s) against `/api/me`, `/api/me/billing/subscription`, `/api/me/usage/recent`. p95 within target documented in ARCHITECTURE.md section 12.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] All 8 user journeys pass in 5 languages × themes × directions.
- [ ] Lighthouse, Axe, Supertest sweeps green.
- [ ] No untouchable path changes.
- [ ] All prior prompts pass the quality-gate matrix.
- [ ] ARCHITECTURE.md final audit clean.
- [ ] Load smoke meets targets.

## On failure
- Identify the failing prompt(s); re-open and fix; rerun this validation.
- This prompt is the migration's exit gate. The migration is NOT complete until it passes.
