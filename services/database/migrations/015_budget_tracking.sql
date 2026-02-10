-- Migration: 015_budget_tracking.sql
-- Phase 8: Real Budget and Cost Tracking
-- Comprehensive cost tracking for API usage

-- Add cost tracking columns to sessions
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS total_cost_cents DECIMAL(10,4) DEFAULT 0;
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS budget_limit_cents INTEGER;
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS cost_by_phase JSONB DEFAULT '{}';
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS cost_by_model JSONB DEFAULT '{}';
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS total_input_tokens INTEGER DEFAULT 0;
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS total_output_tokens INTEGER DEFAULT 0;

-- Add cost tracking columns to iterations (in case 013 didn't fully cover it)
-- These are idempotent (IF NOT EXISTS)
ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0;
ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0;
ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS model_used VARCHAR(50);
ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS cost_cents DECIMAL(10,4) DEFAULT 0;

-- Create budget alerts table for tracking when alerts were triggered
CREATE TABLE IF NOT EXISTS qa_loop_budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    alert_level VARCHAR(20) NOT NULL,
    percentage_used INTEGER NOT NULL,
    total_cost_cents DECIMAL(10,4) NOT NULL,
    budget_limit_cents INTEGER,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for budget alert lookups
CREATE INDEX IF NOT EXISTS idx_qa_loop_budget_alerts_session ON qa_loop_budget_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_loop_budget_alerts_level ON qa_loop_budget_alerts(alert_level);

-- Create function to update session cost totals
CREATE OR REPLACE FUNCTION update_session_costs()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total costs on session when iteration completes
    UPDATE qa_loop_sessions SET
        total_cost_cents = total_cost_cents + COALESCE(NEW.cost_cents, 0),
        total_input_tokens = total_input_tokens + COALESCE(NEW.input_tokens, 0),
        total_output_tokens = total_output_tokens + COALESCE(NEW.output_tokens, 0)
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update session costs
DROP TRIGGER IF EXISTS trigger_update_session_costs ON qa_loop_iterations;
CREATE TRIGGER trigger_update_session_costs
    AFTER INSERT ON qa_loop_iterations
    FOR EACH ROW
    EXECUTE FUNCTION update_session_costs();

-- Create view for cost analytics
CREATE OR REPLACE VIEW qa_loop_cost_analytics AS
SELECT 
    s.id as session_id,
    s.target_url,
    s.status,
    s.total_cost_cents,
    s.budget_limit_cents,
    CASE 
        WHEN s.budget_limit_cents > 0 THEN 
            ROUND((s.total_cost_cents / s.budget_limit_cents) * 100, 2)
        ELSE 0
    END as budget_usage_percentage,
    s.total_input_tokens,
    s.total_output_tokens,
    s.total_input_tokens + s.total_output_tokens as total_tokens,
    s.iteration_count,
    CASE 
        WHEN s.iteration_count > 0 THEN 
            ROUND(s.total_cost_cents / s.iteration_count, 4)
        ELSE 0
    END as avg_cost_per_iteration,
    s.cost_by_phase,
    s.cost_by_model,
    s.created_at,
    s.completed_at
FROM qa_loop_sessions s;

-- Add comments for documentation
COMMENT ON TABLE qa_loop_budget_alerts IS 'Tracks budget alert events for monitoring and auditing';
COMMENT ON COLUMN qa_loop_sessions.total_cost_cents IS 'Total cost in cents for all API calls in this session';
COMMENT ON COLUMN qa_loop_sessions.budget_limit_cents IS 'Maximum allowed cost in cents (null = no limit)';
COMMENT ON COLUMN qa_loop_sessions.cost_by_phase IS 'JSON breakdown of costs by phase (exploration, chaos, etc.)';
COMMENT ON COLUMN qa_loop_sessions.cost_by_model IS 'JSON breakdown of costs by Claude model';
