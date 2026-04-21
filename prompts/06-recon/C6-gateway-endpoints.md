# Recon — Gateway endpoints

## Agent
`api-designer` (`.claude/agents/api-designer.md`) leads; `recon-engineer` (A1) implements.

## Skills
- Primary: `.claude/skills/spec-driven-development/`, `.claude/skills/exploit-safety/` (A4)
- Supporting: `.claude/skills/backend-i18n/`
- Rules: `.claude/rules/recon-safety.md` (A7)

## Dependencies
- A1, A4, A7, B1, B2, B3, B4, C1

## Task
Add the gateway HTTP API for Recon. Every endpoint is gated by feature flag + plan feature + credit gate + workspace-scoped permission check.

### 1. Endpoints to add
Mount under `gateway/src/api/recon/` (new router):

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/recon/scans` | Create a scan; persist authorization row; enqueue executor |
| `GET` | `/api/recon/scans` | List scans for caller's workspace, with filters (status, severity, project) |
| `GET` | `/api/recon/scans/:id` | Scan detail incl. phases + heartbeat + cancel state |
| `GET` | `/api/recon/scans/:id/findings` | Findings (filtered by severity, vuln_class) |
| `GET` | `/api/recon/scans/:id/report` | Markdown report (or PDF via Accept header) |
| `POST` | `/api/recon/scans/:id/cancel` | Set `cancel_requested_at = now()` |
| `POST` | `/api/recon/scans/:id/resume` | Resume from last completed phase; URL must match (per A2 rule #5) |

### 2. Middleware chain (every endpoint)
```ts
router.use(requireAuth);
router.use(requireFlag('recon_enabled'));         // 404 if flag off
router.use(requireFeature('recon_enabled'));      // 402 if plan doesn't include
router.use(requireWorkspaceAccess);
```
The create endpoint additionally runs:
- `validateAuthorizationPayload` (per A4 — rejects with `errors:recon.authorization.required` / `.malformed`)
- `BillingService.checkReconQuota` + credit-gate (per B3)
- `validateProjectHasGitHubRepo` (per D3 — return `errors:recon.project.repoRequired` if missing)
- `validateEnvironmentHasUrl` (return `errors:recon.environment.urlRequired` if missing)
- `productionEnvironmentWarning` middleware: if `environment.type === 'production'`, attach `warnings: [...]` to the response — does NOT block (per D6 in plan, soft warning only).

### 3. Request validation
Use the project's existing validation library (find via `grep -r 'zod\|joi' gateway/src/middleware/`). Schemas:
- `CreateScanRequest`: `{ project_id, environment_id, target_url, config_yaml?, authorization: { acknowledged, justification, acknowledged_by_user_id, acknowledged_at } }`
- `CancelScanRequest`: empty body
- `ResumeScanRequest`: `{ target_url }` (must equal original)

### 4. Response shape
- All responses are camelCase per project convention.
- Money fields are bigint cents (per project convention).
- Dates are ISO 8601 strings.
- List endpoint uses cursor-based pagination (per project convention).

### 5. Rate limiter
Add `reconRateLimiter`: 5 scans per workspace per hour (sliding window). Reuse the existing rate-limit utility in `gateway/src/middleware/`.

### 6. Resume endpoint URL guard (A2 rule #5)
Compare original `target_url` byte-for-byte. Mismatch → 400 `errors:recon.resume.urlMismatch`.

### Tests
Per endpoint, in `gateway/src/__tests__/recon/`:
- Auth required: anonymous → 401.
- Flag off → 404.
- Plan without `recon_enabled` → 402 + `errors:recon.payment.required`.
- Wrong workspace user → 404 (NOT 403 — must not leak existence).
- Create endpoint: missing authorization → 400; short justification → 400; persisted authorization row matches request.
- Create endpoint: production env returns response with `warnings[0].code === 'recon.environment.production'`.
- Resume endpoint: mismatched URL → 400.
- Cancel endpoint: idempotent (calling twice doesn't error).
- Pagination: cursor round-trip works for list endpoint.
- Rate limit: 6th scan within an hour → 429.
- 100% coverage on new files.

### i18n
- All response messages localized via `req.t(...)`.
- Keys to add (5 locales each, in `gateway/src/i18n/translations/{lng}/{errors,success,validation}.json`):
  - `errors:recon.authorization.required`
  - `errors:recon.authorization.malformed`
  - `errors:recon.authorization.justification.tooShort`
  - `errors:recon.payment.required`
  - `errors:recon.project.repoRequired`
  - `errors:recon.environment.urlRequired`
  - `errors:recon.resume.urlMismatch`
  - `errors:recon.scan.notFound`
  - `errors:recon.scan.invalidStatus` (e.g. cancel after completed)
  - `errors:recon.rateLimit.exceeded`
  - `success:recon.scan.created`
  - `success:recon.scan.cancelled`
  - `success:recon.scan.resumed`
  - `validation:recon.authorization.acknowledged`
  - `validation:recon.targetUrl.invalid`
  - `recon.warnings.environmentProduction` (warning code)

### Documentation
- E3 covers the user-facing API quickstart (CI integration page).

### Files to modify
- `gateway/src/api/recon/index.ts` (new router) + handler files
- `gateway/src/api/main.ts` — mount new router
- `gateway/src/middleware/recon-validation.ts` (new)
- 15 gateway locale files (5 langs × 3 namespaces)
- Tests under `gateway/src/__tests__/recon/`
