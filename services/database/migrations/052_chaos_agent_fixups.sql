-- Migration 052: Chaos agent rescue / idempotent rebuild
--
-- Context: migration 010_chaos_agent.sql contains three SQL bugs:
--
--   1. Unparenthesised `::jsonb` cast at line 41
--      `'["a", "' || repeat('a', 1000) || '"]'::jsonb`
--      Postgres operator precedence binds `::` tighter than `||`, so this
--      is parsed as `text || text || (literal::jsonb)` — the mixed
--      `text || jsonb` concatenation has no operator and the statement
--      aborts.
--
--   2. Literal `\u0000` in a JSON seed (line 53)
--      `"unicode_special"` seed array included `"\u0000"` which jsonb
--      rejects because Postgres does not permit NUL codepoints inside
--      jsonb string values (an intentional limitation — see
--      https://www.postgresql.org/docs/current/datatype-json.html).
--
--   3. Unbalanced quotes / brackets on LDAP payload (line 68)
--      The seed payload `"x])(|(cn=*"])"` has an extra `]` that closes
--      the JSON array prematurely and then produces stray text.
--
-- When the 3 INSERTs hit these errors, psql (run by services/database/
-- migrate.sh with `ON_ERROR_STOP=1`) aborts the migration. Fresh deploys
-- that hit this end up with partial / missing chaos tables.
--
-- DevOps worked around the bugs on v2-demo and v3-sandbox by running the
-- DDL portion of 010 manually and marking `schema_migrations` row for 010
-- as applied. Existing production presumably has the same hot-patch
-- history.
--
-- This migration:
--   (a) Re-declares every chaos table + index + trigger with `IF NOT
--       EXISTS` guards so the state is consistent on any deploy path —
--       clean DB, manual-patch DB, or partially-migrated DB.
--   (b) Does NOT re-run the broken seed INSERTs. Chaos agent is v1-only
--       (v2 multi-agent replaced it with SecurityTesterAgent), so the
--       seed data is not required for v3 functionality. Per brief:
--       "If the seed data isn't demo-critical for v3 (chaos agent is
--       v1-only), you can ship DDL-only and leave seeds empty."
--
-- PO directive: do NOT edit migration 010 directly — it's already
-- recorded as applied in production's schema_migrations table. Only
-- forward migrations are allowed.

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_loop_chaos_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    payloads JSONB NOT NULL DEFAULT '[]',
    applies_to VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'high',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_chaos_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    pattern_id UUID REFERENCES qa_loop_chaos_patterns(id) ON DELETE SET NULL,
    page_url TEXT NOT NULL,
    element_selector TEXT,
    element_type VARCHAR(50),
    attack_category VARCHAR(50) NOT NULL,
    attack_name VARCHAR(100) NOT NULL,
    payload_used TEXT,
    result VARCHAR(20) NOT NULL,
    vulnerability_confirmed BOOLEAN DEFAULT false,
    evidence_screenshot TEXT,
    console_output TEXT,
    network_response JSONB,
    dom_changes JSONB,
    error_message TEXT,
    severity VARCHAR(20),
    confidence DECIMAL(3,2),
    false_positive_likelihood DECIMAL(3,2),
    reproduction_steps JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_chaos_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    total_attacks INTEGER DEFAULT 0,
    vulnerabilities_found INTEGER DEFAULT 0,
    blocked_attacks INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    high_findings INTEGER DEFAULT 0,
    medium_findings INTEGER DEFAULT 0,
    low_findings INTEGER DEFAULT 0,
    injection_findings INTEGER DEFAULT 0,
    xss_findings INTEGER DEFAULT 0,
    boundary_findings INTEGER DEFAULT 0,
    timing_findings INTEGER DEFAULT 0,
    security_findings INTEGER DEFAULT 0,
    a11y_findings INTEGER DEFAULT 0,
    pages_tested INTEGER DEFAULT 0,
    inputs_tested INTEGER DEFAULT 0,
    forms_tested INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chaos_patterns_category ON qa_loop_chaos_patterns(category);
CREATE INDEX IF NOT EXISTS idx_chaos_patterns_session  ON qa_loop_chaos_patterns(session_id);
CREATE INDEX IF NOT EXISTS idx_chaos_results_session   ON qa_loop_chaos_results(session_id);
CREATE INDEX IF NOT EXISTS idx_chaos_results_page      ON qa_loop_chaos_results(page_url);
CREATE INDEX IF NOT EXISTS idx_chaos_results_result    ON qa_loop_chaos_results(result);
CREATE INDEX IF NOT EXISTS idx_chaos_results_severity  ON qa_loop_chaos_results(severity);
CREATE INDEX IF NOT EXISTS idx_chaos_summaries_session ON qa_loop_chaos_summaries(session_id);

-- ── Trigger ───────────────────────────────────────────────────────────────
-- Recreate idempotently: DROP then CREATE. The DROP is safe even if the
-- trigger never existed (IF EXISTS guard). The underlying function
-- `update_qa_loop_updated_at()` is defined in migration 009.

DROP TRIGGER IF EXISTS qa_loop_chaos_summaries_updated_at ON qa_loop_chaos_summaries;
CREATE TRIGGER qa_loop_chaos_summaries_updated_at
    BEFORE UPDATE ON qa_loop_chaos_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();
