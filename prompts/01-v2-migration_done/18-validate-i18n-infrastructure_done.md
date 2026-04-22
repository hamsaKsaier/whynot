# Validate: i18n infrastructure (frontends + gateway)

## Agent
`translation-manager` (verifier) + `backend-i18n-developer`

## Depends on
`17-i18n-infrastructure-frontend-admin-backend.md`

## Goal
Verify the react-i18next stack works in both apps, the gateway honours `Accept-Language`, structural completeness across 5 languages holds, and `<html dir>` flips for RTL.

## Single source of truth
`ARCHITECTURE.md` section 14.

## Validation steps

### 1. Static checks
- `docker compose -f docker-compose.test.yml run --rm app bun typecheck` → exit 0
- `docker compose -f docker-compose.test.yml run --rm app bun lint` → exit 0

### 2. Completeness tests
- `docker compose -f docker-compose.test.yml run --rm frontend bun vitest run src/__tests__/i18n-completeness.test.ts` → pass
- Same for `admin-frontend` and `gateway`.
- Assert: every locale file under `frontend/public/locales/`, `admin-frontend/public/locales/`, `gateway/src/i18n/translations/` has identical namespace + key sets across en/ar/fr/de/es.

### 3. Frontend i18n behavior
- Vitest: render a component using `useTranslation()`, `i18n.changeLanguage('ar')`, assert `dir="rtl"` is set on `<html>` after render.
- Vitest: language detector falls back to `en` when `localStorage` and navigator give an unsupported language.

### 4. Gateway Accept-Language
- Supertest: hit `POST /api/auth/login` with bad credentials and `Accept-Language: fr` → response `error.message` exists and was looked up via `req.t('errors:auth.invalidCredentials')`.
- Repeat for `ar`, `de`, `es`, `en`.
- Hit with `Accept-Language: zz` → falls back to `en`.
- Hit with no header → falls back to `en`.

### 5. Playwright
- `frontend`: open `/`, click language switcher, cycle en→ar→fr→de→es→en. Assert `<html lang>` and `<html dir>` update each time. Assert UI text changes (will be English placeholders in ar/fr/de/es, but the value should be present and string-typed).
- `admin-frontend`: same.

### 6. Architecture doc
- `ARCHITECTURE.md` section 14 names the lib (react-i18next), the 5 languages, the namespace lists for each surface, and the `req.t()` pattern.

### 7. Regression scan
- All earlier-phase tests still green.
- No console errors in browser during Playwright runs.

## Pass criteria
- [ ] All commands above exit 0.
- [ ] Completeness test green in all 3 surfaces.
- [ ] `<html dir>` flips on Arabic.
- [ ] Gateway returns localized error envelopes.
- [ ] No regressions in prior phases.
- [ ] Coverage for touched files unchanged or increased.

## On failure
- Re-open `17-i18n-infrastructure-frontend-admin-backend.md`; fix; rerun this validation.
- Do NOT advance to prompt 19 until this validation passes.
