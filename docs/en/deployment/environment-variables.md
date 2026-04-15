# Environment Variables Reference

This document is the authoritative reference for every environment variable used by the WhyNot platform.

## Quick Start

```bash
cp .env.example .env
# Edit .env and fill in REQUIRED values
# Then: make start
```

## Configuration Architecture

- **Gateway** — validated at startup via Zod schema in `gateway/src/config/env.ts`. Missing required vars cause immediate exit with a clear error.
- **Frontend** — build-time vars prefixed `VITE_` are baked into the JS bundle. Centralized in `frontend/src/config.ts`.
- **Admin Frontend** — same pattern, centralized in `admin-frontend/src/config.ts`.
- **Services** (test-executor, qa-loop-executor) — read `process.env` directly; Docker Compose passes vars via `environment:` or `env_file:`.

## Variable Reference

### Database

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `DATABASE_URL` | No | _(constructed from POSTGRES_*)_ | gateway, services | Full PostgreSQL connection string. Overrides individual vars. |
| `POSTGRES_USER` | No | `whynot` | gateway, services, Docker | Database user |
| `POSTGRES_PASSWORD` | No | `whynot` | gateway, services, Docker | Database password (**change in production**) |
| `POSTGRES_DB` | No | `whynot` | gateway, services, Docker | Database name |
| `POSTGRES_HOST` | No | `database` | gateway | Hostname (Docker service name in containers) |
| `POSTGRES_PORT` | No | `5433` | Docker | **Host** port for PostgreSQL |

### Authentication

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `JWT_SECRET` | **Yes** | — | gateway | Token signing key. Generate: `openssl rand -base64 64` |
| `GITHUB_CLIENT_ID` | For GitHub login | — | gateway | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | For GitHub login | — | gateway | GitHub OAuth app client secret |
| `GITHUB_CALLBACK_URL` | No | `http://localhost:3010/api/auth/github/callback` | gateway | OAuth callback URL |
| `GOOGLE_CLIENT_ID` | For Google login | — | gateway | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Google login | — | gateway | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | `http://localhost:3010/api/auth/google/callback` | gateway | OAuth callback URL |

### Encryption

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `SECRETS_ENCRYPTION_KEY` | **Yes** (for secrets) | — | gateway | AES-256 key, 32 bytes base64. Generate: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **Yes** (for integrations) | — | gateway | Integration token encryption key |

### Stripe Billing

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `STRIPE_SECRET_KEY` | For payments | — | gateway | Stripe API secret key |
| `STRIPE_PUBLISHABLE_KEY` | For payments | — | gateway | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | For payments | — | gateway | Stripe webhook signing secret |
| `STRIPE_SUCCESS_URL` | No | `http://localhost:5183/billing?success=true` | gateway | Checkout success redirect |
| `STRIPE_CANCEL_URL` | No | `http://localhost:5183/billing?canceled=true` | gateway | Checkout cancel redirect |
| `STRIPE_PRICE_*` | No | — | gateway | Stripe price IDs for each plan tier |

### AI Providers

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `LLM_PROVIDER` | No | `anthropic` | ai-service | AI provider: `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | If provider=anthropic | — | gateway, ai-service | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | ai-service | Anthropic model ID |
| `OPENAI_API_KEY` | If provider=openai | — | ai-service | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4` | ai-service | OpenAI model ID |
| `OPENAI_VISION_MODEL` | No | `gpt-4o` | ai-service | OpenAI vision model |

### Email

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `RESEND_API_KEY` | No | — | gateway | Resend.com API key. If unset, emails are silently skipped. |
| `EMAIL_FROM_ADDRESS` | No | `WhyNot <notifications@whynot.qa>` | gateway | Sender address for transactional emails |

### Rate Limits

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | gateway | General API limit per 15 min |
| `RATE_LIMIT_TEST_EXECUTION_MAX` | No | `10` | gateway | Test execution limit per hour |
| `RATE_LIMIT_TEST_GENERATION_MAX` | No | `20` | gateway | Test generation limit per 15 min |
| `RATE_LIMIT_QA_LOOP_MAX` | No | `5` | gateway | QA loop sessions per hour |
| `RATE_LIMIT_LOGIN_MAX` | No | `10` | gateway | Login attempts per 15 min |
| `RATE_LIMIT_REGISTER_MAX` | No | `5` | gateway | Registrations per hour |
| `RATE_LIMIT_PUBLIC_MAX` | No | `10` | gateway | Public endpoints per 15 min |

### URLs

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `FRONTEND_URL` | No | `http://localhost:5183` | gateway | Main frontend URL |
| `ADMIN_FRONTEND_URL` | No | `http://localhost:5184` | gateway | Admin frontend URL |
| `CORS_ALLOWED_ORIGINS` | No | — | gateway | Additional CORS origins (comma-separated) |

### Frontend Build-Time (VITE_*)

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `VITE_API_URL` | No | `/api` | frontend, admin-frontend | Backend API URL |
| `VITE_WS_URL` | No | `ws://localhost:3011` | frontend | Test executor WebSocket URL |
| `VITE_QA_LOOP_WS_URL` | No | `ws://localhost:3012` | frontend | QA loop WebSocket URL |
| `VITE_APP_VERSION` | No | `2.0.0` | frontend | Version shown in footer |

### Host Ports (Docker)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PORT` | `5433` | Host port for PostgreSQL |
| `AI_SERVICE_PORT` | `8010` | Host port for AI service |
| `GATEWAY_PORT` | `3010` | Host port for gateway |
| `TEST_EXECUTOR_PORT` | `3011` | Host port for test executor |
| `QA_LOOP_EXECUTOR_PORT` | `3012` | Host port for QA loop executor |
| `FRONTEND_PORT` | `5183` | Host port for frontend |
| `ADMIN_FRONTEND_PORT` | `5184` | Host port for admin frontend |

### Observability

| Variable | Required | Default | Used By | Description |
|----------|----------|---------|---------|-------------|
| `LOG_LEVEL` | No | `info` | all services | `debug`, `info`, `warn`, or `error` |

## CI Validation

Run the sync check to ensure `.env.example` matches the codebase:

```bash
./scripts/check-env-sync.sh
```

This script verifies:
1. No dead entries in `.env.example` (defined but unused)
2. No direct `process.env` reads in gateway outside `config/env.ts`
3. No direct `import.meta.env` reads in frontends outside `config.ts`
