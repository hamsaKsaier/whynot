-- Multi-Agent QA System: session plans, agent board, and agent_source tracking
-- Part of the multi-agent v2 architecture

-- ============================================================
-- LAYER 2: Session Plan (created by QA Lead, read by all agents)
-- ============================================================
CREATE TABLE IF NOT EXISTS qa_session_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    created_by VARCHAR(50) DEFAULT 'qa_lead',

    -- App analysis produced by QA Lead
    app_analysis JSONB NOT NULL DEFAULT '{}',

    -- Task assignments per agent
    objectives JSONB NOT NULL DEFAULT '[]',

    -- Status of the plan
    status VARCHAR(20) DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_plans_session ON qa_session_plans(session_id);

-- ============================================================
-- LAYER 3: Agent Live Board (real-time coordination between agents)
-- ============================================================
CREATE TABLE IF NOT EXISTS qa_agent_board (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    agent_type VARCHAR(50) NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'idle',
    current_task TEXT,
    progress_pct INTEGER DEFAULT 0,

    -- Discoveries shared with other agents
    discoveries JSONB DEFAULT '[]',

    -- Messages to other agents
    messages JSONB DEFAULT '[]',

    -- Metrics
    pages_explored INTEGER DEFAULT 0,
    tests_generated INTEGER DEFAULT 0,
    bugs_found INTEGER DEFAULT 0,
    api_endpoints_tested INTEGER DEFAULT 0,

    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(session_id, agent_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_board_session ON qa_agent_board(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_board_status ON qa_agent_board(status);

-- ============================================================
-- LAYER 4: Add agent_source to existing output tables
-- ============================================================
ALTER TABLE qa_loop_test_cases ADD COLUMN IF NOT EXISTS agent_source VARCHAR(50);
ALTER TABLE qa_loop_bugs ADD COLUMN IF NOT EXISTS agent_source VARCHAR(50);
ALTER TABLE qa_loop_pages ADD COLUMN IF NOT EXISTS discovered_by VARCHAR(50);
ALTER TABLE qa_loop_notes ADD COLUMN IF NOT EXISTS agent_source VARCHAR(50);

-- Add scan_mode to sessions to distinguish v1 from v2
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS scan_mode VARCHAR(20) DEFAULT 'v1';

-- Trigger for updated_at on agent_board
CREATE OR REPLACE FUNCTION update_agent_board_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_board_updated ON qa_agent_board;
CREATE TRIGGER trg_agent_board_updated
    BEFORE UPDATE ON qa_agent_board
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_board_timestamp();
