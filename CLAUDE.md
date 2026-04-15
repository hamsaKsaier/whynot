# CLAUDE.md — whynot Platform

**Single source of truth**: See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for authoritative system architecture, conventions, untouchable paths, data model, API surface, and testing strategy. This file covers only per-branch conventions and agent invocation rules. When in conflict, `ARCHITECTURE.md` wins.

---

## Top 10 Rules (Quick Reference)

1. **Docker-only execution** — all commands run inside Docker containers; no host Node/Python/npm.
2. **Untouchable paths** — never modify `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, or existing files in `services/database/migrations/`.
3. **bigint cents for money** — no floats, no `numeric`; all monetary values are integer cents.
4. **Org-scoped data access** — every query joins on `workspace_id`; cross-org reads forbidden.
5. **Cursor-based pagination** — no offset pagination; use `?cursor=<base64>&limit=<n≤100>`.
6. **ISO 8601 UTC timestamps** — all dates serialized as ISO 8601 strings.
7. **camelCase API responses** — all JSON uses camelCase property names.
8. **Tests accompany every change** — no orphan code; every feature ships with tests.
9. **RTL support for Arabic** — logical CSS properties (`ms-`, `me-`), no `rtl:flex-row-reverse`, icon mirroring with `rtl:scale-x-[-1]`.
10. **No backwards-compat shims** — delete old code in the same PR that replaces it.

---

## Agent Invocation Quick Reference

| Agent Location | When to Use |
|---------------|-------------|
| `.claude/agents/` | Claude Code agents — use for frontend dev, API design, content, design, translation, prompt engineering |
| `.claude/skills/` | Claude Code skills — invoke via `/skill-name` for specialized tasks (CRO, SEO, i18n, legal, billing, etc.) |
| `.claude/rules/` | Auto-loaded rules — RTL support, SDD workflow, URL tab state, switch styling, Uncodixify UI |
| `.opencode/agent/` | OpenCode agents (148) — marketing, testing, security, design, infrastructure, product |
| `.opencode/command/` | OpenCode commands — SpecKit workflow (`speckit.analyze`, `speckit.checklist`, `speckit.plan`, etc.) |

---

## Canonical Docker Test Commands

```bash
# Unit / integration tests (target — update as scripts land)
docker compose -f docker-compose.test.yml run --rm gateway bun vitest run
docker compose -f docker-compose.test.yml run --rm frontend bunx playwright test
docker compose -f docker-compose.test.yml run --rm gateway bun vitest run --coverage

# Current test commands
docker compose exec gateway npm test
docker compose exec frontend npm test

# Linting
docker compose exec frontend npm run lint
docker compose exec gateway npm run lint

# Type checking
docker compose exec frontend npx tsc --noEmit
docker compose exec gateway npx tsc --noEmit

# Database migrations (append-only)
docker compose exec database psql -U whynot -d whynot -f /docker-entrypoint-initdb.d/NNN_name.sql
```

---

## Branch Conventions

- `main` — production-ready code
- `v2` — current development branch for v2 migration
- Feature branches off `v2`: `feat/description`, `fix/description`

---

## Key File Paths

| What | Where |
|------|-------|
| Architecture doc | `ARCHITECTURE.md` (this repo root) |
| Gateway routes | `gateway/src/api/main.ts` |
| Auth middleware | `gateway/src/middleware/auth.ts` |
| DB connection | `shared/database/connection.ts` |
| Repositories | `shared/database/repositories/` |
| Types | `shared/types/index.ts` |
| Logger | `shared/logger/logger.ts` |
| Migrations | `services/database/migrations/` |
| v2 engine (READ ONLY) | `services/qa-loop-executor/src/v2/` |
| MCP browser (READ ONLY) | `services/qa-loop-executor/src/mcp-browser.ts` |
