# Superadmin: Plans, BillingConfig, FeatureFlags, AIProviders pages

## Agent
`design-ui-designer` (lead) + `api-designer` + skill `audit-logging`

## Depends on
`44-validate-superadmin-users-orgs.md`

## Goal
Surface the platform-control pages: plan catalog, billing config (trial days, currency, PAYG rates), feature-flag manager (already built in phase 5; this prompt embeds it under the new shell), and AI providers (global allow-list + rate limits).

## Single source of truth
`ARCHITECTURE.md` sections 8, 9, 10, 6.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Backend endpoints
- `GET/PATCH /api/admin/plans` — read/write the `PLANS` constant overrides (DB-backed)
- `GET/PATCH /api/admin/billing-config` — `trial_days`, `currency`, `payg_rates` JSON
- `GET/PATCH /api/admin/ai-providers` — global allowed-providers list + per-provider rate limits
- All audit-logged. All superadmin-gated.

### 2. Pages
- `admin-frontend/src/pages/PlansPage.tsx` — list plans, edit display name + price + features bullet list
- `admin-frontend/src/pages/BillingConfigPage.tsx` — form: trial days, currency, PAYG rates per event type. Validate inputs (no negative, no float for cents — bigint).
- `admin-frontend/src/pages/FeatureFlagsPage.tsx` — re-mount the page from prompt 25 inside the AdminShell (no duplication; same component).
- `admin-frontend/src/pages/AIProvidersPage.tsx` — toggle providers globally; rate limits per provider; reflects in `/api/me/ai-config` provider picker.

### 3. UI consequences
- Editing trial days → new signup honors new value (integration test).
- Editing PAYG rate → new usage events charge at new rate (integration test).
- Disabling a provider in AIProvidersPage → user-side AiTab hides it.
- Toggling a feature flag → reflects on user side (already covered in phase 5).

### 4. i18n
- All UI strings; 5 languages.

### Files to create/modify
- `gateway/src/api/admin/plans.ts`, `billing-config.ts`, `ai-providers.ts` — new
- `shared/database/repositories/billing-config-repository.ts` — extend if needed
- `admin-frontend/src/pages/PlansPage.tsx`, `BillingConfigPage.tsx`, `AIProvidersPage.tsx` — new
- `admin-frontend/src/router.tsx` — add routes
- `admin-frontend/public/locales/{en,ar,fr,de,es}/admin.json` — new keys

### Tests
- Supertest:
  - PATCH billing-config trial_days → new signup carries the new trial length.
  - PATCH PAYG rate → new usage event charges the new amount.
  - PATCH AI providers allow-list → user fetch of allowed providers reflects.
  - All non-superadmin requests denied.
- Vitest component tests for each page including form validation (bigint cents, no float, no negative).
- Playwright e2e:
  - Edit trial days to 7 → new signup → user side shows 7-day trial countdown.
  - Edit PAYG rate → trigger usage → ledger reflects new rate.
  - Disable a provider → user side AiTab provider picker no longer offers it.
- Coverage: 100% on touched files.

### i18n
- All localized.

### Documentation
- `docs/{en,ar,fr,de,es}/admin/platform-controls.md` — explains plans, billing config, providers.

### Acceptance criteria
- [ ] All 4 pages functional + audit-logged.
- [ ] Edit consequences correctly propagate to user side.
- [ ] Form validation enforces bigint / non-negative.
- [ ] Localized in 5 languages.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
