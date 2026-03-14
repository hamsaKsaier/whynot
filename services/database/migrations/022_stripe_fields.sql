-- Migration: 022_stripe_fields.sql
-- Description: Adds Stripe customer ID to workspaces and creates invoices table

-- ─── Stripe Customer ID on Workspaces ────────────────────────────────────────

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_customer
  ON workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ─── Invoices ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  stripe_charge_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'usd',
  status VARCHAR(30) DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  paid_at TIMESTAMP,
  invoice_url TEXT,
  invoice_pdf TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
