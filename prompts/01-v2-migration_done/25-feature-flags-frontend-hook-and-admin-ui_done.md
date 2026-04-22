# Feature flags: frontend hook + admin UI

## Agent
`design-ui-designer` (lead) + `api-designer` (consult) + skill `feature-flag-implementation`

## Depends on
`24-validate-feature-flags-backend.md`

## Goal
Expose feature flags to the React frontends via a hook + provider, and ship a Shadcn-styled superadmin page in `admin-frontend/` for managing flags and per-org overrides.

## Single source of truth
`ARCHITECTURE.md` section 10.

## Reference
`/home/serverlessbase/serverless-v2/serverlessbase/apps/serverlessbase/components/admin/feature-flags.tsx` (or equivalent)

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Frontend provider + hook
- `frontend/src/providers/FeatureFlagsProvider.tsx`:
  - On mount + on user change, fetch `/api/me/flags`.
  - Store the resolved map in React context.
  - Re-fetch on a 60s interval and on window focus.
- `frontend/src/hooks/useFeatureFlag.ts`:
  ```ts
  export function useFeatureFlag(key: PlatformFeatureKey): boolean;
  ```
- Same provider/hook in `admin-frontend/`.

### 2. Frontend gating
- Wrap features that should be flag-gated using a `<Feature flag="..." fallback={...}>` component (shorthand around the hook).
- Apply `LANGUAGE_SWITCHER` flag to the LanguageSwitcher mounted in headers.
- (Other phases will gate their features; this prompt only sets up plumbing + the language switcher example.)

### 3. Admin UI: FeatureFlagsPage
- `admin-frontend/src/pages/FeatureFlagsPage.tsx`:
  - Lists all flags from `GET /api/admin/feature-flags`.
  - For a selected flag, shows orgs with overrides + ability to add/edit/clear per-org override.
  - Shows audit trail per flag (recent 50 events).
  - Shadcn primitives (Table, Switch, Dialog, Combobox).
  - Cursor-paginated org override list.

### 4. i18n
- Add `admin:featureFlags.*` keys: page title, table headers, dialog labels, audit columns.
- Add `common:flags.*` for the user-facing `<Feature />` fallback messages.
- All 5 languages.

### Files to create/modify
- `frontend/src/providers/FeatureFlagsProvider.tsx` — new
- `frontend/src/hooks/useFeatureFlag.ts` — new
- `frontend/src/components/Feature.tsx` — new
- `frontend/src/main.tsx` — wrap App in `<FeatureFlagsProvider>`
- `admin-frontend/src/providers/FeatureFlagsProvider.tsx`, `admin-frontend/src/hooks/useFeatureFlag.ts`, `admin-frontend/src/components/Feature.tsx` — new
- `admin-frontend/src/main.tsx` — wrap
- `admin-frontend/src/pages/FeatureFlagsPage.tsx` — new
- `admin-frontend/src/router.tsx` — add the route
- `frontend/public/locales/{en,ar,fr,de,es}/common.json`, `admin-frontend/public/locales/{en,ar,fr,de,es}/admin.json` — new keys

### Tests
- Vitest: `useFeatureFlag` returns false until provider resolves; true/false after fetch; updates on re-fetch.
- Vitest: `<Feature />` renders children if enabled, fallback if not.
- Vitest: provider re-fetches on focus + on interval (mock timers).
- Playwright: superadmin opens FeatureFlagsPage, toggles a flag override for an org, opens user-side as that org → feature visibility flips without page reload (within the 60s polling window or via explicit re-fetch trigger).
- Coverage: 100% for touched files.

### i18n
- All UI strings via `t()`. 5-language completeness test passes.

### Documentation
- `docs/{en,ar,fr,de,es}/feature-flags/frontend.md` — explains the provider, the hook, and the `<Feature />` shorthand.
- `docs/{en,ar,fr,de,es}/feature-flags/admin.md` — explains the admin page and per-org override model.

### Acceptance criteria
- [ ] Provider + hook work in both frontends.
- [ ] Admin UI lists flags, edits overrides, shows audit trail.
- [ ] Language switcher gated by `LANGUAGE_SWITCHER` flag.
- [ ] All UI localized in 5 languages.
- [ ] Tests + coverage at 100%.
- [ ] No untouchable path changes.
