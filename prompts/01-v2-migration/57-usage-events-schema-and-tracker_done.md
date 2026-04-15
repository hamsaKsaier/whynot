# Usage events: schema + tracker + metered hooks

## Agent
`api-designer` (lead) + skill `audit-logging`

## Depends on
`56-validate-user-settings-tabs.md`

## Goal
Introduce the `usage_events` table, a tracker util with batched writes + aggregation helpers, and hook every metered endpoint to record events. PAYG charges (from prompt 37's `BillingService.recordUsageEvent`) consume these rows.

## Single source of truth
`ARCHITECTURE.md` section 11.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/` (new migration requires user coordination)

## Task

### 1. Coordinate migration
- After user approval, create `services/database/migrations/0NN_usage_events.sql`:
  ```sql
  CREATE TABLE usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    credits_charged_cents bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_usage_events_org_created ON usage_events(organization_id, created_at DESC);
  CREATE INDEX idx_usage_events_user_created ON usage_events(user_id, created_at DESC);
  CREATE INDEX idx_usage_events_type_created ON usage_events(event_type, created_at DESC);
  ```

### 2. Repository
- `shared/database/repositories/usage-event-repository.ts` — insertBatch, listByOrg(cursor), listByUser(cursor), aggregateByType(orgId, since), aggregateByDay(orgId, range).

### 3. Tracker util
- `gateway/src/utils/usage-tracker.ts`:
  ```ts
  export type UsageEventInput = {
    organizationId: string;
    userId?: string;
    eventType: string;
    quantity?: number;
    metadata?: Record<string, unknown>;
  };
  export function recordUsageEvent(input: UsageEventInput): void; // enqueues
  ```
  - Buffers in memory with a flush interval (e.g. 5s) OR a max-batch size (e.g. 100).
  - Forwards to `BillingService.recordUsageEvent` for orgs in Managed+PAYG tier so the ledger is debited at the per-event rate.
  - Graceful flush on process exit.

### 4. Hook into metered endpoints
- Identify every metered surface in the gateway (e.g. test run start, AI call, visual diff request, report export). For each, call `recordUsageEvent({ ... })` after a successful operation.
- **Do NOT touch v2.** v2 metering is out of scope; the v2 engine is read-only here. If v2 produces metering data via an existing hook/event the gateway already consumes, wire `recordUsageEvent` at the gateway-side consumer, not inside v2.

### 5. ARCHITECTURE.md
- Update section 11 with the table, the tracker pattern, the hook locations, and the PAYG linkage.

### Files to create/modify
- `services/database/migrations/0NN_usage_events.sql` — new (user-coordinated)
- `shared/database/repositories/usage-event-repository.ts` — new
- `gateway/src/utils/usage-tracker.ts` — new
- `gateway/src/api/**` — hook calls at every metered endpoint
- `ARCHITECTURE.md` — section 11

### Tests
- Unit: batching (insert until batch size, flush on interval, flush on exit signal).
- Unit: aggregation queries return correct totals on seeded fixture.
- Supertest: each metered endpoint produces a `usage_events` row with the expected shape after a successful call.
- Integration: Managed+PAYG tier user runs a metered action → ledger row appended with negative `delta_cents` matching the configured rate.
- Org isolation: org A events do not appear in org B aggregates.
- Coverage: 100% on touched files.

### i18n
- N/A (server-only path).

### Documentation
- `docs/{en,ar,fr,de,es}/usage/architecture.md`

### Acceptance criteria
- [ ] Migration applies.
- [ ] Tracker batches + flushes correctly.
- [ ] Every metered endpoint produces an event.
- [ ] PAYG ledger debited automatically for managed-tier orgs.
- [ ] Org isolation enforced.
- [ ] 100% coverage on touched files.
- [ ] No untouchable path changes.
