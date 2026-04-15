# ARCHITECTURE.md — whynot Platform

> **This document is the single source of truth** for the whynot platform architecture.
> Every Claude agent, opencode agent, skill, rule, and migration prompt MUST reference this file.
> When any other document conflicts with this file, this file wins.

---

## Section 1 — System Overview

whynot is an AI-powered autonomous QA platform that converts user stories into executable test cases, runs them in real browser environments via Playwright, and reports bugs with screenshots, videos, and visual regression diffs. A multi-agent v2 engine (QA Lead, Exploratory Tester, API Tester, Security Tester, Auto Tester) coordinates autonomous testing sessions. The platform supports multi-model AI (Anthropic, OpenAI, Google, OpenRouter), workspace-based multi-tenancy, subscription + PAYG credit billing via Stripe, a superadmin panel, and CI/CD integration via API keys.

### High-Level Architecture

```
┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐
│  frontend    │   │  admin-frontend  │   │  CI / Webhooks  │
│  (5183)      │   │  (5184)          │   │                 │
└──────┬───────┘   └────────┬─────────┘   └────────┬────────┘
       │                    │                      │
       └────────────────────┼──────────────────────┘
                            │
                    ┌───────▼────────┐
                    │    gateway      │
                    │  (3010→3000)    │
                    │  Express + TS   │
                    └──┬──┬──┬──┬────┘
                       │  │  │  │
          ┌────────────┘  │  │  └──────────────┐
          │               │  │                 │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌──────────▼──────────┐
   │ ai-service  │ │test-executor│ │ qa-loop-executor     │
   │ (8010→8000) │ │(3011→3001)  │ │ (3012→3002)          │
   │ Python/     │ │ Node+TS     │ │ Node+TS              │
   │ FastAPI     │ │ Playwright  │ │ v2 multi-agent engine │
   └──────┬──────┘ └──────┬──────┘ └──────────┬───────────┘
          │               │                   │
          │         ┌─────▼─────┐             │
          │         │ Browsers  │             │
          │         │(Playwright│             │
          │         │  / MCP)   │             │
          │         └───────────┘             │
          │                                   │
     ┌────▼────────────────────────────────────▼───┐
     │              PostgreSQL 15                   │
     │              (5433→5432)                     │
     └─────────────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼──────┐
         │ Stripe │ │  LLM   │ │ GitHub/ │
         │        │ │Providers│ │ ClickUp │
         └────────┘ └────────┘ └─────────┘
```

### Glossary Preview

| Term | Meaning |
|------|---------|
| **QA Lead** | v2 agent that creates session plans and synthesizes final reports |
| **API Tester** | v2 agent that tests API endpoints |
| **Auto Tester** | v2 agent that generates automated test cases |
| **Exploratory Tester** | v2 agent that explores UI, finds bugs, detects forms |
| **Security Tester** | v2 agent that checks for security vulnerabilities |
| **Workspace** | Multi-tenant isolation boundary; owns projects, subscriptions, credits |
| **Project** | Container for user stories, test cases, and executions within a workspace |
| **Test Case** | A sequence of steps (navigate, click, type, assert, etc.) to verify a user story |
| **Execution** | A single run of a test case with step results, screenshots, and video |
| **PAYG Credits** | Pay-as-you-go credit units consumed per operation (test run, AI call, etc.) |
| **Feature Flag** | Boolean or numeric gate controlling feature availability per org/plan |
| **v2 Engine** | The multi-agent orchestration system in `services/qa-loop-executor/src/v2/` |

---

## Section 2 — Monorepo Layout

| Folder | Purpose | Tech | Key Entry Files | Owner Convention |
|--------|---------|------|----------------|-----------------|
| `frontend/` | User-facing SPA | Vite + React 18 + TS + Tailwind | `frontend/src/main.tsx`, `frontend/src/App.tsx` | Frontend team |
| `admin-frontend/` | Superadmin SPA | Vite + React 18 + TS + Tailwind | `admin-frontend/src/main.tsx`, `admin-frontend/src/App.tsx` | Frontend team |
| `gateway/` | API orchestrator | Express + TS | `gateway/src/api/main.ts` | Backend team |
| `services/` | Backend microservices (subdirectories below) | Mixed | — | Mixed |
| `services/ai-service/` | LLM test generation & vision analysis | Python 3.11+ / FastAPI | `services/ai-service/app/main.py`, `services/ai-service/app/api/routes.py` | AI team |
| `services/test-executor/` | Browser automation & test runner | Node + TS + Playwright | `services/test-executor/src/index.ts`, `services/test-executor/src/api/routes.ts` | Backend team |
| `services/qa-loop-executor/` | Autonomous agent runner (v1 + v2) | Node + TS + Vercel AI SDK | `services/qa-loop-executor/src/index.ts`, `services/qa-loop-executor/src/v2/orchestrator.ts` | AI team — **v2/ and mcp-browser.ts are untouchable** |
| `services/database/` | SQL migrations | PostgreSQL 15 | `services/database/migrations/001_initial_schema.sql` … `services/database/migrations/042_session_report_data.sql` | DBA — **untouchable except with user coordination** |
| `shared/` | Cross-service types, repositories, logger, utilities | Node + TS | `shared/database/connection.ts`, `shared/types/index.ts`, `shared/logger/logger.ts` | Shared ownership |
| `docs/` | Platform documentation | Markdown | `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/TROUBLESHOOTING.md` | All teams |
| `examples/` | API usage examples | Shell, Python | `examples/test-example.sh`, `examples/test-example.py` | All teams |
| `scripts/` | Deployment and build helpers | Shell | `scripts/deploy-railway.sh`, `scripts/run-migrations.sh`, `scripts/rebuild-test-executor.sh`, `scripts/adapt-import.sh` | DevOps |
| `tests/` | Integration and unit tests | TS (Jest) | `tests/integration/api.test.ts`, `tests/unit/retry.test.ts` | All teams |
| `prompts/` | Migration prompt files | Markdown | `prompts/01-v2-migration/` | Migration lead |
| `prompt-executor/` | Prompt execution utility | Python | `prompt-executor/prompt_executor.py` | Migration lead |
| `.claude/` | Claude Code agents, skills, rules | Markdown | `.claude/agents/`, `.claude/skills/`, `.claude/rules/` | All teams |
| `.opencode/` | OpenCode agents and commands | Markdown | `.opencode/agent/`, `.opencode/command/` | All teams |
| `.github/` | CI/CD workflows | YAML | `.github/workflows/` | DevOps |

---

## Section 3 — Runtime Topology

### Docker Compose Services

| Service | Image / Build | Host Port → Container Port | Health Check | Depends On |
|---------|--------------|---------------------------|-------------|-----------|
| `database` | `postgres:15-alpine` | `5433 → 5432` | `pg_isready` every 10s | — |
| `ai-service` | Build `./services/ai-service` | `8010 → 8000` | HTTP /health every 30s | — |
| `test-executor` | Build `.` + `./services/test-executor/Dockerfile` | `3011 → 3001` | HTTP /health every 30s | `database` (healthy), `ai-service` (started) |
| `qa-loop-executor` | Build `.` + `./services/qa-loop-executor/Dockerfile` | `3012 → 3002` | HTTP /health every 30s | `database` (healthy), `test-executor` (healthy) |
| `gateway` | Build `.` + `./gateway/Dockerfile` | `3010 → 3000` | HTTP /health every 30s | `database` (healthy), `ai-service` (started), `test-executor` (started), `qa-loop-executor` (started) |
| `frontend` | Build `./frontend` | `5183 → 80` | `wget` every 30s | `gateway` |
| `admin-frontend` | Build `./admin-frontend` | `5184 → 80` | `wget` every 30s | `gateway` |

### Environment Variables

#### Required

| Variable | Service | Purpose |
|----------|---------|---------|
| `POSTGRES_USER` | database, all services | DB username (default: `whynot`) |
| `POSTGRES_PASSWORD` | database, all services | DB password (default: `whynot`) |
| `POSTGRES_DB` | database, all services | DB name (default: `whynot`) |
| `DATABASE_URL` | gateway, test-executor, qa-loop-executor | Full Postgres connection string |
| `JWT_SECRET` | gateway | JWT signing key |

#### Secrets (Never Commit)

| Variable | Service | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | ai-service, qa-loop-executor | Anthropic Claude API key |
| `OPENAI_API_KEY` | ai-service | OpenAI API key |
| `STRIPE_SECRET_KEY` | gateway | Stripe server-side key |
| `STRIPE_WEBHOOK_SECRET` | gateway | Stripe webhook signature key |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | gateway | GitHub OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | gateway | Google OAuth |

#### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_PROVIDER` | `anthropic` | Default LLM provider (`anthropic` or `openai`) |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Default Anthropic model |
| `OPENAI_MODEL` | `gpt-4` | Default OpenAI model |
| `RATE_LIMIT_MAX_REQUESTS` | `200` | General API rate limit |
| `RATE_LIMIT_TEST_EXECUTION_MAX` | `50` | Test execution rate limit |
| `RATE_LIMIT_TEST_GENERATION_MAX` | `50` | Test generation rate limit |
| `SCREENSHOT_RETENTION_DAYS` | `30` | Screenshot cleanup threshold |
| `FRONTEND_URL` | `http://localhost:5183` | Frontend URL for CORS |
| `ADMIN_FRONTEND_URL` | `http://localhost:5184` | Admin frontend URL for CORS |
| `VISUAL_REGRESSION_ENABLED` | `true` | Enable visual regression |
| `TEST_EXECUTOR_CPUS` | `2.0` | CPU limit for test-executor |
| `TEST_EXECUTOR_MEMORY` | `4G` | Memory limit for test-executor |

### Networking

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| frontend | gateway | HTTP (proxied via nginx /api) | All API calls |
| admin-frontend | gateway | HTTP (proxied via nginx /api) | Admin API calls |
| gateway | ai-service | HTTP (ai-service:8000) | Test generation, visual diff analysis |
| gateway | test-executor | HTTP (test-executor:3001) | Test execution |
| gateway | qa-loop-executor | HTTP (qa-loop-executor:3002) | QA loop sessions |
| qa-loop-executor | test-executor | HTTP (test-executor:3001) | Browser automation for agents |
| test-executor | ai-service | HTTP (ai-service:8000) | Selector recovery, failure analysis |
| all backend services | database | PostgreSQL (database:5432) | Data persistence |
| gateway | Stripe API | HTTPS | Payment processing |
| ai-service | LLM APIs | HTTPS | Claude, OpenAI, etc. |
| qa-loop-executor | LLM APIs | HTTPS | Multi-agent AI calls |

### Service Startup Order

Docker Compose uses health checks to enforce startup order:

```
database (pg_isready)
    │
    ├──→ ai-service (HTTP /health)
    │        │
    │        └──→ test-executor (HTTP /health)
    │                  │
    │                  └──→ qa-loop-executor (HTTP /health)
    │                            │
    └────────────────────────────┘
                                 │
                          gateway (HTTP /health)
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              frontend (wget)         admin-frontend (wget)
```

The gateway is the last backend service to start because it depends on all others being healthy. Frontend containers start last as they depend on the gateway.

### Docker-Only Execution Rule

**All commands MUST run inside Docker containers.** No host-installed Node, Python, or npm.

```bash
# CORRECT
docker compose exec gateway npm run build
docker compose exec frontend npm run lint

# WRONG — never run directly on host
npm install
npm run dev
node script.js
```

### Volume Mounts

| Volume | Mount Point (container) | Purpose |
|--------|------------------------|---------|
| postgres_data | /var/lib/postgresql/data | Persistent database storage |
| screenshots | /app/screenshots (test-executor) | Test execution screenshots |
| visual-diffs | /app/visual-diffs (test-executor) | Visual regression diff images |
| videos | /app/videos (test-executor, gateway) | Test execution video recordings |
| Source bind mounts | /app/src, /app/shared | Hot-reload during development |

---

## Section 4 — Data Plane

### Postgres Schema Overview

All tables live in a single Postgres 15 database. Multi-tenancy is enforced via `workspace_id` foreign keys (added in migration 018).

#### Core Domain Tables

| Table | Migration | Purpose | Key FKs |
|-------|-----------|---------|---------|
| `users` | 017 | User accounts, auth, roles | — |
| `refresh_tokens` | 017 | JWT refresh token storage | `users.id` |
| `workspaces` | 018 | Multi-tenant isolation boundary | `users.id` (owner) |
| `projects` | 003 | Test project containers | `workspaces.id` |
| `user_stories` | 003 | User stories within projects | `projects.id` |
| `user_story_folders` | 004 | Folder organization for stories | `projects.id` |
| `test_suites` | 003 | Grouping of test cases | `projects.id` (via 036) |
| `test_cases` | 001 | Individual test definitions with steps | `user_stories.id`, `workspaces.id` |
| `executions` | 001 | Test run results | `test_cases.id`, `workspaces.id` |
| `step_results` | 001 | Per-step execution results | `executions.id` |
| `setup_hooks` | 005 | Pre-test setup steps (login, etc.) | `test_cases.id`, `workspaces.id` |
| `saved_environments` | 020 | Reusable environment configs | `workspaces.id` |

#### QA Loop Tables

| Table | Migration | Purpose | Key FKs |
|-------|-----------|---------|---------|
| `qa_loop_sessions` | 009 | Autonomous QA session state | `workspaces.id` |
| `qa_loop_test_cases` | 009 | Tests discovered by agents | `qa_loop_sessions.id` |
| `qa_loop_test_runs` | 009 | Test run results within sessions | `qa_loop_test_cases.id` |
| `qa_loop_bugs` | 009 | Bugs found by agents | `qa_loop_sessions.id` |
| `qa_loop_iterations` | 009 | Loop iteration tracking | `qa_loop_sessions.id` |
| `qa_loop_pages` | 009 | Pages discovered during exploration | `qa_loop_sessions.id` |
| `qa_loop_notes` | 009 | Agent notes and observations | `qa_loop_sessions.id` |
| `qa_loop_retest_summaries` | 009 | Retest result summaries | `qa_loop_sessions.id` |
| `qa_loop_documents` | 014 | Uploaded documents for context | `qa_loop_sessions.id` |
| `qa_session_plans` | 041 | Multi-agent session plans | `qa_loop_sessions.id` |
| `qa_agent_board` | 041 | Agent coordination board | `qa_loop_sessions.id` |

#### Chaos, Detective, Guardian Agents

| Table | Migration | Purpose |
|-------|-----------|---------|
| `qa_loop_chaos_patterns` | 010 | Chaos test patterns |
| `qa_loop_chaos_results` | 010 | Chaos test results |
| `qa_loop_chaos_summaries` | 010 | Chaos test summaries |
| `qa_loop_failure_timeline` | 011 | Failure timeline for root cause analysis |
| `qa_loop_failure_correlations` | 011 | Failure correlation data |
| `qa_loop_root_cause_analysis` | 011 | Root cause analysis results |
| `qa_loop_test_stability` | 011 | Test stability metrics |
| `qa_loop_guardian_decisions` | 012 | Guardian agent decisions |
| `qa_loop_iteration_plans` | 012 | Iteration planning data |
| `qa_loop_quality_scores` | 012 | Quality score tracking |
| `qa_loop_reports` | 012 | Generated QA reports |
| `qa_loop_budget_tracking` | 012 | Budget/cost tracking per session |
| `qa_loop_budget_alerts` | 015 | Budget threshold alerts |

#### Visual Regression

| Table | Migration | Purpose |
|-------|-----------|---------|
| `visual_baselines` | 008 | Baseline screenshots for comparison |
| `visual_comparisons` | 008 | Comparison results with pixel diff scores |

#### Failure Analysis & Chat

| Table | Migration | Purpose |
|-------|-----------|---------|
| `failure_analyses` | 006 | Classified failure records |
| `chat_sessions` | 006 | Chat-based test modification sessions |
| `chat_messages` | 006 | Individual chat messages |
| `bug_reports` | 006 | Bug reports from failures |
| `selector_learning` | 002 | Learned selectors for recovery |

#### Billing & Subscriptions

| Table | Migration | Purpose |
|-------|-----------|---------|
| `plans` | 021 | Subscription plan definitions |
| `plan_features` | 021 | Feature flags per plan |
| `workspace_subscriptions` | 021 | Active subscriptions per workspace |
| `credit_balances` | 021 | Current credit balance per workspace |
| `credit_transactions` | 021 | Credit transaction ledger |
| `invoices` | 022 | Invoice records (Stripe-linked) |

#### Admin, Audit & System

| Table | Migration | Purpose |
|-------|-----------|---------|
| `audit_log` | 023 | All admin/system mutation audit trail |
| `announcements` | 023 | System-wide announcements |
| `system_settings` | 023 | Runtime configuration key-value store |

#### Integrations & CI

| Table | Migration | Purpose |
|-------|-----------|---------|
| `auto_fix_attempts` | 024 | AI auto-fix attempt records |
| `github_repos` | 024 | Connected GitHub repositories |
| `public_scan_requests` | 024 | Public scan results |
| `qa_monitors` | 025 | Scheduled QA monitoring configs |
| `ci_api_keys` | 026 | CI/CD integration API keys |
| `user_integrations` | 029 | Third-party integrations (ClickUp, GitHub Issues) |
| `project_credentials` | 030 | Per-project auth credentials |
| `notification_preferences` | 030 | User notification settings |
| `perf_test_runs` | 039 | Performance test run data |

#### Webhooks & Notifications

| Table | Migration | Purpose |
|-------|-----------|---------|
| `qa_loop_api_keys` | 016 | QA Loop API keys |
| `qa_loop_notification_channels` | 016 | Notification channel configs |
| `qa_loop_webhook_logs` | 016 | Webhook delivery logs |

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ workspaces : owns
    users ||--o{ refresh_tokens : has
    workspaces ||--o{ projects : contains
    workspaces ||--o{ workspace_subscriptions : has
    workspaces ||--o{ credit_balances : has
    workspaces ||--o{ qa_loop_sessions : runs
    workspace_subscriptions }o--|| plans : references
    plans ||--o{ plan_features : defines
    projects ||--o{ user_stories : contains
    projects ||--o{ user_story_folders : organizes
    projects ||--o{ test_suites : groups
    user_stories ||--o{ test_cases : generates
    test_cases ||--o{ executions : produces
    executions ||--o{ step_results : details
    test_cases ||--o{ visual_baselines : tracks
    visual_baselines ||--o{ visual_comparisons : compares
    qa_loop_sessions ||--o{ qa_loop_test_cases : discovers
    qa_loop_sessions ||--o{ qa_loop_bugs : finds
    qa_loop_sessions ||--o{ qa_loop_iterations : runs
    qa_loop_sessions ||--o{ qa_loop_pages : maps
    qa_loop_sessions ||--o{ qa_session_plans : plans
    qa_loop_sessions ||--o{ qa_agent_board : coordinates
    credit_balances ||--o{ credit_transactions : logs
```

### Migration Convention

- **Path**: `services/database/migrations/`
- **Naming**: `NNN_short_name.sql` (zero-padded 3-digit ordinal)
- **Highest ordinal**: `services/database/migrations/042_session_report_data.sql`
- **Execution**: Migrations are auto-applied via Docker entrypoint (mounted to the container's /docker-entrypoint-initdb.d directory)
- **Untouchable rule**: Do not edit existing migration files. New migrations require user coordination.

### Raw-SQL Repository Pattern

Repositories live in `shared/database/repositories/`. Each wraps `pg.Pool` via `shared/database/connection.ts`, returns camelCase objects, and enforces org/workspace scoping.

**Repository index** (20 repositories, all under `shared/database/repositories/`):

| Repository | Primary Table(s) |
|-----------|-----------------|
| `shared/database/repositories/announcement-repository.ts` | `announcements` |
| `shared/database/repositories/audit-repository.ts` | `audit_log` |
| `shared/database/repositories/auto-fix-repository.ts` | `auto_fix_attempts`, `github_repos` |
| `shared/database/repositories/credit-repository.ts` | `credit_transactions`, `credit_balances` |
| `shared/database/repositories/execution-repository.ts` | `executions`, `step_results` |
| `shared/database/repositories/folder-repository.ts` | `user_story_folders`, `user_stories` |
| `shared/database/repositories/integration-repository.ts` | `user_integrations` |
| `shared/database/repositories/invoice-repository.ts` | `invoices` |
| `shared/database/repositories/plan-repository.ts` | `plans`, `plan_features`, `workspace_subscriptions` |
| `shared/database/repositories/project-repository.ts` | `projects`, `user_stories` |
| `shared/database/repositories/qa-monitor-repository.ts` | `qa_monitors`, `qa_loop_sessions` |
| `shared/database/repositories/selector-learning-repository.ts` | `selector_learning` |
| `shared/database/repositories/setup-hook-repository.ts` | `setup_hooks` |
| `shared/database/repositories/subscription-repository.ts` | `workspace_subscriptions` |
| `shared/database/repositories/system-settings-repository.ts` | `system_settings` |
| `shared/database/repositories/test-case-repository.ts` | `test_cases` |
| `shared/database/repositories/user-repository.ts` | `users` |
| `shared/database/repositories/user-story-repository.ts` | `user_stories`, `test_cases` |
| `shared/database/repositories/visual-regression-repository.ts` | `visual_baselines`, `visual_comparisons` |
| `shared/database/repositories/workspace-repository.ts` | `workspaces` |

### Database Connection

`shared/database/connection.ts` provides:
- `getPool()` — singleton `pg.Pool` (max 20 connections, 30s idle timeout, 2s connect timeout)
- `query<T>(text, params)` — execute query with logging
- `transaction<T>(callback)` — execute within transaction with auto-rollback on error
- `close()` — close all connections

Connection string from `DATABASE_URL` env var, defaulting to postgresql://whynot:whynot@localhost:5432/whynot.

### Money Convention

All monetary values are stored as `bigint` cents. No floats. No `numeric`. Conversion helpers will be created at shared/utils/money.ts in phase 7.

---

## Section 5 — API Surface

### Gateway Express Routes

The gateway (`gateway/src/api/main.ts`) is the single API entry point. All routes are prefixed with /api except health/metrics.

#### Route Catalog

| Path Prefix | Source | Purpose |
|-------------|--------|---------|
| GET /health | `gateway/src/api/main.ts` (inline) | Public health check |
| GET /metrics | `gateway/src/api/main.ts` (inline) | Prometheus-style metrics (auth required) |
| **Auth** | | |
| POST /api/auth/register | `gateway/src/api/main.ts` (inline) | User registration (rate: 5/hour) |
| POST /api/auth/login | `gateway/src/api/main.ts` (inline) | User login (rate: 10/15min) |
| POST /api/auth/logout | `gateway/src/api/main.ts` (inline) | Logout |
| GET /api/auth/me | `gateway/src/api/main.ts` (inline) | Current user info |
| GET /api/auth/github | `gateway/src/api/main.ts` (inline) | GitHub OAuth redirect |
| GET /api/auth/github/callback | `gateway/src/api/main.ts` (inline) | GitHub OAuth callback |
| GET /api/auth/google | `gateway/src/api/main.ts` (inline) | Google OAuth redirect |
| GET /api/auth/google/callback | `gateway/src/api/main.ts` (inline) | Google OAuth callback |
| POST /api/auth/forgot-password | `gateway/src/api/main.ts` (inline) | Password reset request |
| POST /api/auth/reset-password | `gateway/src/api/main.ts` (inline) | Password reset confirmation |
| **Workspaces** | | |
| GET/POST /api/workspaces | `gateway/src/api/main.ts` (inline) | List / create workspaces |
| GET/PUT/DELETE /api/workspaces/:id | `gateway/src/api/main.ts` (inline) | CRUD single workspace |
| **Projects** | | |
| GET/POST /api/projects | `gateway/src/api/main.ts` (inline) | List / create projects (feature-gated: max_projects) |
| GET/PUT/DELETE /api/projects/:id | `gateway/src/api/main.ts` (inline) | CRUD single project |
| GET/PUT/DELETE /api/projects/:id/context | `gateway/src/api/main.ts` (inline) | Project context / PRD |
| GET/POST /api/projects/:id/user-stories | `gateway/src/api/main.ts` (inline) | User stories within project |
| **User Stories** | | |
| GET/PUT/DELETE /api/user-stories/:id | `gateway/src/api/main.ts` (inline) | CRUD user story |
| PUT /api/user-stories/:id/folder | `gateway/src/api/main.ts` (inline) | Move story to folder |
| **Test Execution** | | |
| POST /api/run-test | `gateway/src/api/main.ts` (inline) | Run manual test (rate: 10/hour) |
| POST /api/generate-tests | `gateway/src/api/main.ts` (inline) | AI test generation (rate: 20/15min, requires subscription + credits) |
| POST /api/execute-test | `gateway/src/api/main.ts` (inline) | Execute test (requires subscription + credits) |
| GET /api/executions/:id | `gateway/src/api/main.ts` (inline) | Get execution result |
| **Batch Operations** | | |
| POST /api/projects/:projectId/run-all-tests | `gateway/src/api/main.ts` (inline) | Run all tests in project |
| POST /api/projects/:projectId/run-category/:category | `gateway/src/api/main.ts` (inline) | Run tests by category |
| **Visual Regression** | | |
| POST /api/test-cases/:testCaseId/baselines | `gateway/src/api/main.ts` (inline) | Create baseline |
| PUT /api/test-cases/:testCaseId/baselines/:baselineId/lock | `gateway/src/api/main.ts` (inline) | Lock baseline |
| PUT /api/visual-regressions/:id/ignore | `gateway/src/api/main.ts` (inline) | Ignore regression |
| **Test Cases & Folders** | | |
| POST /api/projects/:projectId/folders | `gateway/src/api/main.ts` (inline) | Create folder |
| PUT/DELETE /api/folders/:id | `gateway/src/api/main.ts` (inline) | Update / delete folder |
| GET/PUT/DELETE /api/test-cases/:id | `gateway/src/api/main.ts` (inline) | CRUD test case |
| **Setup Hooks** | | |
| POST /api/setup-hooks | `gateway/src/api/main.ts` (inline) | Create setup hook |
| PUT/DELETE /api/setup-hooks/:id | `gateway/src/api/main.ts` (inline) | Update / delete setup hook |
| GET /api/test-cases/:testCaseId/setup-hooks | `gateway/src/api/main.ts` (inline) | List hooks for test case |
| **Environments** | | |
| POST/PUT/DELETE /api/environments | `gateway/src/api/main.ts` (inline) | CRUD environments |
| **Billing** | | |
| POST /api/webhooks/stripe | `gateway/src/api/webhooks/stripe.ts` (raw body, mounted before `express.json()`) | Stripe webhook handler |
| POST /api/billing/checkout | `gateway/src/api/main.ts` (inline) | Create Stripe checkout session |
| POST /api/billing/portal | `gateway/src/api/main.ts` (inline) | Create billing portal session |
| GET /api/billing/invoices | `gateway/src/api/main.ts` (inline) | List invoices |
| POST /api/billing/cancel | `gateway/src/api/main.ts` (inline) | Cancel subscription |
| POST /api/billing/reactivate | `gateway/src/api/main.ts` (inline) | Reactivate subscription |
| **Admin** | | |
| POST /api/admin/plans | `gateway/src/api/main.ts` (inline) | Create plan (requireAdmin) |
| PUT /api/admin/plans/:id | `gateway/src/api/main.ts` (inline) | Update plan (requireAdmin) |
| POST /api/admin/plans/:id/archive | `gateway/src/api/main.ts` (inline) | Archive plan (requireAdmin) |
| **Bug Reporting & Auto-Fix** | | |
| POST /api/bugs/:bugId/create-task | `gateway/src/api/main.ts` (inline) | Create task in ClickUp/GitHub |
| POST /api/bugs/:bugId/auto-fix | `gateway/src/api/main.ts` (inline) | AI auto-fix |
| POST /api/bugs/:bugId/auto-fix-loop | `gateway/src/api/main.ts` (inline) | Iterative auto-fix |
| **GitHub Integration** | | |
| POST /api/github-repos | `gateway/src/api/main.ts` (inline) | Add GitHub repo |
| POST /api/github-repos/:id/test | `gateway/src/api/main.ts` (inline) | Test connection |
| DELETE /api/github-repos/:id | `gateway/src/api/main.ts` (inline) | Remove GitHub repo |
| **Routers** | | |
| /api/public | `gateway/src/api/public-router.ts` | Public scan endpoints (rate: 10/15min) |
| /api/ci | `gateway/src/api/ci-router.ts` | CI/CD integration (API key auth) |
| /api/monitors | `gateway/src/api/monitor-router.ts` | QA Monitor CRUD |
| /api/perf | `gateway/src/api/perf-router.ts` | Performance testing proxy |
| /api/integrations | `gateway/src/api/integrations-router.ts` | ClickUp + GitHub integrations |
| /api | `gateway/src/api/main.ts` (bugReportRouter) | Bug reporting |
| /api | `gateway/src/api/main.ts` (credentialsRouter) | Project credentials & notification prefs |
| /api/qa-loop | `gateway/src/api/qa-loop-router.ts` | QA Loop session management |

### Auth Middleware

**File**: `gateway/src/middleware/auth.ts`

- JWT in `Authorization: Bearer <token>`, decoded and verified against `JWT_SECRET`
- Attaches `req.user` with `userId`, `orgId` (workspace), `role`
- Resolves workspace from `X-Workspace-ID` header or user's default workspace
- `requireAuth()` — mandatory auth wall (returns 401 if missing/invalid)
- `optionalAuth()` — sets user if token present, continues if not

**File**: `gateway/src/middleware/admin-auth.ts`

- `requireAdmin()` — requires `admin` or `super_admin` role
- `requireSuperAdmin()` — requires `super_admin` role only
- Must be applied after `requireAuth`

**File**: `gateway/src/middleware/api-key-auth.ts`

- CI/CD API key auth: `Bearer wn_ci_<hash>`
- SHA-256 hashing for storage
- `requireApiKeyAuth()` middleware

### Rate Limiters

**File**: `gateway/src/middleware/rate-limit.ts`

| Limiter | Limit | Window |
|---------|-------|--------|
| `apiRateLimiter` | 100 requests | 15 minutes |
| `testExecutionRateLimiter` | configurable (default 10) | 1 hour |
| `testGenerationRateLimiter` | 20 requests | 15 minutes |
| `qaLoopSessionRateLimiter` | 5 sessions | 1 hour |
| `loginRateLimiter` | 10 attempts | 15 minutes |
| `registerRateLimiter` | 5 registrations | 1 hour |
| `publicEndpointRateLimiter` | 10 requests | 15 minutes |

### API Conventions

- **Org-scoping**: Every query joins on `workspace_id`; repositories enforce it; cross-org reads forbidden.
- **Cursor pagination** (target): List endpoints accept `?cursor=<base64>&limit=<n≤100>` and return `{ items, nextCursor }`. No offset pagination.
- **ISO 8601**: All timestamps serialized as ISO 8601 UTC strings.
- **camelCase**: All JSON bodies and responses use camelCase.
- **Error envelope**: `{ error: { code, message, details? } }` — consistent across all endpoints.
- **Request ID**: Every request gets a unique `X-Request-ID` header for tracing.
- **JSON limit**: 12MB max request body.
- **CORS**: Allowed origins: `FRONTEND_URL` and `ADMIN_FRONTEND_URL`.

---

## Section 6 — AI Subsystem

### v2 Engine (Read-Only)

The v2 multi-agent engine lives at `services/qa-loop-executor/src/v2/` and is **untouchable** by this migration. It is the production agent orchestration system.

#### Entry Points

| File | Purpose |
|------|---------|
| `services/qa-loop-executor/src/v2/orchestrator.ts` | Session lifecycle: login → planning → agent dispatch → cost tracking → report |
| `services/qa-loop-executor/src/v2/agent-board.ts` | Database-backed agent coordination (status, discoveries, messages via UPSERT) |
| `services/qa-loop-executor/src/v2/agent-context-builder.ts` | Builds context for agent prompts |
| `services/qa-loop-executor/src/v2/session-plan.ts` | Session plan storage and retrieval |
| `services/qa-loop-executor/src/v2/types.ts` | AgentType, AgentStatus, SessionPlan, and other v2 types |

#### Agents

| File | Agent Type | Role |
|------|-----------|------|
| `services/qa-loop-executor/src/v2/agents/base-agent.ts` | Base class | Common tool calling, cost tracking, error handling |
| `services/qa-loop-executor/src/v2/agents/qa-lead.ts` | QA Lead | Creates session plans, synthesizes final reports |
| `services/qa-loop-executor/src/v2/agents/exploratory-tester.ts` | Exploratory Tester | UI exploration, form detection, bug discovery |
| `services/qa-loop-executor/src/v2/agents/api-tester.ts` | API Tester | API endpoint testing |
| `services/qa-loop-executor/src/v2/agents/security-tester.ts` | Security Tester | Security vulnerability testing |
| `services/qa-loop-executor/src/v2/agents/auto-tester.ts` | Auto Tester | Automated test case generation |

#### Tools

| File | Purpose |
|------|---------|
| `services/qa-loop-executor/src/v2/tools/agent-tools.ts` | Shared agent utilities (browser interaction, screenshots, etc.) |
| `services/qa-loop-executor/src/v2/tools/board-tools.ts` | Agent board interaction (post discoveries, read other agents' findings) |

#### AI SDK Providers Used by v2

| Package | Version | Provider |
|---------|---------|----------|
| @ai-sdk/anthropic | 3.0.68 | Anthropic Claude |
| @ai-sdk/openai | 3.0.52 | OpenAI |
| @ai-sdk/google | 3.0.60 | Google (Gemini) |
| @ai-sdk/openai-compatible | 2.0.41 | OpenRouter and other compatible providers |
| @anthropic-ai/sdk | 0.27.0 | Native Anthropic SDK |
| @google/genai | 1.48.0 | Google GenAI |
| ai (Vercel AI SDK) | 6.0.154 | Agent tooling framework |

### MCP Browser Integration (Read-Only)

**File**: `services/qa-loop-executor/src/mcp-browser.ts`

Spawns a @modelcontextprotocol/sdk Playwright server via stdio transport. Provides tool listing and tool calling for browser automation. Includes video recording (frame capture), safety features (max duration 45 min, force cleanup, expense limit), and excluded tools (browser_install, browser_close, browser_run_code, browser_resize).

### AI Provider Factory

**File**: `gateway/src/utils/ai/select-ai-provider.ts`

All **non-v2** AI calls in the gateway route through `selectAIProvider(config)`. It takes `{ apiUrl, apiKey, provider? }` and returns the appropriate Vercel AI SDK provider instance.

| Provider | SDK Constructor | Detection Pattern |
|----------|----------------|-------------------|
| OpenAI | `createOpenAI` | `api.openai.com` |
| Anthropic | `createAnthropic` | `api.anthropic.com` |
| Google | `createGoogleGenerativeAI` | `generativelanguage.googleapis.com` |
| OpenRouter | `createOpenAICompatible` | `openrouter.ai` |
| Custom (OpenAI-compatible) | `createOpenAICompatible` | Any other URL (fallback) |

**Provider detection**: `gateway/src/utils/ai/detect-provider.ts` — pure function from URL substring to provider name. The optional `provider` field in config overrides auto-detection.

**OpenRouter rule**: OpenRouter MUST use `createOpenAICompatible({ name: 'openrouter', baseURL, apiKey })`, never `createOpenAI`. The OpenAI SDK v6 defaults to the Responses API (`/responses`), which OpenRouter does not support — it only supports `/chat/completions`. See commit `e231a08`.

### BYO-Keys Multi-Model Architecture (Phase 6 — Prompt 29)

Users store their own API keys in `user_ai_config` table. The provider factory resolves the right SDK instance per request based on user config.

### ai-service (Python)

**File**: `services/ai-service/app/main.py` — FastAPI on port 8000

| Endpoint | Purpose |
|----------|---------|
| GET /health | Service health & API key status |
| POST /api/generate-tests | Test case generation from user story + page context |
| POST /api/analyze-screenshot | Vision-based UI element detection |
| POST /api/agent-recovery | Agent discussion & selector resolution |
| POST /api/resolve-selector-failure | Claude fallback for complex failures |
| POST /api/analyze-failure | Failure classification (system vs app bug) |
| POST /api/chat/session | Create chat session |
| POST /api/chat/message | Send message & get response |
| GET /api/chat/session/{session_id} | Retrieve session history |
| POST /api/chat/generate-test | Generate test from conversation |
| POST /api/chat/modify-test | Modify test based on user request |
| POST /api/analyze-visual-diff | Visual regression analysis |

**Dependencies**: FastAPI 0.104.1, anthropic >= 0.18.0, openai 1.3.0, Pydantic 2.5.0, BeautifulSoup4, Pillow, httpx.

---

## Section 7 — Frontend Architecture

### Tech Stack

- **Build**: Vite 5 + React 18 + TypeScript 5.2
- **Styling**: Tailwind CSS 3.3
- **Routing**: React Router v6 (`react-router-dom ^6.20.0`)
- **Charts**: Recharts 3.8
- **Flow diagrams**: ReactFlow 11 + dagre
- **HTTP**: Axios 1.6
- **Port**: 5183 (dev), proxies /api to gateway at localhost:3000

### Entry Points

- `frontend/src/main.tsx` — React root render
- `frontend/src/App.tsx` — Route definitions and layout

### App Shell

The app shell is the top-level layout that wraps all authenticated pages.

| Component | Path | Responsibility |
|-----------|------|----------------|
| `AppShell` | `frontend/src/components/layout/AppShell.tsx` | Root layout: header + sidebar + `<Outlet />` + footer. Uses Shadcn `Sheet` for mobile sidebar. |
| `Header` | `frontend/src/components/layout/Header.tsx` | Top bar: mobile menu trigger, workspace switcher, breadcrumbs, credit balance, theme toggle, user dropdown (`Avatar` + `DropdownMenu`). |
| `Sidebar` | `frontend/src/components/layout/Sidebar.tsx` | Collapsible navigation rail. Icons + labels; collapses to icon-only. Shadcn `Tooltip` on collapsed state, `ScrollArea` for overflow. |
| `Footer` | `frontend/src/components/layout/Footer.tsx` | Minimal footer: version, docs link, status link. |
| `AuthShell` | `frontend/src/components/layout/AuthShell.tsx` | Centered `Card` layout for all auth pages (login, signup, forgot/reset password, verify email). |
| `ErrorBoundary` | `frontend/src/components/ErrorBoundary.tsx` | Shadcn-styled error fallback card with retry/reload/home actions. |

### Routing

React Router v6 with protected routes via `ProtectedRoute` component.

| Route | Page | Auth |
|-------|------|------|
| /landing | LandingPage | Public |
| /login | LoginPage | Public |
| /signup | SignupPage | Public |
| /forgot-password | ForgotPasswordPage | Public |
| /reset-password | ResetPasswordPage | Public |
| /verify-email | VerifyEmailPage | Public |
| /auth/callback | AuthCallbackPage | Public |
| /scan/:sessionId | PublicScanResultsPage | Public |
| / | HomePage | Required |
| /qa-loop | QALoopPage | Required |
| /projects | ProjectsPage | Required |
| /projects/:id | ProjectDetailPage | Required |
| /test-results | TestResultsPage | Required |
| /test-runs/:executionId | TestRunDetailPage | Required |
| /settings | SettingsPage | Required |
| /monitors | MonitorsPage | Required |
| /performance | PerformancePage | Required |
| /architecture-flow | ArchitectureFlowPage | Required |

### State Management

- **React Context** for global state:
  - `AuthContext` — user authentication, login/logout, token management
  - `ToastContext` — toast notification system
  - `WorkspaceContext` — current workspace, workspace switching
- **Local state** (`useState`) for component-specific state
- **Custom hooks** for complex logic (10 hooks in `frontend/src/hooks/`)

### Component Architecture

Components are organized by feature in `frontend/src/components/`:

| Directory | Component Count | Purpose |
|-----------|----------------|---------|
| `frontend/src/components/common/` | 35 | Shared UI primitives (Button, Card, Modal, Input, etc.) |
| `frontend/src/components/Billing/` | 4 | Credit usage, invoices, plan cards, transactions |
| `frontend/src/components/BrowserPreview/` | 4 | Live browser preview during test execution |
| `frontend/src/components/FlowNodes/` | 6 | ReactFlow nodes for architecture visualization |
| `frontend/src/components/layout/` | 5 | AppShell, AuthShell, Header, Sidebar, Footer (Shadcn-based) |
| `frontend/src/components/Onboarding/` | 2 | User onboarding flow |
| `frontend/src/components/Performance/` | 9 | Performance testing charts and config |
| `frontend/src/components/QALoop/` | 15 | QA Loop session management, agent progress, reports |
| `frontend/src/components/ScreenshotViewer/` | 2 | Screenshot gallery and modal viewer |
| `frontend/src/components/TestResults/` | 1 | Test results view |
| `frontend/src/components/TestRunner/` | 11 | Test execution, generation, input forms |
| `frontend/src/components/VisualRegression/` | 2 | Baseline management, comparison viewer |

### Custom Hooks

The frontend defines 10+ custom hooks in `frontend/src/hooks/`:

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state, login/logout, token refresh |
| `useWorkspace` | Current workspace context, workspace switching |
| `useToast` | Toast notification dispatch |
| `useProjects` | Project CRUD with caching |
| `useTestExecution` | Test execution state machine (idle → running → complete) |
| `useQALoop` | QA Loop session management, polling for status |
| `useVisualRegression` | Baseline management, comparison viewing |
| `useBilling` | Subscription state, credit balance, billing portal |
| `useLocalStorage` | Type-safe localStorage wrapper with SSR safety |
| `useDebounce` | Debounced value for search inputs |

### React Contexts

| Context | File | Provided Values |
|---------|------|-----------------|
| `AuthContext` | `frontend/src/contexts/AuthContext.tsx` | user, login(), logout(), register(), isAuthenticated, isLoading |
| `ToastContext` | `frontend/src/contexts/ToastContext.tsx` | toast(), dismiss(), toasts[] |
| `WorkspaceContext` | `frontend/src/contexts/WorkspaceContext.tsx` | workspace, workspaces[], switchWorkspace(), createWorkspace() |

### Shadcn Design System

- **Token reference**: See [`STYLES.md`](./STYLES.md) at repo root for comprehensive token documentation.
- **Shadcn base color**: zinc, with a sky-blue primary override.
- **Color space**: oklch — CSS variables store raw L C H components (e.g., `--primary: 0.55 0.18 230`).
- **Component library**: Shadcn UI primitives live in `frontend/src/components/ui/` (Button, Card, Dialog, Input, Table, Tabs, etc.).
- **Config files**: `frontend/components.json` and `admin-frontend/components.json`.
- **Stylelint**: Enforces `color-no-hex` rule to keep all colors within the oklch token system.
- **DesignSystemPage**: Available at the `/__design` route (dev-only) — showcases all tokens and primitives for visual QA.
- **Providers**: `ThemeProvider` and `DirectionProvider` wrap the app at the root level.

### i18n (Phase 4 — Prompt 17)

To be added: react-i18next, 5 locales (en, ar, fr, de, es), files under frontend/public/locales/, switcher component in header.

### RTL Support

Arabic only. `<html dir="ltr|rtl">` is driven by the `useDirection` hook, which reads `localStorage.i18nextLng`. Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`) preferred. See `.claude/rules/rtl-support-arabic.md` for patterns.

### Dark Mode

Class-based (`.dark` on `<html>`), persisted to `localStorage.theme`, backed by the `useTheme` hook.

### Mobile-First

Every Tailwind class starts mobile, adds `sm:`/`md:`/`lg:` progressively.

### Feature Flag Hook (Phase 5 — Prompt 25)

To be added: a `useFeatureFlag(key)` hook (to be created at frontend/src/hooks/useFeatureFlag.ts in phase 5, prompt 25).

### Runner / Results

Component catalog for the live test-runner and results views:

| Component | Path | Purpose |
|-----------|------|---------|
| `BrowserPreview` | `components/BrowserPreview/BrowserPreview.tsx` | Live browser iframe with controls, frame navigation, zoom |
| `BrowserControls` | `components/BrowserPreview/BrowserControls.tsx` | URL bar, navigation, browser/resolution selector |
| `BrowserFrame` | `components/BrowserPreview/BrowserFrame.tsx` | Frame renderer with loading/error/idle states |
| `FrameNavigation` | `components/BrowserPreview/FrameNavigation.tsx` | Step/frame timeline scrubber |
| `LiveMonitor` | `components/QALoop/LiveMonitor.tsx` | Real-time agent execution with thinking/tool-call feed |
| `AgentProgressPanel` | `components/QALoop/AgentProgressPanel.tsx` | Per-agent status board (polls /qa-loop/sessions/{id}/agents) |
| `QualityDashboard` | `components/QALoop/QualityDashboard.tsx` | Score gauge, risk summary, cost tracking |
| `ResultsTabs` | `components/QALoop/ResultsTabs.tsx` | Tabbed view: tests, bugs, pages, analysis, report |
| `StatsBar` | `components/QALoop/StatsBar.tsx` | Pages/tests/bugs/quality counters |
| `TestResultsView` | `components/TestResults/TestResultsView.tsx` | Step-by-step results with visual regression viewer |
| `KeyboardShortcutsDialog` | `components/KeyboardShortcutsDialog.tsx` | Shortcut reference (Space, R, Esc, ?, F) |

**Component API stability guarantee**: All components expose the same props interface as before the Shadcn rewrite. Pages that import them require only an import-path change (if the directory was renamed). WebSocket / streaming hooks (`useBrowserStream`, `useQALoopStream`) are untouched.

---

## Section 8 — Admin Architecture

### Tech Stack

- Vite 5 + React 18 + TypeScript + Tailwind CSS + Shadcn UI (Radix primitives)
- Recharts 2.10 for analytics charts, Lucide React for icons
- Port: 5184 (dev), proxies /api to gateway at localhost:3010

### Entry Points

- `admin-frontend/src/main.tsx` — React root render
- `admin-frontend/src/App.tsx` — Route definitions + providers (Auth, Theme, Direction)

### Layout

- `AdminShell` (`components/layout/AdminShell.tsx`) — sidebar + header + Outlet
- Sidebar collapses to icons on `md:`, full on `xl:`, becomes a Sheet on mobile
- Header: theme toggle, user dropdown with role badge, sign-out

### Pages

| Route | Page | Purpose |
|-------|------|---------|
| /login | LoginPage | Admin login (Shadcn Card + form) |
| / | DashboardPage | KPI cards (MRR, ARR, users, plans), recent signups, plan distribution tabs |
| /users | UsersPage | Paginated user table with search, role filter, bulk selection + export |
| /users/:id | UserDetailPage | Tabbed profile (Profile/Subscriptions/Usage/Audit), role change, credit grant/revoke, ban, impersonate |
| /plans | PlansPage | Plan cards with archive/restore, Stripe sync, feature flags |
| /plans/new | PlanEditPage | Plan creation form (dollar input → bigint-cents conversion) |
| /plans/:id/edit | PlanEditPage | Plan edit form |
| /subscriptions | SubscriptionsPage | Paginated table with status filter |
| /credits | CreditsPage | Credit ledger with manual grant dialog, bulk export |
| /analytics | AnalyticsPage | Charts (signups, revenue by plan, credit usage, churn) + date range picker |
| /audit-log | AuditLogPage | Filterable audit trail with collapsible detail diffs |
| /announcements | AnnouncementsPage | CRUD with scheduling (Dialog), publish/unpublish, type badges |
| /settings | SystemSettingsPage | Tabbed settings (General/Credits/Email/Webhooks/Security) |

### Shared Admin Components

| Component | File | Purpose |
|-----------|------|---------|
| AdminPageHeader | `components/admin/AdminPageHeader.tsx` | Title + breadcrumbs + primary action slot |
| FilterBar | `components/admin/FilterBar.tsx` | Search input + select filters + active filter chips |
| PaginatedTable | `components/admin/PaginatedTable.tsx` | Shadcn Table + cursor pagination controls + skeleton + selection |
| BulkActions | `components/admin/BulkActions.tsx` | Selection count + action dropdown |
| StatusBadge | `components/admin/StatusBadge.tsx` | Color-coded status (active/trialing/paused/past_due/canceled/banned) |
| DateRangePicker | `components/admin/DateRangePicker.tsx` | Date range with preset ranges (7d/30d/90d/year) |
| ConfirmDialog | `components/admin/ConfirmDialog.tsx` | Destructive-action confirmation with type-to-confirm |
| ExportMenu | `components/admin/ExportMenu.tsx` | CSV/JSON export dropdown |

### Access Control

- `requireAdmin` middleware (in `gateway/src/middleware/admin-auth.ts`) gates admin routes
- `requireSuperAdmin` for destructive operations (ban, delete, impersonate)
- All admin routes require JWT auth + admin/super_admin role

### Data Contracts

| Contract | Implementation |
|----------|---------------|
| Money | Bigint cents stored/transmitted; displayed via `lib/money.ts` `formatCents()`. Dollar input converted via `dollarsToCents()` on submit. |
| Timestamps | ISO 8601 UTC in API; rendered via `Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })` |
| Pagination | Cursor-based UI controls (PaginatedTable). Backend still uses offset — TODO marked for cursor migration in phase 8. |
| API Format | camelCase JSON. All responses use camelCase property names. |
| i18n | Keys under `admin.*` namespace in `public/locales/en/common.json`. No hardcoded English in JSX. |

### Planned Pages (Phase 5+)

| Page | Purpose | Nav Status |
|------|---------|------------|
| FeatureFlags | Per-org feature overrides | Disabled with tooltip "Coming in phase 5" |
| BillingConfig | Trial duration, credit pricing, plan templates | Disabled with tooltip "Coming in phase 5" |
| AIProviders | System-wide AI provider configuration | Disabled with tooltip "Coming in phase 5" |
| UsageTracking | Usage analytics, top consumers, cost breakdown | Disabled with tooltip "Coming in phase 5" |

---

## Section 9 — Billing & Payments

### Module Layout

| File | Purpose |
|------|---------|
| `gateway/src/payments/payment-service.ts` | Unified PaymentService — single entry point for all payment operations |
| `gateway/src/payments/stripe-provider.ts` | Stripe SDK wrapper with retry + idempotency |
| `gateway/src/payments/credit-cost-mapper.ts` | Operation → credit cost mapping |
| `gateway/src/payments/payment-error.ts` | Normalized error types (`PaymentServiceError`) |
| `gateway/src/payments/retry-engine.ts` | Exponential-backoff retry (max 3) for transient Stripe errors |
| `gateway/src/payments/idempotency.ts` | Idempotency key generation + deduplication |
| `gateway/src/payments/audit-logger.ts` | Payment audit logging (no card data / PII) |
| `gateway/src/payments/types.ts` | Shared payment types |
| `gateway/src/payments/index.ts` | Re-exports |

### Repositories

| Repository | Table | Purpose |
|-----------|-------|---------|
| `shared/database/repositories/subscription-repository.ts` | `workspace_subscriptions` | Subscription CRUD |
| `shared/database/repositories/payment-transaction-repository.ts` | `payment_transactions` | Transaction records (bigint cents) |
| `shared/database/repositories/billing-history-repository.ts` | `billing_history` | Billing event log |
| `shared/database/repositories/payg-credits-ledger-repository.ts` | `payg_credits_ledger` | PAYG charge ledger |
| `shared/database/repositories/billing-config-repository.ts` | `billing_config` | Configurable billing settings |
| `shared/database/repositories/credit-repository.ts` | `credit_balances`, `credit_transactions` | Credit balance + transaction log |
| `shared/database/repositories/invoice-repository.ts` | `invoices` | Stripe invoice records |

### PaymentService Public API

| Method | Purpose |
|--------|---------|
| `createCheckoutSession()` | Create Stripe checkout session with idempotency |
| `createSubscription()` | Create subscription rows + Stripe subscription |
| `handleWebhook(event)` | Dispatch by Stripe event type |
| `refund()` | Process refund via Stripe with audit trail |
| `chargePayg()` | PAYG charge: writes ledger row + Stripe payment intent |
| `provisionNewWorkspace()` | Creates subscription + initial credits on registration |
| `changePlan()` | Upgrade/downgrade plan |
| `checkCreditBalance()` | Check if sufficient credits |
| `consumeCredits()` | Deduct post-operation |
| `grantCredits()` / `revokeCredits()` | Admin manual adjustments |
| `getWorkspaceSubscription()` | Fetch plan + features |
| `getUsageSummary()` | Usage report for billing page |
| `createPortalSession()` | Stripe customer billing portal |
| `cancelSubscription()` | Cancel (immediate or at period end) |
| `reactivateSubscription()` | Reactivate canceled subscription |
| `syncPlanToStripe()` | Sync plan Product + Price to Stripe |

### Credit Cost Map

| Operation | Credits | Constant |
|-----------|---------|----------|
| Test generation | 3 | `TEST_GENERATION` |
| Test execution | 1 | `TEST_EXECUTION` |
| QA Loop iteration | 2 | `QA_LOOP_ITERATION` |
| QA Loop session reserve | 10 | `QA_LOOP_SESSION_RESERVE` |
| Visual regression comparison | 1 | `VISUAL_REGRESSION_COMPARISON` |
| Auto-fix attempt | 5 | `AUTO_FIX_ATTEMPT` |
| QA Monitor session | 10 | `QA_MONITOR_SESSION` |
| CI scan | 10 | `CI_SCAN` |

### Middleware Chain for Paid Operations

1. `requireAuth()` — verify JWT
2. `requireActiveSubscription()` — check subscription status + trial
3. `requireCredits(costKey)` — check credit balance (402 if insufficient)
4. Route handler executes
5. `deductCredits()` — subtract credits post-operation

### Two User Tiers (Phase 7)

- **BYO-keys**: ~$20/mo (configurable via `billing_config`); user brings own LLM API keys
- **Managed + PAYG**: ~$20/mo base + pay-as-you-go credits charged via usage-event rollup

### Free Trial

Duration configurable via superadmin → `billing_config.trial_days` (default 7).

### Money Convention

`bigint` cents everywhere, never float. See Section 4.

### Stripe Provider — Retry + Idempotency

- Exponential-backoff retry: max 3 attempts, base 1s delay, 8s cap, 10% jitter.
- Only retries transient errors (5xx, network). Never retries 4xx (card declined, invalid request).
- Idempotency keys (UUID v4) generated per create operation and forwarded to Stripe via `idempotencyKey` header.
- Deterministic keys available for deduplication of same org + operation combinations.

### Audit Logging

Every public `PaymentService` method writes to `payment_audit_log` table:
- Operation name, provider, status, duration, retry count
- Amount (bigint cents), currency, provider refs
- **Never logs**: card numbers, CVV, PII (email, name, phone, address)
- Audit failures are caught and logged to console — never break payment operations.

### Stripe Webhook Events Handled

| Event Type | Handler Action |
|-----------|---------------|
| `checkout.session.completed` | Activate subscription, record billing history |
| `customer.subscription.updated` | Update plan, adjust period dates |
| `customer.subscription.deleted` | Deactivate subscription, record billing history |
| `invoice.paid` | Record invoice, refill monthly credits, record billing history |
| `invoice.payment_failed` | Mark subscription past_due, record failed invoice |

### Webhook Idempotency

`payment_webhooks_idempotency` table deduplicates on Stripe `event.id` using `INSERT … ON CONFLICT DO NOTHING`. The webhook handler returns 200 for duplicate events without re-processing and sets `handled_at` after successful dispatch.

---

## Section 10 — Feature Flag System

### Tables

| Table | PK | Purpose |
|-------|-----|---------|
| `plan_features` | `(plan_id, feature_key)` | Features included per plan (migration 021) |
| `feature_flags` | `key text` | Global flag definitions with defaults + rollout percent (migration 043) |
| `organization_feature_flags` | `(organization_id, flag_key)` | Per-org overrides of global flags (migration 043) |

#### `feature_flags` schema

```
key              text PK
name             text NOT NULL
description      text
default_enabled  boolean NOT NULL DEFAULT false
rollout_percent  integer NOT NULL DEFAULT 0
created_at       timestamptz NOT NULL DEFAULT now()
updated_at       timestamptz NOT NULL DEFAULT now()
```

#### `organization_feature_flags` schema

```
organization_id  uuid FK → organizations(id) ON DELETE CASCADE
flag_key         text FK → feature_flags(key) ON DELETE CASCADE
enabled          boolean NOT NULL
set_by           uuid FK → users(id)
set_at           timestamptz NOT NULL DEFAULT now()
PK (organization_id, flag_key)
INDEX idx_org_feature_flags_org(organization_id)
```

### Registry

**File**: `shared/constants/platform-features.ts`

- `PLATFORM_FEATURES` — const object mapping enum-style keys to snake_case DB values
- `PlatformFeatureKey` — union type of all valid keys
- `ALL_PLATFORM_FEATURE_KEYS` — array of all valid keys
- `isValidFeatureKey(key)` — type guard for runtime validation

### Seeds

**File**: `shared/database/seeds/feature-flags.ts`

- One row per registry entry; `LANGUAGE_SWITCHER` defaults enabled, all others disabled
- Idempotent via `ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description`
- `seedFeatureFlags()` — async function to run the seed

### Gateway Feature Gate

**File**: `gateway/src/middleware/feature-gate.ts`

- `requireFeature(featureKey)` — 403 if plan doesn't include feature
- `requireFeatureLimit(featureKey, countFn)` — enforces numeric limits (e.g., max_projects)
- 1-minute in-memory cache for feature lookups

### Flag Resolution Order

1. Check `organization_feature_flags` for an org-specific override
2. If no override, use `feature_flags.default_enabled`
3. If `rollout_percent > 0` and no override, deterministic hash of `org_id + flag_key`

### React Hook (Phase 5 — Prompt 25)

To be added: a feature flag hook (to be created at `frontend/src/hooks/useFeatureFlag.ts` in phase 5, prompt 25) that fetches `/api/me/flags` and exposes `useFeatureFlag(key)`.

### Admin UI (Phase 5 — Prompt 25)

To be added: feature flag admin page (to be created at `admin-frontend/src/pages/FeatureFlagsPage.tsx` in phase 5, prompt 25).

### Audit

Every flag mutation writes to `audit_log`.

---

## Section 11 — Usage Tracking

### Current Implementation

Credit transactions are tracked in `credit_transactions` table via `shared/database/repositories/credit-repository.ts`. Each deduction records the operation type, amount, and metadata.

### Usage Events Table

**Migrations**: `043_usage_events.sql` (base), `045_usage_events_add_quantity.sql` (adds `quantity` column + user index)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, `gen_random_uuid()` |
| workspace_id | varchar(255) | Org-scoped, NOT NULL |
| user_id | varchar(255) | Nullable, SET NULL on user delete |
| event_type | varchar(100) | e.g. `test_generation`, `test_execution`, `qa_loop_iteration` |
| quantity | integer | Default 1 |
| credits_consumed | bigint | Default 0 |
| metadata | jsonb | Default `'{}'` |
| created_at | timestamptz | Default `now()` |

**Indexes**: `(workspace_id, created_at DESC)`, `(user_id, created_at DESC)`, `(event_type)`, `(created_at DESC)`

### Repository

**File**: `shared/database/repositories/usage-event-repository.ts`

Methods:
- `insertBatch(events)` — bulk INSERT with parameterized VALUES
- `listByOrg(workspaceId, { cursor?, limit?, eventType? })` — cursor-paginated (`(created_at, id) < (ts, id)`)
- `listByUser(userId, { cursor?, limit?, eventType? })` — cursor-paginated
- `aggregateByType(workspaceId, since)` — GROUP BY `event_type`, returns `{ event_type, total_events, total_quantity, total_credits }`
- `aggregateByDay(workspaceId, { from, to })` — GROUP BY `date_trunc('day', created_at)`, returns daily totals

### Tracker Utility

**File**: `gateway/src/utils/usage-tracker.ts`

```
recordUsageEvent({ workspaceId, userId?, eventType, quantity?, metadata? })
```

- Enqueues events into an in-memory buffer
- Flushes to DB when buffer reaches 100 events OR after 5 seconds (whichever comes first)
- On flush, also forwards events to `BillingService.recordUsageEvent` for Managed+PAYG tier workspaces (debit PAYG ledger at per-event rate from `DEFAULT_PAYG_RATES`)
- Graceful flush on `SIGTERM`, `SIGINT`, `beforeExit`

### Hook Locations

| Endpoint | Event Type | File | Line |
|----------|-----------|------|------|
| `POST /api/generate-tests` | `test_generation` | `gateway/src/api/main.ts` | after `deductCredits(..., 'TEST_GENERATION')` |
| `POST /api/execute-test` | `test_execution` | `gateway/src/api/main.ts` | after `deductCredits(..., 'TEST_EXECUTION')` |
| `POST /api/qa-loop/sessions` | `qa_loop_iteration` | `gateway/src/api/qa-loop-router.ts` | after `deductCredits(..., 'QA_LOOP_SESSION_RESERVE')` |

### PAYG Linkage

For workspaces on the `pro_managed` (Managed+PAYG) plan:
1. `recordUsageEvent()` enqueues → batch flush writes to `usage_events`
2. During flush, `SubscriptionManager.isManagedPaygTier(workspaceId)` is checked
3. If PAYG: `BillingService.recordUsageEvent()` creates a negative entry in `payg_credits_ledger` at the rate from `DEFAULT_PAYG_RATES`
4. If balance drops below threshold, `credits-low` email is sent

### Credit Operations Flow

```
User Action (e.g., "Generate Test")
    │
    ▼
requireAuth() ─── 401 if no token
    │
    ▼
requireActiveSubscription() ─── 402 if no sub / expired trial
    │
    ▼
requireCredits('TEST_GENERATION') ─── 402 if balance < 3 credits
    │
    ▼
Route Handler (calls ai-service, etc.)
    │
    ▼
deductCredits(workspaceId, 3, 'TEST_GENERATION', metadata)
    │
    ▼
INSERT INTO credit_transactions (workspace_id, amount, type, operation, ...)
    │
    ▼
UPDATE credit_balances SET balance = balance - 3 WHERE workspace_id = $1
```

### Credit Balance Invariants

- `credit_balances.balance` MUST never go negative — enforced by `CHECK (balance >= 0)` constraint
- `credit_transactions` is append-only — no updates or deletes
- Sum of all transactions for a workspace MUST equal the current balance
- Monthly refill amount is defined by the plan's `monthly_credits` feature value

---

## Section 12 — Observability

### Logger

**File**: `shared/logger/logger.ts`

Custom logger implementation with:
- Log levels: `DEBUG`, `INFO`, `WARN`, `ERROR` (hierarchical filtering)
- Service-scoped instances via `createLogger(serviceName, logLevel?)`
- JSON-formatted output with timestamps
- Request ID tracking via `generateRequestId()`
- Context object support for structured logging
- `metric(name, value, unit?, context?)` for performance tracking
- Log level controlled by `LOG_LEVEL` environment variable
- Uses `console` output (replaceable with Winston/Pino in production)

### Audit Log

**Table**: `audit_log` (migration 023)

Captures:
- Every superadmin mutation
- Every plan change
- Every payment event
- Every auth event (login, register, password reset)

**Repository**: `shared/database/repositories/audit-repository.ts`

### Request Tracking

**File**: `gateway/src/middleware/request-logger.ts`

- Generates unique request ID per request
- Sets `X-Request-ID` response header
- Logs request duration, method, path, status code
- Propagated to downstream services (target: via `X-Trace-Id` header)

### Metrics

**File**: `shared/utils/metrics.ts`

In-memory `MetricsCollector` singleton:
- `increment(name)` for counters
- `record(name, value)` for histograms/timings
- Keeps last 10K metrics, 1000 values per histogram
- `getCounter()`, `getHistogramStats()`, `getSummary()`
- Exposed via the GET /metrics endpoint

### Built-in Metric Names

The MetricsCollector tracks these standard metrics across all services:

| Metric Name | Type | Service | Description |
|-------------|------|---------|-------------|
| `api.requests` | Counter | gateway | Total API requests received |
| `api.errors` | Counter | gateway | Total API errors (4xx + 5xx) |
| `api.latency` | Histogram | gateway | Request latency in milliseconds |
| `test.executions` | Counter | test-executor | Total test executions started |
| `test.duration` | Histogram | test-executor | Test execution duration in ms |
| `test.failures` | Counter | test-executor | Test executions that failed |
| `ai.calls` | Counter | ai-service, qa-loop-executor | Total LLM API calls |
| `ai.tokens` | Counter | ai-service, qa-loop-executor | Total LLM tokens consumed |
| `ai.latency` | Histogram | ai-service | LLM response latency in ms |
| `qa.sessions` | Counter | qa-loop-executor | QA Loop sessions started |
| `qa.bugs_found` | Counter | qa-loop-executor | Bugs discovered by agents |
| `billing.credits_consumed` | Counter | gateway | Total credits consumed |
| `billing.webhook_events` | Counter | gateway | Stripe webhook events processed |

### Error Tracking

Errors are classified by severity and logged with full context:

| Level | When | Action |
|-------|------|--------|
| ERROR | Unhandled exception, external service failure | Log + alert (future: PagerDuty) |
| WARN | Rate limit hit, retry needed, degraded service | Log only |
| INFO | Request completed, test started/finished, session lifecycle | Log only |
| DEBUG | SQL queries, LLM prompts (redacted), detailed flow | Dev only (LOG_LEVEL=debug) |

### Prometheus / OpenTelemetry

Not yet wired. TODO (future prompt) — add OpenTelemetry instrumentation and Prometheus export.

---

## Section 13 — Security Model

### Authentication

- **JWT**: `Authorization: Bearer <token>`, signing key from `JWT_SECRET` env var
- Token generated by `gateway/src/services/auth-service.ts`
- Password hashing: `bcryptjs` (via `bcryptjs ^3.0.3` package)
- OAuth: GitHub and Google via OAuth 2.0 flows

### API Key Auth (CI/CD)

- Format: `Bearer wn_ci_<hash>`
- Hashing: SHA-256, stored as hash (shown once on creation)
- Middleware: `gateway/src/middleware/api-key-auth.ts`

### Org-Scoping

Every repository method requires `workspaceId`. Cross-workspace queries impossible by construction — all queries include `WHERE workspace_id = $1`.

### Three Secret/Signing Keys

The platform uses three distinct keys for cryptographic operations:

| Key | Env Variable | Algorithm | Purpose |
|-----|-------------|-----------|---------|
| JWT signing key | `JWT_SECRET` | HS256 (HMAC-SHA256) | Signs and verifies all JWT auth tokens |
| Stripe webhook key | `STRIPE_WEBHOOK_SECRET` | HMAC-SHA256 | Verifies Stripe webhook signature authenticity |
| AI config encryption key | `AI_CONFIG_ENCRYPTION_KEY` | AES-256-GCM | Encrypts user-provided LLM API keys at rest (to be added in phase 6) |

**Key management rules**:
- All three keys MUST be set via environment variables, never hardcoded
- `JWT_SECRET` must be ≥32 characters of cryptographically random data
- `STRIPE_WEBHOOK_SECRET` is provided by Stripe (starts with `whsec_`)
- `AI_CONFIG_ENCRYPTION_KEY` must be exactly 32 bytes (256 bits), base64-encoded
- None of these keys should be committed to version control or Docker images
- Rotation: JWT rotation invalidates all sessions; Stripe key rotated via Stripe dashboard; AI config key rotation requires re-encrypting all stored user keys

### Superadmin Role

- `users.role = 'super_admin'` (migration 021)
- Gated by `requireSuperAdmin()` middleware in `gateway/src/middleware/admin-auth.ts`
- Admin role (`admin`) has reduced privileges

### Rate Limits

Per-endpoint, per-IP rate limiting. See Section 5 rate limiter table. IP resolved from `X-Forwarded-For` header.

### Input Validation

**File**: `gateway/src/middleware/validation.ts`

- Zod-based validation via `validate(schema)` middleware
- URL sanitization: `sanitizeUrl()` — HTTP/HTTPS only
- Text sanitization: `sanitizeText()` — removes control chars, enforces max length
- Predefined schemas for register, login, runTest, generateTests, executeTest, createWorkspace, createUserStory, createPlan, updatePlan

### Security Headers

Helmet middleware with:
- HSTS: 1 year, preload enabled
- Standard security headers (X-Frame-Options, X-Content-Type-Options, etc.)

---

## Section 14 — i18n & Accessibility

### i18n

- **5 languages**: en, ar, fr, de, es
- **Frontend library**: `react-i18next` + `i18next-http-backend` + `i18next-browser-languagedetector`
- **Backend library**: `i18next` + `i18next-fs-backend` + `accept-language-parser`
- **Frontend namespaces (user app)**: `common`, `auth`, `dashboard`, `runner`, `results`, `settings`, `billing`, `landing`
- **Frontend namespaces (admin app)**: `common`, `admin`, `auth`, `settings`
- **Backend namespaces**: `errors`, `success`, `emails`, `validation`, `billing`
- **Translation files**: `frontend/public/locales/{lang}/{ns}.json`, `admin-frontend/public/locales/{lang}/{ns}.json`, `gateway/src/i18n/translations/{lang}/{ns}.json`
- **Switcher**: `<LanguageSwitcher />` component in both app headers (globe icon dropdown with native names + flags)
- **Backend**: `Accept-Language` header parsed by `i18nMiddleware` → `req.t(key, vars)` for localized error/success messages
- **Completeness tests**: `i18n-completeness.test.ts` in each project asserts identical key trees across all 5 locales

### RTL Support

- **Arabic only**: `<html dir="rtl">` set via i18next language detector
- **Tailwind logical properties**: `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`
- **Icon mirroring**: Directional icons use `rtl:scale-x-[-1]`
- **No `rtl:flex-row-reverse`**: Native `dir="rtl"` handles flex reversal automatically
- **Full rules**: `.claude/rules/rtl-support-arabic.md`

### Accessibility Targets

- **WCAG 2.1 AA** compliance target
- axe-core runs on every Playwright test (to be added)
- Lighthouse targets: ≥95 performance / 100 SEO / ≥95 a11y on landing page (phase 9)

### Translation Completeness

Tests assert identical key sets across all 5 locales. Each project has `i18n-completeness.test.ts` that recursively compares every namespace's key tree against the `en` reference. Non-English files currently contain English placeholder values; prompt 19 fills real translations.

### Sitemap & SEO (Phase 9 — Prompt 53)

To be added: Static sitemap generation for the landing page and public routes. The sitemap generator script will be created as part of the landing page SEO optimization in phase 9, prompt 53. It will output a sitemap.xml at the frontend build root covering all public-facing routes (landing, login, reset-password, scan). Dynamic routes (authenticated pages) are excluded from the sitemap and marked with a noindex robots meta tag.

### Language Detection

The i18n system detects user language preference in this priority order:
1. `localStorage` persisted preference (`i18nextLng` key)
2. Browser `navigator.language`
3. `<html lang>` attribute
4. Default: `en`

When Arabic is detected, the `useDirection()` hook reads `i18n.resolvedLanguage` and sets `document.documentElement.dir = "rtl"` and `document.documentElement.lang = "ar"`, triggering all RTL CSS logical property behavior automatically.

On the backend, `i18nMiddleware` parses the `Accept-Language` header and sets `req.lang` and `req.t()` for localized responses.

---

## Section 15 — Testing

### Current Test Infrastructure

| Location | Framework | Type |
|----------|-----------|------|
| `tests/integration/api.test.ts` | Jest + Axios | API integration tests |
| `tests/unit/retry.test.ts` | Jest | Unit test for retry utility |

### Target Test Infrastructure (Phase 2 — Prompts 05–06)

| Layer | Framework | Scope |
|-------|-----------|-------|
| Unit / Integration | Vitest + @vitest/coverage-v8 | `frontend/`, `admin-frontend/`, `gateway/`, `shared/`, each service |
| E2E UI | Playwright | Desktop + mobile × light + dark × ltr + rtl (ar) × 5 languages (critical flows) |
| API | Supertest | Gateway endpoints |
| Accessibility | axe-core + @axe-core/playwright | All UI pages |
| Performance/SEO | lighthouse-ci | Landing page |

### Docker-Only Test Execution

All tests run inside Docker containers. Never `npm test` on host.

```bash
# Gateway unit + supertest integration
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage

# Frontend unit (jsdom)
docker compose -f docker-compose.test.yml run --rm frontend-test

# Admin frontend unit (jsdom)
docker compose -f docker-compose.test.yml run --rm admin-frontend-test

# Shared library unit
docker compose -f docker-compose.test.yml run --rm shared-test

# E2E (Playwright)
docker compose -f docker-compose.test.yml up -d postgres-test
docker compose -f docker-compose.test.yml run --rm playwright

# Coverage — append --coverage to any vitest command
docker compose -f docker-compose.test.yml run --rm gateway-test npx vitest run --coverage

# Tear down
docker compose -f docker-compose.test.yml down -v
```

### Test Organization

| Directory | Test Type | Naming Pattern |
|-----------|-----------|---------------|
| `gateway/src/__tests__/` | Gateway unit + integration tests | `*.test.ts` |
| `frontend/src/__tests__/` | Frontend unit tests | `*.test.tsx` |
| `admin-frontend/src/__tests__/` | Admin frontend unit tests | `*.test.tsx` |
| `shared/__tests__/` | Shared library unit tests | `*.test.ts` |
| `frontend/e2e/` | Frontend Playwright E2E tests | `*.spec.ts` |
| `admin-frontend/e2e/` | Admin frontend Playwright E2E tests | `*.spec.ts` |
| `tests/integration/` | Legacy API integration tests (Jest) | `*.test.ts` |
| `tests/unit/` | Legacy shared utility unit tests (Jest) | `*.test.ts` |

### E2E Test Matrix (Phase 2 — Target)

| Dimension | Values | Combinations |
|-----------|--------|-------------|
| Viewport | Desktop (1280×720), Mobile (375×667) | 2 |
| Theme | Light, Dark | 2 |
| Direction | LTR (en), RTL (ar) | 2 |
| Language | en, ar (critical flows only for fr, de, es) | 2–5 |
| **Total critical flow combos** | | **8** (2×2×2) |

### Coverage Thresholds (ENFORCED)

All four packages (`frontend/`, `admin-frontend/`, `gateway/`, `shared/`) enforce **100%** coverage for lines, branches, functions, and statements via `vitest.config.ts` thresholds. The CI pipeline (`unit-integration` job in `.github/workflows/test.yml`) runs `npx vitest run --coverage` per package — if any package drops below 100% on any metric, the job fails and the PR cannot merge.

| Metric | Threshold |
|--------|-----------|
| Lines | 100% |
| Branches | 100% |
| Functions | 100% |
| Statements | 100% |

Coverage HTML reports are uploaded as build artifacts for every CI run (retained 14 days).

**`/* istanbul ignore next */` policy**: forbidden unless the line is provably unreachable AND annotated with an inline one-line WHY comment.

### Coverage Excludes (Authoritative)

```
services/qa-loop-executor/src/v2/**      — untouchable read-only engine
services/qa-loop-executor/src/mcp-browser.ts — untouchable MCP integration
**/*.test.ts, **/*.test.tsx, **/*.spec.ts — test files themselves
**/__tests__/**                           — test directories
**/dist/**, **/node_modules/**            — build outputs
**/*.d.ts                                 — type declarations
**/*.config.ts                            — configuration files
src/main.tsx (frontend, admin-frontend)   — React entry point (bootstrapping only)
src/api/main.ts (gateway)                  — Express entry point (bootstrapping only)
```

### Test Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| Retry helper | `shared/utils/retry.ts` | Exponential backoff with configurable max retries |
| Circuit breaker | `shared/utils/circuit-breaker.ts` | Fault tolerance for external service calls |
| Test fixtures | tests/fixtures/ (to be created in phase 2) | Shared test data factories |
| DB seed | tests/helpers/seed.ts (to be created in phase 2) | Test database seeding utilities |

---

## Section 16 — Untouchable Paths (AUTHORITATIVE)

These paths MUST NOT be modified by any migration prompt, agent, or automated tool:

```
services/qa-loop-executor/src/v2/       — READ ONLY
services/qa-loop-executor/src/mcp-browser.ts  — READ ONLY
services/database/migrations/           — No edits to existing files; new migrations require user coordination
```

**Rationale**:

- `services/qa-loop-executor/src/v2/` is the production multi-agent engine. Changing it risks production incidents and invalidates thousands of runs. It uses its own provider wiring (ai-sdk/anthropic, ai-sdk/openai, ai-sdk/google, ai-sdk/openai-compatible, Vercel AI SDK) that must remain intact.
- `services/qa-loop-executor/src/mcp-browser.ts` is the MCP Playwright integration that the v2 engine depends on for browser automation.
- `services/database/migrations/` is append-only by convention. Editing existing migrations breaks every downstream deployment, seed script, and database state.

Every subsequent prompt file, agent definition, and skill MUST reproduce this list and respect it.

---

## Section 17 — Conventions

| Convention | Rationale |
|-----------|-----------|
| **Docker-only execution** | Parity across dev/CI/prod. No host-installed Node/Python. |
| **bigint cents for money** | No float rounding errors. All monetary values stored as integer cents. |
| **Org-scoped data access** | Multi-tenant safety. Every query joins on `workspace_id`. |
| **Cursor-based pagination** | Stable under concurrent inserts. No offset pagination. |
| **ISO 8601 dates** | Unambiguous across timezones. All timestamps UTC. |
| **camelCase API responses** | Matches TypeScript/JavaScript conventions. |
| **Mobile-first CSS** | 70%+ expected mobile traffic. Base styles are mobile, breakpoints add desktop. |
| **Dark mode** | First-class, not retrofitted. Class-based `.dark` toggle. |
| **RTL support** | Arabic is a supported language. Logical CSS properties, icon mirroring. |
| **No backwards-compat shims** | Delete old code in the same PR that replaces it. No `_unused` renames. |
| **No comments unless the WHY is non-obvious** | Well-named identifiers are self-documenting. |
| **Tests accompany every change** | No orphan code. Every feature includes its tests. |

### TypeScript Conventions (from `.cursorrules`)

- **Strict mode** always enabled
- **No unused variables**: `noUnusedLocals` and `noUnusedParameters`
- **Module system**: Frontend = ESNext, Backend = CommonJS
- **Target**: ES2020
- **File naming**: kebab-case for files, PascalCase for React components, camelCase for utilities/hooks
- **Interfaces** over types (unless unions/intersections needed)
- **async/await** over promise chains
- **const** by default
- **Arrow functions** for callbacks
- **Destructuring** where it improves readability

### Python Conventions (from `.cursorrules`)

- **Python 3.11+**
- **PEP 8** style
- **Type hints** always required
- **Google-style docstrings** for public API
- **Pydantic models** for request/response validation
- **snake_case** for functions/variables, **PascalCase** for classes
- **f-strings** for formatting

### Error Envelope Convention

All API errors follow a consistent envelope:

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Not enough credits to perform this operation. Required: 3, available: 1.",
    "details": {
      "required": 3,
      "available": 1,
      "operation": "TEST_GENERATION"
    }
  }
}
```

Standard error codes:

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | VALIDATION_ERROR | Request body fails Zod validation |
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 402 | INSUFFICIENT_CREDITS | Credit balance too low |
| 402 | SUBSCRIPTION_REQUIRED | No active subscription or expired trial |
| 403 | FORBIDDEN | Valid auth but insufficient permissions |
| 403 | FEATURE_NOT_AVAILABLE | Plan doesn't include requested feature |
| 404 | NOT_FOUND | Resource doesn't exist or not in user's workspace |
| 429 | RATE_LIMIT_EXCEEDED | Rate limit hit |
| 500 | INTERNAL_ERROR | Unhandled server error |

### Clean Architecture

Services follow clean architecture layers:
1. **Domain** — business models and entities
2. **Application** — use cases and business logic
3. **Infrastructure** — external dependencies (DB, APIs, browsers)
4. **API** — HTTP routes and controllers

Dependencies point inward: Infrastructure → Application → Domain.

### File Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| React components | PascalCase | QALoopPage.tsx, TestRunner.tsx |
| Hooks | camelCase with use prefix | useAuth.ts, useDebounce.ts |
| Utilities | camelCase or kebab-case | retry.ts, circuit-breaker.ts |
| Repositories | kebab-case with -repository suffix | user-repository.ts |
| Routers | kebab-case with -router suffix | qa-loop-router.ts |
| Services | kebab-case with -service suffix | billing-service.ts |
| Middleware | kebab-case | rate-limit.ts, feature-gate.ts |
| Migrations | NNN_snake_case | `services/database/migrations/042_session_report_data.sql` |
| Tests | *.test.ts(x) or *.spec.ts | retry.test.ts, auth.spec.ts |

---

## Section 18 — Agent & Skill Registry

This section catalogs all agents, skills, rules, and commands in `.claude/` and `.opencode/`. Total file count: **268 markdown files**.

| Name | Type | Path | Purpose | Primary Section |
|------|------|------|---------|----------------|
| api-designer | agent | `.claude/agents/api-designer.md` | API design guidance | §5 |
| base-template-generator | agent | `.claude/agents/base-template-generator.md` | Template generation | §17 |
| blog-developer | agent | `.claude/agents/content/blog-developer.md` | Blog content development | §8 |
| legal-content-writer | agent | `.claude/agents/content/legal-content-writer.md` | Legal content authoring | §8 |
| bulk-selection-specialist | agent | `.claude/agents/design/bulk-selection-specialist.md` | Bulk selection UI patterns | §7 |
| design-brand-guardian | agent | `.claude/agents/design/design-brand-guardian.md` | Brand consistency | §7 |
| design-image-prompt-engineer | agent | `.claude/agents/design/design-image-prompt-engineer.md` | Image prompt engineering | §7 |
| design-inclusive-visuals-specialist | agent | `.claude/agents/design/design-inclusive-visuals-specialist.md` | Inclusive visual design | §7 |
| design-ui-designer | agent | `.claude/agents/design/design-ui-designer.md` | UI design | §7 |
| design-ux-architect | agent | `.claude/agents/design/design-ux-architect.md` | UX architecture | §7 |
| design-ux-researcher | agent | `.claude/agents/design/design-ux-researcher.md` | UX research | §7 |
| design-visual-storyteller | agent | `.claude/agents/design/design-visual-storyteller.md` | Visual storytelling | §7 |
| design-whimsy-injector | agent | `.claude/agents/design/design-whimsy-injector.md` | Whimsy and delight | §7 |
| frontend-developer | agent | `.claude/agents/frontend-developer.md` | Frontend development | §7 |
| prompt-engineer | agent | `.claude/agents/prompt-engineer.md` | Prompt engineering | §17 |
| translation-manager | agent | `.claude/agents/translation-manager.md` | Translation management | §14 |
| rtl-support-arabic | rule | `.claude/rules/rtl-support-arabic.md` | RTL support patterns | §14 |
| spec-driven-development | rule | `.claude/rules/spec-driven-development.md` | SDD workflow enforcement | §17 |
| switch-component-styling | rule | `.claude/rules/switch-component-styling.md` | Switch component rules | §7 |
| uncodixify-ui | rule | `.claude/rules/uncodixify-ui.md` | Anti-codex UI standards | §7 |
| url-tab-state | rule | `.claude/rules/url-tab-state.md` | URL-based tab persistence | §7 |
| ab-test-setup | skill | `.claude/skills/ab-test-setup/SKILL.md` | A/B test configuration | §8 |
| ad-creative | skill | `.claude/skills/ad-creative/SKILL.md` | Ad creative generation | §8 |
| backend-i18n | skill | `.claude/skills/backend-i18n/SKILL.md` | Backend i18n patterns | §14 |
| brand-guidelines | skill | `.claude/skills/brand-guidelines/SKILL.md` | Brand guide enforcement | §7 |
| canvas-design | skill | `.claude/skills/canvas-design/SKILL.md` | Canvas/visual design | §7 |
| churn-prevention | skill | `.claude/skills/churn-prevention/SKILL.md` | Churn prevention strategies | §9 |
| competitor-alternatives | skill | `.claude/skills/competitor-alternatives/SKILL.md` | Competitor analysis | §8 |
| content-strategy | skill | `.claude/skills/content-strategy/SKILL.md` | Content strategy | §8 |
| copywriting | skill | `.claude/skills/copywriting/SKILL.md` | Copywriting frameworks | §8 |
| debug-issue | skill | `.claude/skills/debug-issue.md` | Issue debugging | §17 |
| landing-page-optimization | skill | `.claude/skills/landing-page-optimization/SKILL.md` | Landing page CRO | §7 |
| legal-content-generator | skill | `.claude/skills/legal-content-generator/SKILL.md` | Legal content (privacy, terms) | §8 |
| marketing-ideas | skill | `.claude/skills/marketing-ideas/SKILL.md` | Marketing ideation | §8 |
| page-cro | skill | `.claude/skills/page-cro/SKILL.md` | Page conversion optimization | §7 |
| paid-ads | skill | `.claude/skills/paid-ads/SKILL.md` | Paid advertising | §8 |
| paywall-upgrade-cro | skill | `.claude/skills/paywall-upgrade-cro/SKILL.md` | Paywall optimization | §9 |
| popup-cro | skill | `.claude/skills/popup-cro/SKILL.md` | Popup conversion optimization | §7 |
| pricing-strategy | skill | `.claude/skills/pricing-strategy/SKILL.md` | Pricing strategy | §9 |
| programmatic-seo | skill | `.claude/skills/programmatic-seo/SKILL.md` | Programmatic SEO | §8 |
| refactor-safely | skill | `.claude/skills/refactor-safely.md` | Safe refactoring | §17 |
| referral-program | skill | `.claude/skills/referral-program/SKILL.md` | Referral program design | §8 |
| review-changes | skill | `.claude/skills/review-changes.md` | Code review | §17 |
| shadcn-design-system-compliance | skill | `.claude/skills/shadcn-design-system-compliance/SKILL.md` | Shadcn UI compliance | §7 |
| signup-flow-cro | skill | `.claude/skills/signup-flow-cro/SKILL.md` | Signup flow optimization | §7 |
| social-content | skill | `.claude/skills/social-content/SKILL.md` | Social media content | §8 |
| spec-driven-development | skill | `.claude/skills/spec-driven-development/SKILL.md` | SDD workflow tooling | §17 |
| theme-factory | skill | `.claude/skills/theme-factory/SKILL.md` | Theme generation | §7 |
| whynot-dashboard | skill | `.claude/skills/whynot-dashboard/SKILL.md` | Dashboard patterns | §7 |
| AGENT | opencode-agent | `.opencode/agent/AGENT.md` | Base opencode agent | §17 |
| speckit.analyze | command | `.opencode/command/speckit.analyze.md` | Spec analysis | §17 |
| speckit.checklist | command | `.opencode/command/speckit.checklist.md` | Spec quality checklist | §17 |
| speckit.clarify | command | `.opencode/command/speckit.clarify.md` | Spec clarification | §17 |
| speckit.constitution | command | `.opencode/command/speckit.constitution.md` | Project constitution | §17 |
| speckit.implement | command | `.opencode/command/speckit.implement.md` | Spec implementation | §17 |
| speckit.plan | command | `.opencode/command/speckit.plan.md` | Spec planning | §17 |
| speckit.specify | command | `.opencode/command/speckit.specify.md` | Spec specification | §17 |
| speckit.tasks | command | `.opencode/command/speckit.tasks.md` | Spec task breakdown | §17 |
| speckit.taskstoissues | command | `.opencode/command/speckit.taskstoissues.md` | Tasks to GitHub issues | §17 |

**OpenCode agents** (148 agents in `.opencode/agent/`): Includes specialized agents for marketing (xiaohongshu, zhihu, douyin, kuaishou, weibo, wechat, bilibili, livestream, tiktok, twitter, linkedin, instagram, podcast), design (ui-designer, brand-guardian, inclusive-visuals, ux-architect, ux-researcher, visual-storyteller, whimsy-injector), development (frontend-developer, javascript-pro, typescript-pro, react-specialist, tanstack-router-expert, drizzle-orm-expert, nextjs experts), testing (e2e-playwright-specialist, qa-expert, test-automator, unit-test-specialist, performance-test-engineer, accessibility-auditor), infrastructure (build-engineer, ops-cicd-github, mcp-manager, performance-engineer), security (security-auditor, security-review-specialist, blockchain-security-auditor, auth-tester, compliance-auditor), billing (stripe-billing-specialist, stripe-mcp-manager, lemonsqueezy-payment-expert, moyasar-payment-expert), product (product-manager, product-feedback-synthesizer, product-sprint-prioritizer, product-trend-researcher, product-behavioral-nudge-engine), and many more.

---

## Section 19 — How to Update This File

1. **Any prompt/commit that introduces or changes a subsystem MUST amend the relevant section in the same commit.**
2. PRs that change architecture without updating this file are rejected by the reviewer.
3. Section numbering is stable (1–20). New sections append with the next number and an entry in the Glossary.
4. Do not delete sections — mark them `(deprecated YYYY-MM-DD)` instead.
5. When adding new agents/skills/rules, update Section 18's table in the same commit.
6. Keep tables and lists factual — every file path must point to a real file; every claim must be grounded in code.

---

## Section 20 — Glossary

| Term | Definition |
|------|-----------|
| **API Gateway** | The Express+TS service at `gateway/` that orchestrates all API calls, auth, rate limiting, and billing |
| **Audit Log** | The `audit_log` table capturing every admin mutation, auth event, and payment event |
| **BYO-keys** | "Bring Your Own Keys" — subscription tier where users provide their own LLM API keys |
| **camelCase rule** | All JSON API bodies and responses use camelCase property names |
| **Circuit Breaker** | Fault tolerance pattern in `shared/utils/circuit-breaker.ts` protecting external service calls |
| **Credits ledger** | The `credit_transactions` + `credit_balances` tables tracking pay-as-you-go credit usage |
| **Cursor pagination** | Pagination using opaque cursor tokens instead of page offsets; stable under concurrent inserts |
| **Dark mode class** | `.dark` CSS class on `<html>` element toggling dark theme; persisted in `localStorage.theme` |
| **Execution** | A single run of a test case, producing step results, screenshots, and optional video |
| **Feature flag** | Boolean or numeric gate controlling feature availability, stored in `plan_features` (and per-org overrides) |
| **i18n** | Internationalization — 5 supported languages (en, ar, fr, de, es) via `react-i18next` |
| **ISO 8601** | Date/time format standard — all timestamps serialized as UTC strings (e.g., `2026-04-13T12:00:00Z`) |
| **JWT** | JSON Web Token — auth mechanism using `Authorization: Bearer <token>`, signed with `JWT_SECRET` |
| **LLM provider** | External AI service (Anthropic Claude, OpenAI, Google Gemini, OpenRouter) used for test generation and agent reasoning |
| **Managed+PAYG** | Subscription tier with platform-managed AI + pay-as-you-go credit billing |
| **MCP** | Model Context Protocol — used by `services/qa-loop-executor/src/mcp-browser.ts` to provide Playwright browser tools to AI agents |
| **Migration** | SQL file in `services/database/migrations/` that modifies the database schema; append-only convention |
| **Mobile-first** | CSS methodology where base styles target mobile; larger breakpoints added via `sm:`/`md:`/`lg:` |
| **OKLCH** | Color space used for CSS custom properties in the Shadcn design system (phase 1) |
| **Org-scoping** | Multi-tenant data isolation via `workspace_id` foreign key on every query |
| **PAYG** | Pay-As-You-Go — credit-based billing model where operations consume credits |
| **QA Loop** | Autonomous testing session where AI agents explore, test, and report bugs without human intervention |
| **RTL** | Right-to-left layout direction — enabled for Arabic via `<html dir="rtl">` |
| **Selector learning** | System that records successful CSS/XPath selectors in `selector_learning` for faster recovery |
| **Shadcn** | UI component library (to be added in phase 1) using Radix primitives + Tailwind CSS |
| **STYLES.md** | Token reference document for the Shadcn design system (to be created in phase 1) |
| **Superadmin** | User with `role = 'super_admin'` who can manage all workspaces, plans, and system settings |
| **Test case** | A sequence of steps (navigate, click, type, assert, etc.) generated from a user story |
| **Trial days** | Free trial period before subscription required; configurable via `billing_config.trial_days` |
| **Untouchable path** | File or directory that MUST NOT be modified — see Section 16 |
| **Usage event** | A recorded operation (test run, AI call, etc.) that may consume credits (to be added in phase 7) |
| **User story** | Natural-language description of a feature or behavior to be tested |
| **v2 engine** | Multi-agent orchestration system at `services/qa-loop-executor/src/v2/` — untouchable |
| **Visual regression** | Pixel-level comparison of screenshots against baselines to detect UI changes |
| **Vitest** | Test runner to replace Jest (phase 2) for unit/integration tests across all packages |
| **WCAG 2.1 AA** | Web Content Accessibility Guidelines target level for the platform |
| **Webhook idempotency** | Deduplication of Stripe webhook events to prevent double-processing |
| **Workspace** | Multi-tenant isolation boundary; each workspace owns its projects, subscriptions, and credits |
| **Setup hook** | Pre-test automation step (e.g., login, seed data) attached to a test case |
| **Agent board** | Database-backed coordination surface where v2 agents post discoveries and read each other's findings |
| **Session plan** | QA Lead-generated plan defining which agents to dispatch and what to test |
| **Selector learning** | System that caches successful CSS/XPath selectors to speed up future test recovery |
| **Error envelope** | Standard JSON error format: `{ error: { code, message, details? } }` used by all API endpoints |
| **Credit transaction** | Immutable ledger entry recording a credit deduction, grant, or refill event |
| **Feature gate** | Middleware that checks whether the current workspace's plan includes a required feature |
| **Request ID** | Unique identifier (`X-Request-ID` header) assigned to every API request for distributed tracing |
| **Workspace** | Multi-tenant isolation boundary — owns projects, subscriptions, credits, and team members |
