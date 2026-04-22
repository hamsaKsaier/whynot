# Per-Page i18n Test Harness (Frontend, Admin, Gateway)

## Agent
`.claude/agents/frontend-developer.md` — no dedicated test-engineer agent exists in this repo; frontend-developer builds both test helpers and page tests. Engage `.claude/agents/api-designer.md` for the gateway integration-test design.

## Skills
`.claude/skills/backend-i18n/` — reference for gateway side.
`.claude/rules/spec-driven-development.md` — Docker-only execution.

## Task

Build a reusable test harness that iterates **every page × every locale** and asserts no untranslated strings leak through. This is the enforcement mechanism that keeps prompts 01–04 from regressing. Three layers:

1. **Frontend Vitest** — all user-facing routes under 5 locales.
2. **Admin-frontend Vitest** — all admin pages under 5 locales.
3. **Gateway Vitest integration** — every router's happy + sad path under 5 `Accept-Language` values.

(No per-page Playwright in this prompt — the existing `language-switcher.spec.ts` already validates the switcher itself.)

### 1. Shared `renderAtLocale` helper (frontend)

Create `frontend/src/__tests__/helpers/renderAtLocale.tsx`:

- Wraps `<I18nextProvider i18n={testI18n}>` + whichever direction provider the app uses.
- Uses `MemoryRouter` with an `initialEntries` prop for the page under test.
- Provides mock auth context (authenticated test user), mock query client with happy-path responses.
- Exposes `renderAtLocale(ui: ReactElement, lang: 'en'|'ar'|'fr'|'de'|'es', options?)`.
- Calls `await i18n.changeLanguage(lang)` **before** rendering.
- Sets `document.documentElement.lang = lang` and `document.documentElement.dir = (lang === 'ar' ? 'rtl' : 'ltr')`.
- Returns the standard Testing Library result object.

Unit-test the helper itself in `frontend/src/__tests__/helpers/renderAtLocale.test.tsx`:
- Switches locale correctly (assert `i18n.language` after).
- Sets `lang` and `dir` attributes.
- Teardown resets to `en` between tests.

Mirror the helper in `admin-frontend/src/__tests__/helpers/renderAtLocale.tsx`.

### 2. Page enumeration (frontend)

Since React Router routes are declared imperatively in `frontend/src/App.tsx`, enumerate pages in a single manifest:

```ts
// frontend/src/__tests__/pages-manifest.ts
export const PAGES = [
  { key: 'home', path: '/', component: HomePage, requiresAuth: false },
  { key: 'login', path: '/login', component: LoginPage, requiresAuth: false },
  // ... all 18 routes
];
```

Any page added in the future must be added to this manifest — the `pages-i18n.test.tsx` test is the enforcement.

### 3. `pages-i18n.test.tsx` (frontend)

Create `frontend/src/__tests__/pages-i18n.test.tsx`:

For each `page` in `PAGES` × each `lang` in `['en', 'ar', 'fr', 'de', 'es']`:
- Mount the page via `renderAtLocale(page.component, lang)`.
- Assert `document.documentElement.lang === lang`.
- Assert `document.documentElement.dir === (lang === 'ar' ? 'rtl' : 'ltr')`.
- Scan `document.body.innerText` and fail if it contains any 4+ char Latin-only run that is not in the brand allowlist (`WhyNot QA`, `GitHub`, `Stripe`, `Playwright`, `Gemini`, `CI/CD`, `JSON`, `UUID`, `JWT`, etc. — reuse the allowlist from `i18n-no-hardcoded-strings.test.ts`).
- For `ar`, additionally assert at least one Arabic character is present (sanity check that i18n actually switched).
- For `fr`, spot-check NBSP usage on at least one page title (loose assertion, not per-element).

This test must run under Docker via `make test-frontend`.

### 4. Admin `pages-i18n.test.tsx`

Mirror the same approach under `admin-frontend/src/__tests__/pages-i18n.test.tsx` with its own `PAGES` manifest covering all 22+ admin pages.

### 5. Gateway Accept-Language integration tests

Create `gateway/src/__tests__/api/i18n-integration.test.ts`:

- A single shared harness `requestWithLocale(router, path, method, body, lang)`.
- For each `lang` in the 5 languages, for each router under `gateway/src/api/`:
  - Hit at least one success path — assert response body text matches the translation in `gateway/src/i18n/translations/<lang>/<ns>.json`.
  - Hit at least one expected error path (400, 401, 403, 404, 422, 500) — same assertion.
- For each router, hit once with `Accept-Language: zz-ZZ` and assert fallback to `en`.
- For each router, hit once with no `Accept-Language` header and assert fallback to `en`.

Run under Docker: `make test-backend`.

### 6. Brand allowlist + utility
Extract the brand/English-allowed-token allowlist into a shared file so frontend, admin-frontend, and the gateway scanner all import from one source. If the repo has a monorepo package setup, put it in `shared/`. Otherwise duplicate and add a unit test in each package that asserts the lists match byte-for-byte.

### 7. CI integration
- `make test` runs all three test layers (already does per `docker-compose.test.yml`).
- Coverage stays at 100% in every package.
- Add no new npm dependencies unless strictly necessary — the existing Vitest + @testing-library/react + supertest stack is sufficient.

### Tests
Since this prompt *is* the test infrastructure, the "tests" section is reflexive:

- `frontend/src/__tests__/helpers/renderAtLocale.test.tsx` — proves the helper works.
- `frontend/src/__tests__/pages-i18n.test.tsx` — asserts all 18 routes × 5 langs.
- `admin-frontend/src/__tests__/helpers/renderAtLocale.test.tsx` — proves the admin helper works.
- `admin-frontend/src/__tests__/pages-i18n.test.tsx` — asserts all 22+ admin pages × 5 langs.
- `gateway/src/__tests__/api/i18n-integration.test.ts` — router-level.
- Seeded-regression test: intentionally reintroduce a hardcoded English string in a fixture page and assert the harness flags it. (Use a fixture page outside the real manifest.)
- Coverage: 100% lines/branches/functions/statements preserved in every package.

### i18n
- No new user-facing keys added in this prompt. Test strings (fixtures) are allowed to be English.

### Documentation
For each of the 5 languages:
- `/docs/{en,ar,es,fr,de}/i18n.md` — add a "Testing i18n coverage" section covering:
  - How to add a new page to `pages-manifest.ts`.
  - How the English-leak scanner works (brand allowlist, Latin-only regex).
  - How to add a new router to the gateway integration test.
  - How to debug a failing page-locale test.

### Verification

```bash
make test                 # runs everything
make test-frontend        # layer 1
make test-admin           # layer 2
make test-backend         # layer 3

# regression check: after intentionally reintroducing hardcoded English, tests should fail
```

Acceptance criteria:
- [ ] `renderAtLocale` helper exists and is unit-tested in both frontend and admin-frontend.
- [ ] `pages-manifest.ts` exists and covers every route (18 frontend + 22+ admin).
- [ ] `pages-i18n.test.tsx` asserts all pages × 5 langs in both packages.
- [ ] Gateway `i18n-integration.test.ts` covers every router × 5 langs with happy + sad paths.
- [ ] Seeded-regression test proves the scanner catches hardcoded English.
- [ ] 100% Vitest coverage across all three packages.
- [ ] `/docs/{en,ar,es,fr,de}/i18n.md` has a "Testing i18n coverage" section in all 5 languages.
