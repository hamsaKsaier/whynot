# Payments: schema migration

## Agent
`api-designer` (lead) + skill `audit-logging`

## Depends on
`30-validate-user-ai-config-and-ai-tab.md`

## Goal
Add the database schema for the new payment system (subscriptions, transactions, billing config, PAYG ledger, webhook idempotency). All money is bigint cents.

## Single source of truth
`ARCHITECTURE.md` section 9.

## Untouchable paths (reminder)
- `services/qa-loop-executor/src/v2/`, `services/qa-loop-executor/src/mcp-browser.ts`, `services/database/migrations/` (new migration requires user coordination)

## Task

### 1. Coordinate with user on ordinal
- Ask the user for the next migration ordinal before writing any SQL file.

### 2. Migration content
- `services/database/migrations/0NN_payments.sql`:
  ```sql
  CREATE TABLE billing_config (
    key text PRIMARY KEY,
    trial_days integer NOT NULL DEFAULT 14,
    currency text NOT NULL DEFAULT 'usd',
    payg_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_subscription_id text UNIQUE,
    plan text NOT NULL,
    tier text NOT NULL CHECK (tier IN ('byo_keys','managed_payg')),
    status text NOT NULL,
    trial_ends_at timestamptz,
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);

  CREATE TABLE payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_payment_intent_id text UNIQUE,
    amount_cents bigint NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    description text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_payment_tx_org ON payment_transactions(organization_id);

  CREATE TABLE billing_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type text NOT NULL,
    amount_cents bigint NOT NULL,
    currency text NOT NULL,
    description text,
    invoice_url text,
    occurred_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_billing_history_org ON billing_history(organization_id);

  CREATE TABLE payg_credits_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    delta_cents bigint NOT NULL,
    reason text NOT NULL,
    related_event_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_payg_ledger_org ON payg_credits_ledger(organization_id);

  CREATE TABLE payment_webhooks_idempotency (
    event_id text PRIMARY KEY,
    received_at timestamptz NOT NULL DEFAULT now(),
    handled_at timestamptz
  );
  ```

### 3. Seed `billing_config`
- One row, `key='default'`, with `trial_days=14`, `currency='usd'`, and a starter `payg_rates` JSON: `{ "ai_call_cents": 2, "test_run_cents": 5, "visual_diff_cents": 1 }`.

### 4. ARCHITECTURE.md
- Update section 9 with table list, money convention (bigint cents), tier model (`byo_keys` vs `managed_payg`), trial model (configurable via `billing_config`).

### Files to create/modify
- `services/database/migrations/0NN_payments.sql` — new (after user-confirmed ordinal)
- `shared/database/seeds/billing-config.ts` — new
- `ARCHITECTURE.md` — section 9 updated

### Tests
- Migration apply test: introspect `pg_tables`; assert all tables and that money columns are `bigint`, not `numeric` or `integer`.
- Seed idempotency test.

### i18n
- N/A for this prompt (schema only).

### Documentation
- `docs/{en,ar,fr,de,es}/payments/schema.md` — explains the table layout, the bigint-cents rule, the tier model.

### Acceptance criteria
- [ ] User confirmed migration ordinal before file write.
- [ ] Migration applies cleanly.
- [ ] All money columns are bigint.
- [ ] Seed populates `billing_config` idempotently.
- [ ] `ARCHITECTURE.md` section 9 updated.
