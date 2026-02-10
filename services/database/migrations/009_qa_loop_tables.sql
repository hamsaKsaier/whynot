-- Migration: 009_qa_loop_tables.sql
-- Description: Creates tables for the QA Loop feature (autonomous exploration and retest)
-- Created: 2024

-- QA Loop sessions - tracks each exploration or retest run
CREATE TABLE qa_loop_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    target_url TEXT NOT NULL,
    mode VARCHAR(20) DEFAULT 'explore',  -- 'explore', 'retest', 'smart_retest'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
    quality_score INTEGER DEFAULT 0,
    quality_threshold INTEGER DEFAULT 80,
    iteration_count INTEGER DEFAULT 0,
    max_iterations INTEGER DEFAULT 100,
    max_duration_hours INTEGER DEFAULT 12,
    config JSONB DEFAULT '{}',
    document_context TEXT,
    error_message TEXT,
    pages_explored INTEGER DEFAULT 0,
    tests_generated INTEGER DEFAULT 0,
    bugs_found INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Explored pages - knowledge graph of discovered pages
CREATE TABLE qa_loop_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    url_pattern TEXT,  -- e.g., '/users/:id' for dynamic pages
    page_type VARCHAR(50),  -- 'form', 'list', 'detail', 'dashboard', 'login', 'error'
    title TEXT,
    html_hash VARCHAR(64),  -- SHA-256 hash for change detection
    screenshot_path TEXT,
    description TEXT,  -- AI-generated description
    discovered_elements JSONB DEFAULT '{}',  -- { links: [], buttons: [], forms: [], inputs: [] }
    is_explored BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 50,  -- Higher = explore first
    explored_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, url)
);

-- Generated test cases from exploration
CREATE TABLE qa_loop_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'functional',  -- 'functional', 'security', 'visual', 'accessibility', 'edge_case'
    priority INTEGER DEFAULT 50,
    risk_level VARCHAR(20) DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
    steps JSONB NOT NULL,  -- Array of test steps
    selectors JSONB DEFAULT '{}',  -- Proven selectors per step
    preconditions JSONB DEFAULT '[]',  -- Setup steps needed
    expected_results JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    source VARCHAR(50) DEFAULT 'exploration',  -- 'exploration', 'chaos', 'user_story', 'manual', 'regression'
    source_page_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_flaky BOOLEAN DEFAULT false,
    flaky_count INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    last_run_status VARCHAR(20),  -- 'passed', 'failed', 'skipped', 'error'
    last_run_at TIMESTAMP,
    last_run_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session notes - Claude's scratchpad for persisting observations
CREATE TABLE qa_loop_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',  -- 'general', 'bug_hint', 'todo', 'observation', 'blocked'
    iteration_number INTEGER,
    page_url TEXT,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bug findings - issues discovered during exploration
CREATE TABLE qa_loop_bugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
    category VARCHAR(50),  -- 'validation', 'security', 'ui', 'functionality', 'performance', 'accessibility'
    bug_type VARCHAR(50),  -- 'missing_validation', 'xss', 'sql_injection', 'broken_link', 'visual_regression', etc.
    page_url TEXT,
    element_selector TEXT,
    reproduction_steps JSONB DEFAULT '[]',
    evidence_screenshots JSONB DEFAULT '[]',  -- Array of screenshot paths
    console_errors JSONB DEFAULT '[]',
    network_errors JSONB DEFAULT '[]',
    root_cause TEXT,
    suggested_fix TEXT,
    code_location TEXT,  -- Suspected file/line if identifiable
    status VARCHAR(20) DEFAULT 'open',  -- 'open', 'confirmed', 'fixed', 'wont_fix', 'duplicate', 'false_positive'
    regression_test_id UUID REFERENCES qa_loop_test_cases(id) ON DELETE SET NULL,
    duplicate_of_id UUID REFERENCES qa_loop_bugs(id) ON DELETE SET NULL,
    fixed_at TIMESTAMP,
    verified_at TIMESTAMP,
    iteration_found INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test runs - execution history for retest mode
CREATE TABLE qa_loop_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES qa_loop_test_cases(id) ON DELETE CASCADE,
    run_number INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'running', 'passed', 'failed', 'skipped', 'error'
    duration_ms INTEGER,
    steps_total INTEGER DEFAULT 0,
    steps_completed INTEGER DEFAULT 0,
    failure_step_index INTEGER,
    failure_reason TEXT,
    failure_type VARCHAR(50),  -- 'selector', 'timeout', 'assertion', 'network', 'script_error'
    screenshots JSONB DEFAULT '[]',
    console_logs TEXT,
    network_logs JSONB DEFAULT '[]',
    self_healed BOOLEAN DEFAULT false,
    healed_selectors JSONB DEFAULT '[]',  -- Selectors that were auto-recovered
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Retest summaries - aggregated results per retest session
CREATE TABLE qa_loop_retest_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    retest_mode VARCHAR(20) NOT NULL,  -- 'quick', 'smart', 'full'
    total_tests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    self_healed INTEGER DEFAULT 0,
    new_bugs_found INTEGER DEFAULT 0,
    regressions_detected INTEGER DEFAULT 0,
    pages_changed INTEGER DEFAULT 0,
    pages_new INTEGER DEFAULT 0,
    duration_ms INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Iteration logs - track each loop iteration for debugging
CREATE TABLE qa_loop_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    focus_area VARCHAR(50),  -- 'exploration', 'testing', 'chaos', 'analysis'
    pages_explored INTEGER DEFAULT 0,
    tests_generated INTEGER DEFAULT 0,
    bugs_found INTEGER DEFAULT 0,
    tool_calls INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 4) DEFAULT 0,
    duration_ms INTEGER,
    completion_reason VARCHAR(50),  -- 'natural', 'max_tokens', 'error', 'user_stop'
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query performance
CREATE INDEX idx_qa_loop_sessions_project ON qa_loop_sessions(project_id);
CREATE INDEX idx_qa_loop_sessions_status ON qa_loop_sessions(status);
CREATE INDEX idx_qa_loop_sessions_created ON qa_loop_sessions(created_at DESC);

CREATE INDEX idx_qa_loop_pages_session ON qa_loop_pages(session_id);
CREATE INDEX idx_qa_loop_pages_project ON qa_loop_pages(project_id);
CREATE INDEX idx_qa_loop_pages_explored ON qa_loop_pages(session_id, is_explored);
CREATE INDEX idx_qa_loop_pages_url ON qa_loop_pages(url);

CREATE INDEX idx_qa_loop_test_cases_session ON qa_loop_test_cases(session_id);
CREATE INDEX idx_qa_loop_test_cases_project ON qa_loop_test_cases(project_id);
CREATE INDEX idx_qa_loop_test_cases_active ON qa_loop_test_cases(session_id, is_active);
CREATE INDEX idx_qa_loop_test_cases_category ON qa_loop_test_cases(category);

CREATE INDEX idx_qa_loop_notes_session ON qa_loop_notes(session_id);
CREATE INDEX idx_qa_loop_notes_category ON qa_loop_notes(session_id, category);

CREATE INDEX idx_qa_loop_bugs_session ON qa_loop_bugs(session_id);
CREATE INDEX idx_qa_loop_bugs_project ON qa_loop_bugs(project_id);
CREATE INDEX idx_qa_loop_bugs_status ON qa_loop_bugs(status);
CREATE INDEX idx_qa_loop_bugs_severity ON qa_loop_bugs(severity);

CREATE INDEX idx_qa_loop_test_runs_session ON qa_loop_test_runs(session_id);
CREATE INDEX idx_qa_loop_test_runs_test_case ON qa_loop_test_runs(test_case_id);
CREATE INDEX idx_qa_loop_test_runs_status ON qa_loop_test_runs(status);

CREATE INDEX idx_qa_loop_iterations_session ON qa_loop_iterations(session_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qa_loop_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qa_loop_sessions_updated_at
    BEFORE UPDATE ON qa_loop_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();

CREATE TRIGGER qa_loop_pages_updated_at
    BEFORE UPDATE ON qa_loop_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();

CREATE TRIGGER qa_loop_test_cases_updated_at
    BEFORE UPDATE ON qa_loop_test_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();

CREATE TRIGGER qa_loop_bugs_updated_at
    BEFORE UPDATE ON qa_loop_bugs
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();
