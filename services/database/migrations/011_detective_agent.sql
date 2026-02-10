-- Migration: 011_detective_agent.sql
-- Description: Creates tables for Detective Agent (failure analysis)
-- Phase 4 of QA Loop implementation

-- Root cause analysis records
CREATE TABLE qa_loop_root_cause_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    
    -- Failure reference
    failure_id UUID,  -- Reference to qa_loop_test_runs or qa_loop_bugs
    failure_type VARCHAR(50) NOT NULL,  -- 'test_failure', 'bug', 'chaos_finding'
    failure_source VARCHAR(50),  -- 'retest', 'exploration', 'chaos'
    
    -- Classification
    category VARCHAR(50) NOT NULL,  -- 'bug', 'flaky', 'environment', 'test_issue', 'data_issue'
    sub_category VARCHAR(50),  -- More specific classification
    confidence DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
    
    -- Root cause analysis
    root_cause TEXT NOT NULL,
    hypothesis TEXT,
    explanation TEXT,
    
    -- Code location (if identifiable)
    suspected_file TEXT,
    suspected_line INTEGER,
    suspected_function TEXT,
    related_code TEXT,
    
    -- Evidence collected
    console_errors JSONB DEFAULT '[]',
    network_issues JSONB DEFAULT '[]',
    timing_analysis JSONB DEFAULT '{}',
    dom_state JSONB DEFAULT '{}',
    screenshots JSONB DEFAULT '[]',
    
    -- Reproduction
    minimal_steps JSONB DEFAULT '[]',
    original_steps_count INTEGER,
    minimal_steps_count INTEGER,
    environment_factors JSONB DEFAULT '[]',
    preconditions JSONB DEFAULT '[]',
    
    -- Recommendations
    fix_suggestion TEXT,
    prevention_suggestion TEXT,
    test_improvement TEXT,
    
    -- Status
    verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(50),  -- 'human', 'retest', 'auto'
    verification_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Failure correlations (grouping related failures)
CREATE TABLE qa_loop_failure_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    
    -- Correlated failures
    failure_ids JSONB NOT NULL DEFAULT '[]',  -- Array of failure IDs
    analysis_ids JSONB DEFAULT '[]',  -- Array of root cause analysis IDs
    
    -- Correlation details
    correlation_type VARCHAR(50) NOT NULL,  -- 'same_root_cause', 'same_component', 'same_timing', 'cascading'
    shared_root_cause TEXT,
    shared_component TEXT,
    pattern_description TEXT,
    
    -- Statistics
    failure_count INTEGER DEFAULT 0,
    first_occurrence TIMESTAMP,
    last_occurrence TIMESTAMP,
    occurrence_rate DECIMAL(5,2),  -- Failures per hour
    
    -- Confidence
    confidence DECIMAL(3,2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test stability tracking (flaky test detection)
CREATE TABLE qa_loop_test_stability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES qa_loop_test_cases(id) ON DELETE CASCADE,
    
    -- Run history
    total_runs INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    
    -- Stability metrics
    pass_rate DECIMAL(5,2),  -- Percentage
    is_flaky BOOLEAN DEFAULT false,
    flaky_confidence DECIMAL(3,2),
    flaky_pattern VARCHAR(50),  -- 'random', 'time_dependent', 'order_dependent', 'resource_dependent'
    
    -- Timing patterns
    avg_duration_ms INTEGER,
    min_duration_ms INTEGER,
    max_duration_ms INTEGER,
    duration_variance DECIMAL(10,2),
    
    -- Failure patterns
    common_failure_reasons JSONB DEFAULT '[]',
    failure_time_patterns JSONB DEFAULT '{}',  -- Time of day, day of week patterns
    
    -- Recommendations
    stability_recommendation TEXT,
    
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Failure timeline (for pattern detection)
CREATE TABLE qa_loop_failure_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    
    -- Failure info
    failure_id UUID NOT NULL,
    failure_type VARCHAR(50) NOT NULL,
    test_case_id UUID REFERENCES qa_loop_test_cases(id) ON DELETE SET NULL,
    
    -- Timing
    occurred_at TIMESTAMP NOT NULL,
    iteration_number INTEGER,
    
    -- Context
    page_url TEXT,
    error_type VARCHAR(100),
    error_message TEXT,
    
    -- Environment snapshot
    browser_state JSONB DEFAULT '{}',
    memory_usage INTEGER,
    cpu_load DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_rca_session ON qa_loop_root_cause_analysis(session_id);
CREATE INDEX idx_rca_failure ON qa_loop_root_cause_analysis(failure_id);
CREATE INDEX idx_rca_category ON qa_loop_root_cause_analysis(category);
CREATE INDEX idx_rca_confidence ON qa_loop_root_cause_analysis(confidence DESC);

CREATE INDEX idx_correlations_session ON qa_loop_failure_correlations(session_id);
CREATE INDEX idx_correlations_type ON qa_loop_failure_correlations(correlation_type);

CREATE INDEX idx_stability_session ON qa_loop_test_stability(session_id);
CREATE INDEX idx_stability_test ON qa_loop_test_stability(test_case_id);
CREATE INDEX idx_stability_flaky ON qa_loop_test_stability(is_flaky);

CREATE INDEX idx_timeline_session ON qa_loop_failure_timeline(session_id);
CREATE INDEX idx_timeline_occurred ON qa_loop_failure_timeline(occurred_at);
CREATE INDEX idx_timeline_test ON qa_loop_failure_timeline(test_case_id);

-- Triggers
CREATE TRIGGER qa_loop_rca_updated_at
    BEFORE UPDATE ON qa_loop_root_cause_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();

CREATE TRIGGER qa_loop_stability_updated_at
    BEFORE UPDATE ON qa_loop_test_stability
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();
