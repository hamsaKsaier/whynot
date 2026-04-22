# Gateway API Response i18n Audit & Remediation

## Agent
`.claude/agents/api-designer.md` — reviews the audit and approves key structure.
`.claude/agents/frontend-developer.md` — performs the remediation (no dedicated backend-dev agent exists; this is the closest full-stack option in the repo).

## Skills
`.claude/skills/backend-i18n/` — primary; this is exactly the workflow that skill covers.
`.claude/rules/spec-driven-development.md` — Docker-only execution.

## Task

Every response the gateway sends to a client — success messages, error messages, validation errors, email bodies — must honor the `Accept-Language` header and return localized text in the requested language (one of `en`, `ar`, `fr`, `de`, `es`). Audit every router under `gateway/src/api/` and remediate leaks.

### 1. Audit pass
- Grep every file under `gateway/src/api/**/*.ts` for:
  - `res.json({ error: "..." })` / `res.json({ message: "..." })` with literal English.
  - `res.status(…).send("...")` with literal English.
  - `throw new Error("...")` where the error surfaces to the client (check the error-handler middleware path).
  - `console.error(...)` with user-visible copy (server-only logs are fine to keep in English).
- Check `gateway/src/middleware/` — auth, rate-limit, permission middlewares may respond with hardcoded English error JSON.
- Check `gateway/src/services/` — email templates in `emails.ts` (or wherever) must use `i18next` with the recipient's locale.

### 2. Remediation
- Use `req.t('errors:<key>', { interpolation })` and `req.t('success:<key>', { interpolation })` — the i18n middleware at `gateway/src/middleware/i18n.ts` already attaches `req.t` based on `Accept-Language`.
- Zod validation errors: wrap the error middleware so each issue's `message` becomes `req.t('validation:<schemaName>.<field>.<rule>', { min, max })`. Fall back to a generic `req.t('validation:generic', { path })` if no specific key exists.
- Email templates: compose with `i18n.getFixedT(recipientLocale, 'emails')(templateKey, vars)`. Recipient locale comes from the user record, not from the request (since transactional email is often async). Default to `en` if unknown.
- Do **not** re-localize data fields (e.g., user-supplied project names); only localize server-authored copy.

### 3. Routers to audit (non-exhaustive)
- `gateway/src/api/perf-router.ts` — already uses `req.t('errors:service.perfTestUnavailable')`. Make sure every other response path does the same.
- Auth router(s) — login, signup, password reset, email verification, session refresh, logout.
- Billing router(s) — subscription create/update/cancel, invoice, checkout, webhook confirmations (webhook responses to Stripe stay in English — those are machine-readable).
- Projects router, monitors router, QA-loop router, test-results router.
- Admin routers — organizations, users, plans, feature flags, audit log, announcements, system settings.
- AI providers router.
- Settings router (profile, API keys, organization).
- Upload / storage router.

Any router not listed that exists under `gateway/src/api/` must be audited too.

### 4. Translation files
Add/extend keys in all 5 language files per namespace:
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/errors.json`
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/success.json`
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/validation.json`
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/emails.json`
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/billing.json`

Namespace the keys by feature (`errors:auth.invalidCredentials`, `errors:billing.cardDeclined`, `success:auth.passwordReset`). Maintain identical placeholder sets across all 5 files.

### 5. Error shape contract
Every error response body must include both a machine-readable code and a localized message:
```json
{ "error": { "code": "auth.invalidCredentials", "message": "<localized>" } }
```
If the current shape differs, leave it as-is (backwards-compat), but always localize the human-readable field. Document the contract in `/docs/<lang>/api.md` if such a file exists, otherwise in `/docs/<lang>/i18n.md`.

### Tests
Docker-only: `make test-backend` (or `make test` for all).

- `gateway/src/__tests__/api/<router>.i18n.test.ts` — one per router:
  - For each of the 5 languages, send a request with `Accept-Language: <lang>` and assert the response body text matches the expected translation from the corresponding JSON file.
  - Cover happy paths (success messages) and sad paths (404s, 400s, 401s, 403s, 422s, 500s).
  - Verify that invalid/unknown `Accept-Language` values fall back to `en`.
- Extend `gateway/src/__tests__/i18n-backend-completeness.test.ts` to assert every new `req.t()` key exists in all 5 files.
- Extend `gateway/src/__tests__/i18n-no-hardcoded-strings.test.ts` to scan every file under `gateway/src/api/**` and `gateway/src/middleware/**` for literal English strings in response bodies.
- Middleware tests in `gateway/src/__tests__/middleware/i18n-middleware.test.ts` already cover header parsing; add cases for:
  - `Accept-Language: ar-SA, en;q=0.8` → resolves to `ar`.
  - `Accept-Language: zz-ZZ` → falls back to `en`.
  - Missing header → falls back to `en`.
  - Malformed header → does not throw; falls back to `en`.
- Email template tests: render each template in each of 5 languages for a fixed variable set; snapshot the output.
- Coverage threshold stays at 100% (`gateway/vitest.config.ts`).

### i18n
- New keys in all 5 namespaces × 5 languages.
- Key naming: dot-separated, feature-scoped (`errors:auth.invalidCredentials`, never `errors:invalidCredentials`).
- Placeholders consistent camelCase.
- Fallback to `en` on unknown locale is mandatory (already behavior of i18next backend).

### Documentation
For each of the 5 languages:
- `/docs/{en,ar,es,fr,de}/i18n.md` — add a "Backend localization" section covering:
  - The `Accept-Language` contract.
  - How `req.t()` works and where translations live.
  - Adding a new error/success key (step-by-step).
  - Email template localization (recipient-locale lookup).
  - Error-response shape contract.
- `/docs/{en,ar,es,fr,de}/api/errors.md` (create if missing) — list all error codes with one-line descriptions; note that the `message` field is localized.

### Verification

```bash
make shell-gateway npm run lint
make shell-gateway npm run typecheck
make test-backend
# manual smoke against a running dev gateway:
curl -H "Accept-Language: ar" http://localhost:3000/api/perf/run -d '{}'
curl -H "Accept-Language: fr" http://localhost:3000/api/auth/login -d '{"email":"bad","password":"x"}'
```

Acceptance criteria:
- [ ] No hardcoded English in any `res.json`/`res.send` call under `gateway/src/api/` or `gateway/src/middleware/`.
- [ ] `i18n-backend-completeness.test.ts` passes.
- [ ] `i18n-no-hardcoded-strings.test.ts` (backend variant) passes with the expanded scanner glob.
- [ ] Per-router `Accept-Language` integration tests pass for all 5 languages.
- [ ] 100% Vitest coverage preserved.
- [ ] `/docs/{en,ar,es,fr,de}/i18n.md` has a backend section in all 5 languages.
