# Feature flags: backend util, middleware, audit

## Agent
`api-designer` (lead) + skill `feature-flag-implementation` + skill `audit-logging`

## Depends on
`22-validate-feature-flags-schema.md`

## Goal
Implement gateway-side feature-flag evaluation with caching, an Express middleware to gate routes, mutation endpoints, and full audit trail.

## Single source of truth
`ARCHITECTURE.md` section 10.

## Reference
`/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/utils/feature-flags.ts`

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/`

## Task

### 1. Repository
- `shared/database/repositories/feature-flag-repository.ts` (raw SQL): list flags, get by key, list org overrides, upsert override, delete override, list all org overrides for an org.

### 2. Gateway util
- `gateway/src/utils/feature-flags.ts`:
  ```ts
  type CacheEntry = { value: boolean; expiresAt: number };
  const cache = new Map<string, CacheEntry>();
  const TTL_MS = 60_000;

  export async function isFlagEnabled(orgId: string, key: PlatformFeatureKey): Promise<boolean>;
  export function invalidateFlag(orgId: string, key: PlatformFeatureKey): void;
  export function invalidateOrg(orgId: string): void;
  ```
  - Fetches `(orgId, key)` from DB (override if present, else default_enabled).
  - 60s TTL cache keyed by `${orgId}:${key}`.
  - Cache invalidation called on every mutation.

### 3. Middleware
- `gateway/src/middleware/require-flag.ts`:
  ```ts
  export function requireFlag(key: PlatformFeatureKey) {
    return async (req, res, next) => {
      const orgId = req.user.organizationId;
      if (!(await isFlagEnabled(orgId, key))) {
        return res.status(403).json({ error: { code: 'FEATURE_DISABLED', message: req.t('errors:flags.disabled') } });
      }
      next();
    };
  }
  ```

### 4. Mutation endpoints (superadmin-only — middleware in phase 8, but endpoint shape now)
- `GET /api/admin/feature-flags` — list all flags
- `GET /api/admin/feature-flags/:orgId` — list overrides for an org
- `PUT /api/admin/feature-flags/:orgId/:key` — set override (body: `{ enabled: boolean }`)
- `DELETE /api/admin/feature-flags/:orgId/:key` — clear override
- Every mutation: write a row to `audit_log` with `actor_id`, `action`, `target_org_id`, `flag_key`, `before`, `after`, `created_at`. Invalidate cache.

### 5. User self endpoint
- `GET /api/me/flags` — returns the resolved flag map for the current user's org.

### 6. i18n strings
- Add `errors:flags.disabled`, `errors:flags.unknownKey`, `success:flags.updated` to gateway translations (all 5 languages).

### Files to create/modify
- `shared/database/repositories/feature-flag-repository.ts` — new
- `gateway/src/utils/feature-flags.ts` — new
- `gateway/src/middleware/require-flag.ts` — new
- `gateway/src/api/admin/feature-flags.ts` — new
- `gateway/src/api/me/flags.ts` — new
- `gateway/src/i18n/translations/{en,ar,fr,de,es}/{errors,success}.json` — new keys

### Tests
- Unit: cache hit/miss/eviction; TTL expiry; invalidation on org/flag.
- Unit: unknown-key throws; invalid-key middleware returns 403 with localized message.
- Supertest: GET/PUT/DELETE flag endpoints — happy path + permission denied + unknown key.
- Supertest: `requireFlag` middleware — flag enabled passes through, disabled returns 403 with localized body in fr/ar.
- Supertest: every mutation creates an audit_log row with correct before/after.
- Coverage: 100% for touched files.

### i18n
- Localized error message returned by middleware via `req.t('errors:flags.disabled')`.

### Documentation
- `docs/{en,ar,fr,de,es}/feature-flags/backend.md` — usage guide for `isFlagEnabled`, `requireFlag`, the cache, the audit trail.

### Acceptance criteria
- [ ] Cache works (hit/miss/TTL/invalidation).
- [ ] Middleware correctly gates and localizes.
- [ ] Audit log row on every mutation.
- [ ] All endpoints covered by Supertest in 5 languages where applicable.
- [ ] 100% coverage for touched files.
- [ ] No untouchable path changes.
