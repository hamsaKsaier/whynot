-- Migration: 012_guardian_loop.sql
-- Description: Creates tables for Guardian Agent (quality orchestration)
-- Phase 5 of QA Loop implementation

-- Quality scores over time
CREATE TABLE qa_loop_quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    
    -- Overall score (0-100)
    overall_score INTEGER NOT NULL,
    
    -- Breakdown scores (0-100 each)
    coverage_score INTEGER DEFAULT 0,      -- % of app explored
    stability_score INTEGER DEFAULT 0,     -- % of tests passing consistently
    security_score INTEGER DEFAULT 0,      -- Inverted vulnerability score
    accessibility_score INTEGER DEFAULT 0, -- WCAG compliance
    performance_score INTEGER DEFAULT 0,   -- Load time, responsiveness
    
    -- Raw metrics used for calculation
    metrics JSONB DEFAULT '{}',
    
    -- Risk counts
    critical_risks INTEGER DEFAULT 0,
    high_risks INTEGER DEFAULT 0,
    medium_risks INTEGER DEFAULT 0,
    low_risks INTEGER DEFAULT 0,
    
    -- Trend (compared to previous iteration)
    score_delta INTEGER DEFAULT 0,
    trend VARCHAR(20) DEFAULT 'stable',  -- 'improving', 'stable', 'declining'
    
    -- Guardian decision
    should_continue BOOLEAN DEFAULT true,
    stop_reason VARCHAR(100),
    next_focus VARCHAR(50),  -- 'explore', 'chaos', 'retest', 'investigate', 'complete'
    reasoning TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Iteration plans
CREATE TABLE qa_loop_iteration_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    
    -- Plan details
    focus_area VARCHAR(50) NOT NULL,  -- 'explore', 'chaos', 'retest', 'investigate'
    targets JSONB DEFAULT '[]',  -- Specific URLs, test IDs, or bug IDs to focus on
    
    -- Priority reasoning
    priority_reasoning TEXT,
    risk_assessment TEXT,
    
    -- Estimated effort
    estimated_duration_ms INTEGER,
    estimated_tool_calls INTEGER,
    estimated_tokens INTEGER,
    
    -- Execution tracking
    actual_duration_ms INTEGER,
    actual_tool_calls INTEGER,
    actual_tokens INTEGER,
    
    -- Results
    completed BOOLEAN DEFAULT false,
    success BOOLEAN,
    outcome_summary TEXT,
    
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Budget tracking
CREATE TABLE qa_loop_budget_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    
    -- Token usage
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Cost estimates (in USD cents)
    estimated_cost_cents INTEGER DEFAULT 0,
    
    -- By model
    haiku_tokens INTEGER DEFAULT 0,
    sonnet_tokens INTEGER DEFAULT 0,
    opus_tokens INTEGER DEFAULT 0,
    
    -- By phase
    exploration_tokens INTEGER DEFAULT 0,
    chaos_tokens INTEGER DEFAULT 0,
    detective_tokens INTEGER DEFAULT 0,
    guardian_tokens INTEGER DEFAULT 0,
    retest_tokens INTEGER DEFAULT 0,
    
    -- Limits
    max_tokens INTEGER,
    max_cost_cents INTEGER,
    
    -- Status
    budget_exceeded BOOLEAN DEFAULT false,
    warning_threshold_reached BOOLEAN DEFAULT false,
    
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QA Reports (final output)
CREATE TABLE qa_loop_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    
    -- Report metadata
    report_type VARCHAR(50) DEFAULT 'final',  -- 'interim', 'final', 'summary'
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Summary stats
    total_iterations INTEGER,
    total_duration_ms INTEGER,
    final_quality_score INTEGER,
    
    -- Coverage summary
    pages_explored INTEGER DEFAULT 0,
    pages_total_discovered INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2),
    
    -- Test summary
    tests_generated INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    tests_flaky INTEGER DEFAULT 0,
    test_pass_rate DECIMAL(5,2),
    
    -- Bug summary
    bugs_found INTEGER DEFAULT 0,
    bugs_critical INTEGER DEFAULT 0,
    bugs_high INTEGER DEFAULT 0,
    bugs_medium INTEGER DEFAULT 0,
    bugs_low INTEGER DEFAULT 0,
    
    -- Security summary
    vulnerabilities_found INTEGER DEFAULT 0,
    security_score INTEGER,
    security_issues JSONB DEFAULT '[]',
    
    -- Accessibility summary
    a11y_issues_found INTEGER DEFAULT 0,
    a11y_score INTEGER,
    wcag_compliance JSONB DEFAULT '{}',
    
    -- Recommendations
    recommendations JSONB DEFAULT '[]',
    risk_assessment TEXT,
    next_steps TEXT,
    
    -- Full report content
    executive_summary TEXT,
    detailed_findings JSONB DEFAULT '{}',
    appendix JSONB DEFAULT '{}',
    
    -- Export formats
    markdown_report TEXT,
    json_report JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guardian decisions log
CREATE TABLE qa_loop_guardian_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    
    -- Decision
    decision_type VARCHAR(50) NOT NULL,  -- 'continue', 'pause', 'stop', 'escalate', 'focus_change'
    decision_value VARCHAR(100),
    
    -- Context
    quality_score_at_decision INTEGER,
    reasoning TEXT,
    
    -- Factors considered
    factors JSONB DEFAULT '{}',
    
    -- Outcome tracking
    was_correct BOOLEAN,  -- For learning/tuning
    feedback TEXT,
    
    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_quality_scores_session ON qa_loop_quality_scores(session_id);
CREATE INDEX idx_quality_scores_iteration ON qa_loop_quality_scores(session_id, iteration_number);
CREATE INDEX idx_quality_scores_overall ON qa_loop_quality_scores(overall_score DESC);

CREATE INDEX idx_iteration_plans_session ON qa_loop_iteration_plans(session_id);
CREATE INDEX idx_iteration_plans_iteration ON qa_loop_iteration_plans(session_id, iteration_number);
CREATE INDEX idx_iteration_plans_focus ON qa_loop_iteration_plans(focus_area);

CREATE INDEX idx_budget_session ON qa_loop_budget_tracking(session_id);

CREATE INDEX idx_reports_session ON qa_loop_reports(session_id);
CREATE INDEX idx_reports_type ON qa_loop_reports(report_type);

CREATE INDEX idx_decisions_session ON qa_loop_guardian_decisions(session_id);
CREATE INDEX idx_decisions_iteration ON qa_loop_guardian_decisions(session_id, iteration_number);
CREATE INDEX idx_decisions_type ON qa_loop_guardian_decisions(decision_type);
