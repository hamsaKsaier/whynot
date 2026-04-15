# 20 — Environment Variables: Full Audit & Config Loader Hardening

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/spec-driven-development/`

## Task

`.env.example` has drifted from what's actually consumed in code. Audit every env var reference across `gateway/`, `frontend/`, `admin-frontend/`, and the service workers; reconcile with `.env.example`; harden the config loader to fail fast if a required var is missing.

### Scope / Requirements

1. **Static audit**
   - Grep `process.env.*` across:
     - `gateway/src/**/*.ts`
     - `frontend/src/**/*.ts{,x}` and `frontend/vite.config.ts`
     - `admin-frontend/src/**/*.ts{,x}` and `admin-frontend/vite.config.ts`
     - `services/**/*.ts` (qa-loop-executor, test-executor, prompt-executor, visual-regression)
     - `docker/**` compose files
     - `Makefile`
   - Build a table: var name → consumed-in → required/optional → default → source (.env.example / Docker env / secret manager).

2. **Reconcile with `.env.example`**
   - Every consumed var must appear in `.env.example` with:
     - A commented description
     - A sensible default or a placeholder (`your-value-here`)
     - A marker `# REQUIRED` or `# OPTIONAL`
     - Grouping by concern: `# --- Database ---`, `# --- Auth ---`, `# --- Stripe ---`, `# --- AI Providers ---`, `# --- Email ---`, `# --- Observability ---`, etc.
   - Remove dead entries (vars in `.env.example` that no code references).

3. **Required vs optional classification**
   - **Database**: `DATABASE_URL` (required), `POSTGRES_*` (required), `REDIS_URL` (required).
   - **Auth**: `JWT_SECRET` (required), `JWT_EXPIRES_IN` (optional, default `7d`), `SESSION_SECRET` (required), `COOKIE_DOMAIN` (optional, default `localhost`), `COOKIE_SECURE` (optional, default `false` in dev).
   - **Stripe**: `STRIPE_SECRET_KEY` (required for payments), `STRIPE_PUBLISHABLE_KEY` (required), `STRIPE_WEBHOOK_SECRET` (required), `STRIPE_SUCCESS_URL` (required), `STRIPE_CANCEL_URL` (required), `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_YEARLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_BUSINESS_MONTHLY`, `STRIPE_PRICE_BUSINESS_YEARLY`, `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_PAYG_METERED`.
   - **AI**: `LLM_PROVIDER` (required, enum `anthropic|openai|...`), `ANTHROPIC_API_KEY` (required if provider=anthropic), `ANTHROPIC_MODEL` (optional, default `claude-opus-4-6`), `OPENAI_API_KEY` (required if provider=openai), `OPENAI_MODEL` (optional), `OPENAI_VISION_MODEL` (optional), `AI_MAX_TOKENS` (optional), `AI_TEMPERATURE` (optional).
   - **Email**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (all required for email delivery; optional if email is disabled via feature flag).
   - **Observability**: `LOG_LEVEL` (optional, default `info`), `SENTRY_DSN` (optional), `OTEL_EXPORTER_OTLP_ENDPOINT` (optional).
   - **Feature flags**: `FEATURE_FLAG_PROVIDER` (optional, default `local`), `GROWTHBOOK_CLIENT_KEY` (optional).
   - **Frontend Vite**: `VITE_API_URL`, `VITE_WS_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_ANALYTICS_ID` (optional), `VITE_SENTRY_DSN_FRONTEND` (optional).
   - **CORS**: `CORS_ALLOWED_ORIGINS` (required, comma-separated, coordinate with prompt 18).
   - **Nginx ports**: already hardcoded in `docker-compose.yml` and `nginx/whynot.skrum.io` — don't promote to env unless needed.

4. **Config loader**
   - Harden `gateway/src/config/env.ts` (or equivalent) to:
     - Use a schema validator (e.g., `zod` — already in use) to parse `process.env` at startup.
     - Throw a clear error listing all missing required vars.
     - Coerce types: `PORT` → number, `COOKIE_SECURE` → boolean, `AI_MAX_TOKENS` → number.
     - Export a typed config object; consumers import from the config module, never from `process.env` directly.
   - Same treatment in `frontend/src/config.ts` and `admin-frontend/src/config.ts` for `import.meta.env.*` vars.
   - Refactor all direct `process.env.FOO` reads in code to go through the config module.

5. **Secret handling**
   - `.env.example` lives in git; `.env` is gitignored.
   - Production secrets come from the host's environment or a secret manager — document the expected mechanism in `/docs/en/deployment/secrets.md`.
   - Never log secret values, even at `debug` level.

6. **Docker compose env injection**
   - Update `docker/compose/docker-compose.yml` and `docker/compose/docker-compose.test.yml` to pass all required vars into the containers via `environment:` or `env_file: .env`.

### Tests (MANDATORY — 100% coverage)
- **Config validation test**: `gateway/src/__tests__/config-validation.test.ts` — mock `process.env` with each required var missing (one at a time), assert startup throws with a clear message naming the missing var.
- **Type coercion test**: assert `PORT` is a number, `COOKIE_SECURE` is a boolean, etc.
- **Dead env var test**: CI script that greps `.env.example` for var names and asserts each one is referenced somewhere in source. Fails if a var is unused.
- **Missing var test**: CI script that greps source for `process.env.X` and asserts `X` is listed in `.env.example`. Fails if missing.
- **No direct `process.env` reads**: lint rule that bans `process.env.*` outside `config.ts` / `env.ts`.

### i18n (5 languages)
- Config validation error messages at startup are developer-facing, not user-facing, so English-only is acceptable. Don't localize.
- Any user-facing error resulting from misconfiguration (e.g., "Email not configured" shown to an admin) uses `errors:config.*` keys translated per prompt 06.

### Documentation
- `/docs/en/deployment/environment-variables.md` — full reference table: var name, description, required/optional, default, example, used by.
- `/docs/en/deployment/secrets.md` — how to manage secrets in dev/staging/production.
- 5-language variants of both.
- README.md references these docs (coordinate with prompt 21).

### Constraints
- Docker-only for app changes.
- `.env.example` must stay in sync with reality — this is the acceptance criterion.
- No direct `process.env.*` reads outside the config module.
- Never commit a real `.env` file.
- Never log secrets.
- Config validation runs at startup, not lazily — fail fast.

### Verification steps
1. `make shell-gateway npm run typecheck && npm run lint && npm test -- config`
2. `make shell-client npm run typecheck`
3. `make shell-admin npm run typecheck`
4. Startup test: `docker compose up` with an intentionally broken `.env` (missing `JWT_SECRET`) and assert the gateway container exits with a clear error message.
5. CI check: `grep -rEn "process\\.env\\." gateway/src admin-frontend/src frontend/src --include="*.ts" --include="*.tsx" | grep -v config.ts | grep -v env.ts` returns zero hits.
6. CI check: every `.env.example` entry is referenced in source.
