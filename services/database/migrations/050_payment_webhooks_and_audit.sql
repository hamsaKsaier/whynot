-- Migration 050: Payment webhooks idempotency + audit log
-- Both tables are referenced by gateway payment code but never migrated.
-- Referenced by:
--   gateway/src/api/webhooks/stripe.ts      (payment_webhooks_idempotency)
--   gateway/src/payments/audit-logger.ts    (payment_audit_log)

BEGIN;

-- ─── payment_webhooks_idempotency ───────────────────────────────────
-- Dedupes Stripe webhook deliveries. Without this table every inbound
-- Stripe event causes the webhook handler to return HTTP 500 and
-- PaymentService.handleWebhook is never invoked.
CREATE TABLE IF NOT EXISTS payment_webhooks_idempotency (
  event_id    VARCHAR(255) PRIMARY KEY,
  received_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  handled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhooks_idempotency_received_at
  ON payment_webhooks_idempotency (received_at DESC);

-- ─── payment_audit_log ───────────────────────────────────────────────
-- Immutable audit trail for every payment operation.
-- Column list matches the INSERT in audit-logger.ts (14 columns).
CREATE TABLE IF NOT EXISTS payment_audit_log (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  operation        VARCHAR(100) NOT NULL,
  provider         VARCHAR(50)  NOT NULL,
  status           VARCHAR(20)  NOT NULL,
  duration_ms      INTEGER      NOT NULL DEFAULT 0,
  user_id          UUID,
  organization_id  UUID,
  idempotency_key  VARCHAR(255),
  amount_cents     BIGINT,
  currency         VARCHAR(10),
  error_message    TEXT,
  error_code       VARCHAR(100),
  retry_attempts   INTEGER      NOT NULL DEFAULT 0,
  provider_refs    JSONB,
  metadata         JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_org_created
  ON payment_audit_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_audit_operation
  ON payment_audit_log (operation, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_audit_idempotency
  ON payment_audit_log (idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMIT;
