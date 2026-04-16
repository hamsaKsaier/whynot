# 06 — Backend i18n: Gateway Router Audit & req.t() Migration

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/backend-i18n/`
- `.claude/skills/spec-driven-development/`

## Task

The gateway has working i18n infrastructure (`gateway/src/i18n/index.ts`, `gateway/src/middleware/i18n.ts`, translation files under `gateway/src/i18n/translations/{en,ar,fr,de,es}/{errors,success,emails,validation,billing}.json`) and `gateway/src/i18n/translations/ar/errors.json` already has ~80 translated keys. **But many route handlers hardcode English strings in `res.json()` / `throw new Error()` calls instead of using `req.t('errors:...')`.**

Concrete known offenders:
- `gateway/src/api/ci-router.ts:171` — `"Scan session not found"`
- `gateway/src/api/ci-router.ts:185` — `"Workspace required"`
- `gateway/src/api/ci-router.ts:203` — `"Workspace required"`
- `gateway/src/api/ci-router.ts:239` — `"API key not found"`
- `gateway/src/api/monitor-router.ts:53` — `"Workspace required"`
- `gateway/src/api/monitor-router.ts:71` — `"cron_expression is required"`
- `gateway/src/api/monitor-router.ts:76` — `"Invalid cron expression — must have 5 fields"`
- `gateway/src/api/monitor-router.ts:88` — `"Workspace required"`

This is the visible tip — audit every file under `gateway/src/api/**` and `gateway/src/services/**` for hardcoded error and success messages, then replace them with `req.t('errors:...')` and `req.t('success:...')`.

### Scope / Requirements

1. **Audit**
   - Grep `gateway/src/**/*.ts` for string literals inside `res.status(...).json(...)`, `res.json(...)`, `throw new Error(...)`, `throw new BadRequestError(...)`, `throw new NotFoundError(...)`, `return { error: ... }`, `logger.error(...)`.
   - Produce a report: file, line, current string, proposed key path, proposed namespace (`errors` vs `success` vs `validation` vs `billing`).
   - Also audit `gateway/src/services/payments/**` for Stripe error path messages (coordinate with prompt 19).

2. **Key design**
   - Keys follow dotted path: `errors.validation.workspaceRequired`, `errors.ciScan.notFound`, `errors.apiKey.notFound`, `errors.monitor.cronInvalid`, `errors.monitor.cronMissing`.
   - Generic validation errors live under `validation` namespace (`validation.field.required`, `validation.field.invalid`).
   - Billing/payment errors under `billing` namespace to keep Stripe surface area isolated.
   - Success responses under `success` namespace for anything user-visible.

3. **Refactor handlers**
   - Replace every offending string with `req.t('errors:…', { interpolatedVar })`.
   - For custom errors that serialize later, pass a `messageKey` field and resolve it in the global error handler middleware using `req.t(messageKey)`.
   - Ensure `req.t` is available — verify `i18nMiddleware` is mounted before all API routers in `gateway/src/api/main.ts`.

4. **Expand translation JSON files**
   - For every new key added, update `gateway/src/i18n/translations/en/*.json` with the canonical English string.
   - Update `gateway/src/i18n/translations/{ar,fr,de,es}/*.json` with human-reviewed translations. (Arabic is partially populated; French/German/Spanish need the most work.)
   - Preserve Accept-Language header parsing; default fallback is English.
   - Maintain alphabetical key order for diff stability.

5. **Error handler middleware**
   - Verify `gateway/src/middleware/error-handler.ts` (or equivalent) respects `req.language` and formats error responses as:
     ```json
     { "error": { "code": "errors.monitor.cronInvalid", "message": "<localized>", "details": {...} } }
     ```
   - Frontend can still switch on `error.code` for behavior; UI displays `error.message`.

6. **Validation integration**
   - If Zod is used (or express-validator), ensure validation messages flow through `req.t()` before returning to the client.

### Tests (MANDATORY — 100% coverage)
- **Unit**: each refactored handler, with `req.t` mocked, asserts the correct key is requested and interpolation values match.
- **Integration (per language)**: for every endpoint touched, fire a request with `Accept-Language: ar`, `fr`, `de`, `es`, `en` and assert the response body `error.message` contains a localized string (use characteristic markers: Arabic glyph for `ar`, French accent for `fr`, German `ß`/`ö`/`ü` for `de`, Spanish `ñ`/`¿` for `es`).
- **Fallback**: request with `Accept-Language: ja` falls back to English.
- **Key coverage**: `gateway/src/__tests__/i18n-backend-completeness.test.ts` — parse all `req.t(...)` calls across `gateway/src/**/*.ts` and assert each referenced key exists in every language file.
- **No hardcoded strings**: lint test that fails if `res.status(4xx).json({ error: "literal" })` pattern is found anywhere under `gateway/src/api/`.

### i18n (this prompt's scope — all 5 backend languages)
- `gateway/src/i18n/translations/en/{errors,success,validation,billing}.json` — canonical keys.
- `gateway/src/i18n/translations/ar/*.json` — full coverage, reuse existing Arabic entries where applicable.
- `gateway/src/i18n/translations/fr/*.json` — full coverage.
- `gateway/src/i18n/translations/de/*.json` — full coverage.
- `gateway/src/i18n/translations/es/*.json` — full coverage.
- Email template strings (`gateway/src/i18n/translations/{lang}/emails.json`) — ensure they're used from the email service in the user's locale, not hardcoded.

### Documentation
- `/docs/{en,ar,fr,de,es}/i18n/backend-error-codes.md` — list every error code, its namespace, HTTP status, and example message in the target language.
- Link from `/docs/{lang}/api/index.md` or the API reference if it exists.

### Constraints
- Docker-only: `make shell-gateway ...` (or whichever make target gates into the gateway container).
- Preserve camelCase API responses; bigint cents for money untouched.
- Org-scoped access rules unchanged.
- No new npm dependencies unless strictly needed.
- Respect `.claude/rules/spec-driven-development.md` — treat this as an enhancement requiring the full Spec Kit workflow for any non-trivial router.

### Verification steps
1. `make shell-gateway npm run typecheck`
2. `make shell-gateway npm run lint`
3. `make shell-gateway npm test`
4. `make shell-gateway npm test -- i18n-backend-completeness`
5. Integration smoke test: `make start`, then curl every API endpoint with each `Accept-Language` header and inspect the response body.
6. `grep -rn '"error":.*"[A-Z]' gateway/src/api/` returns no matches (no hardcoded English error strings).
