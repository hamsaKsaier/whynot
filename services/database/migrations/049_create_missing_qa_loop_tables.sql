-- Migration: 049_create_missing_qa_loop_tables.sql
-- Purpose: Re-create tables and columns from migrations 010, 011, 012, 014, 015, 016
-- that never made it into the database (the migration records exist in
-- schema_migrations, but the objects were absent). This migration is fully
-- idempotent and safe to re-run.

-- ============================================================================
-- From 010_chaos_agent.sql
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_chaos_results_session ON qa_loop_chaos_results(session_id);
CREATE INDEX IF NOT EXISTS idx_chaos_results_page ON qa_loop_chaos_results(page_url);
CREATE INDEX IF NOT EXISTS idx_chaos_results_result ON qa_loop_chaos_results(result);
CREATE INDEX IF NOT EXISTS idx_chaos_results_severity ON qa_loop_chaos_results(severity);
CREATE INDEX IF NOT EXISTS idx_chaos_summaries_session ON qa_loop_chaos_summaries(session_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_loop_chaos_summaries_updated_at') THEN
        CREATE TRIGGER qa_loop_chaos_summaries_updated_at
            BEFORE UPDATE ON qa_loop_chaos_summaries
            FOR EACH ROW EXECUTE FUNCTION update_qa_loop_updated_at();
    END IF;
END $$;

-- ============================================================================
-- From 011_detective_agent.sql
-- ============================================================================
CREATE TABLE IF NOT EXISTS qa_loop_root_cause_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    failure_id UUID,
    failure_type VARCHAR(50) NOT NULL,
    failure_source VARCHAR(50),
    category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50),
    confidence DECIMAL(3,2) NOT NULL,
    root_cause TEXT NOT NULL,
    hypothesis TEXT,
    explanation TEXT,
    suspected_file TEXT,
    suspected_line INTEGER,
    suspected_function TEXT,
    related_code TEXT,
    console_errors JSONB DEFAULT '[]',
    network_issues JSONB DEFAULT '[]',
    timing_analysis JSONB DEFAULT '{}',
    dom_state JSONB DEFAULT '{}',
    screenshots JSONB DEFAULT '[]',
    minimal_steps JSONB DEFAULT '[]',
    original_steps_count INTEGER,
    minimal_steps_count INTEGER,
    environment_factors JSONB DEFAULT '[]',
    preconditions JSONB DEFAULT '[]',
    fix_suggestion TEXT,
    prevention_suggestion TEXT,
    test_improvement TEXT,
    verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(50),
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_failure_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    failure_ids JSONB NOT NULL DEFAULT '[]',
    analysis_ids JSONB DEFAULT '[]',
    correlation_type VARCHAR(50) NOT NULL,
    shared_root_cause TEXT,
    shared_component TEXT,
    pattern_description TEXT,
    failure_count INTEGER DEFAULT 0,
    first_occurrence TIMESTAMP,
    last_occurrence TIMESTAMP,
    occurrence_rate DECIMAL(5,2),
    confidence DECIMAL(3,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_test_stability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES qa_loop_test_cases(id) ON DELETE CASCADE,
    total_runs INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    pass_rate DECIMAL(5,2),
    is_flaky BOOLEAN DEFAULT false,
    flaky_confidence DECIMAL(3,2),
    flaky_pattern VARCHAR(50),
    avg_duration_ms INTEGER,
    min_duration_ms INTEGER,
    max_duration_ms INTEGER,
    duration_variance DECIMAL(10,2),
    common_failure_reasons JSONB DEFAULT '[]',
    failure_time_patterns JSONB DEFAULT '{}',
    stability_recommendation TEXT,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_failure_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    failure_id UUID NOT NULL,
    failure_type VARCHAR(50) NOT NULL,
    test_case_id UUID REFERENCES qa_loop_test_cases(id) ON DELETE SET NULL,
    occurred_at TIMESTAMP NOT NULL,
    iteration_number INTEGER,
    page_url TEXT,
    error_type VARCHAR(100),
    error_message TEXT,
    browser_state JSONB DEFAULT '{}',
    memory_usage INTEGER,
    cpu_load DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rca_session ON qa_loop_root_cause_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_rca_failure ON qa_loop_root_cause_analysis(failure_id);
CREATE INDEX IF NOT EXISTS idx_rca_category ON qa_loop_root_cause_analysis(category);
CREATE INDEX IF NOT EXISTS idx_rca_confidence ON qa_loop_root_cause_analysis(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_correlations_session ON qa_loop_failure_correlations(session_id);
CREATE INDEX IF NOT EXISTS idx_correlations_type ON qa_loop_failure_correlations(correlation_type);
CREATE INDEX IF NOT EXISTS idx_stability_session ON qa_loop_test_stability(session_id);
CREATE INDEX IF NOT EXISTS idx_stability_test ON qa_loop_test_stability(test_case_id);
CREATE INDEX IF NOT EXISTS idx_stability_flaky ON qa_loop_test_stability(is_flaky);
CREATE INDEX IF NOT EXISTS idx_timeline_session ON qa_loop_failure_timeline(session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_occurred ON qa_loop_failure_timeline(occurred_at);
CREATE INDEX IF NOT EXISTS idx_timeline_test ON qa_loop_failure_timeline(test_case_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_loop_rca_updated_at') THEN
        CREATE TRIGGER qa_loop_rca_updated_at
            BEFORE UPDATE ON qa_loop_root_cause_analysis
            FOR EACH ROW EXECUTE FUNCTION update_qa_loop_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_loop_stability_updated_at') THEN
        CREATE TRIGGER qa_loop_stability_updated_at
            BEFORE UPDATE ON qa_loop_test_stability
            FOR EACH ROW EXECUTE FUNCTION update_qa_loop_updated_at();
    END IF;
END $$;

-- ============================================================================
-- From 012_guardian_loop.sql
-- ============================================================================
CREATE TABLE IF NOT EXISTS qa_loop_quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    overall_score INTEGER NOT NULL,
    coverage_score INTEGER DEFAULT 0,
    stability_score INTEGER DEFAULT 0,
    security_score INTEGER DEFAULT 0,
    accessibility_score INTEGER DEFAULT 0,
    performance_score INTEGER DEFAULT 0,
    metrics JSONB DEFAULT '{}',
    critical_risks INTEGER DEFAULT 0,
    high_risks INTEGER DEFAULT 0,
    medium_risks INTEGER DEFAULT 0,
    low_risks INTEGER DEFAULT 0,
    score_delta INTEGER DEFAULT 0,
    trend VARCHAR(20) DEFAULT 'stable',
    should_continue BOOLEAN DEFAULT true,
    stop_reason VARCHAR(100),
    next_focus VARCHAR(50),
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_iteration_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    focus_area VARCHAR(50) NOT NULL,
    targets JSONB DEFAULT '[]',
    priority_reasoning TEXT,
    risk_assessment TEXT,
    estimated_duration_ms INTEGER,
    estimated_tool_calls INTEGER,
    estimated_tokens INTEGER,
    actual_duration_ms INTEGER,
    actual_tool_calls INTEGER,
    actual_tokens INTEGER,
    completed BOOLEAN DEFAULT false,
    success BOOLEAN,
    outcome_summary TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_budget_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost_cents INTEGER DEFAULT 0,
    haiku_tokens INTEGER DEFAULT 0,
    sonnet_tokens INTEGER DEFAULT 0,
    opus_tokens INTEGER DEFAULT 0,
    exploration_tokens INTEGER DEFAULT 0,
    chaos_tokens INTEGER DEFAULT 0,
    detective_tokens INTEGER DEFAULT 0,
    guardian_tokens INTEGER DEFAULT 0,
    retest_tokens INTEGER DEFAULT 0,
    max_tokens INTEGER,
    max_cost_cents INTEGER,
    budget_exceeded BOOLEAN DEFAULT false,
    warning_threshold_reached BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    report_type VARCHAR(50) DEFAULT 'final',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_iterations INTEGER,
    total_duration_ms INTEGER,
    final_quality_score INTEGER,
    pages_explored INTEGER DEFAULT 0,
    pages_total_discovered INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2),
    tests_generated INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    tests_flaky INTEGER DEFAULT 0,
    test_pass_rate DECIMAL(5,2),
    bugs_found INTEGER DEFAULT 0,
    bugs_critical INTEGER DEFAULT 0,
    bugs_high INTEGER DEFAULT 0,
    bugs_medium INTEGER DEFAULT 0,
    bugs_low INTEGER DEFAULT 0,
    vulnerabilities_found INTEGER DEFAULT 0,
    security_score INTEGER,
    security_issues JSONB DEFAULT '[]',
    a11y_issues_found INTEGER DEFAULT 0,
    a11y_score INTEGER,
    wcag_compliance JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    risk_assessment TEXT,
    next_steps TEXT,
    executive_summary TEXT,
    detailed_findings JSONB DEFAULT '{}',
    appendix JSONB DEFAULT '{}',
    markdown_report TEXT,
    json_report JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_guardian_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    decision_type VARCHAR(50) NOT NULL,
    decision_value VARCHAR(100),
    quality_score_at_decision INTEGER,
    reasoning TEXT,
    factors JSONB DEFAULT '{}',
    was_correct BOOLEAN,
    feedback TEXT,
    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_scores_session ON qa_loop_quality_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_quality_scores_iteration ON qa_loop_quality_scores(session_id, iteration_number);
CREATE INDEX IF NOT EXISTS idx_quality_scores_overall ON qa_loop_quality_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_iteration_plans_session ON qa_loop_iteration_plans(session_id);
CREATE INDEX IF NOT EXISTS idx_iteration_plans_iteration ON qa_loop_iteration_plans(session_id, iteration_number);
CREATE INDEX IF NOT EXISTS idx_iteration_plans_focus ON qa_loop_iteration_plans(focus_area);
CREATE INDEX IF NOT EXISTS idx_budget_session ON qa_loop_budget_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_session ON qa_loop_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON qa_loop_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_decisions_session ON qa_loop_guardian_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_iteration ON qa_loop_guardian_decisions(session_id, iteration_number);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON qa_loop_guardian_decisions(decision_type);

-- ============================================================================
-- From 014_documents.sql
-- ============================================================================
CREATE TABLE IF NOT EXISTS qa_loop_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    content TEXT,
    summary TEXT,
    chunk_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qa_loop_documents_session ON qa_loop_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_loop_documents_active ON qa_loop_documents(session_id, is_active) WHERE is_active = true;

-- ============================================================================
-- From 015_budget_tracking.sql
-- ============================================================================
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS total_cost_cents DECIMAL(10,4) DEFAULT 0;
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS budget_limit_cents INTEGER;
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS cost_by_phase JSONB DEFAULT '{}';
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS cost_by_model JSONB DEFAULT '{}';
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS total_input_tokens INTEGER DEFAULT 0;
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS total_output_tokens INTEGER DEFAULT 0;

ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0;
ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0;
ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS model_used VARCHAR(50);
ALTER TABLE qa_loop_iterations ADD COLUMN IF NOT EXISTS cost_cents DECIMAL(10,4) DEFAULT 0;

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

CREATE INDEX IF NOT EXISTS idx_qa_loop_budget_alerts_session ON qa_loop_budget_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_loop_budget_alerts_level ON qa_loop_budget_alerts(alert_level);

CREATE OR REPLACE FUNCTION update_session_costs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE qa_loop_sessions SET
        total_cost_cents = total_cost_cents + COALESCE(NEW.cost_cents, 0),
        total_input_tokens = total_input_tokens + COALESCE(NEW.input_tokens, 0),
        total_output_tokens = total_output_tokens + COALESCE(NEW.output_tokens, 0)
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_costs ON qa_loop_iterations;
CREATE TRIGGER trigger_update_session_costs
    AFTER INSERT ON qa_loop_iterations
    FOR EACH ROW EXECUTE FUNCTION update_session_costs();

CREATE OR REPLACE VIEW qa_loop_cost_analytics AS
SELECT
    s.id as session_id,
    s.target_url,
    s.status,
    s.total_cost_cents,
    s.budget_limit_cents,
    CASE WHEN s.budget_limit_cents > 0
        THEN ROUND((s.total_cost_cents / s.budget_limit_cents) * 100, 2)
        ELSE 0
    END as budget_usage_percentage,
    s.total_input_tokens,
    s.total_output_tokens,
    s.total_input_tokens + s.total_output_tokens as total_tokens,
    s.iteration_count,
    CASE WHEN s.iteration_count > 0
        THEN ROUND(s.total_cost_cents / s.iteration_count, 4)
        ELSE 0
    END as avg_cost_per_iteration,
    s.cost_by_phase,
    s.cost_by_model,
    s.created_at,
    s.completed_at
FROM qa_loop_sessions s;

-- ============================================================================
-- From 016_webhooks.sql
-- ============================================================================
CREATE TABLE IF NOT EXISTS qa_loop_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,
    permissions JSONB DEFAULT '["retest", "status"]',
    rate_limit_per_hour INTEGER DEFAULT 100,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES qa_loop_api_keys(id),
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_loop_notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50) DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON qa_loop_webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_api_key ON qa_loop_webhook_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON qa_loop_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON qa_loop_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON qa_loop_notification_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_active ON qa_loop_notification_channels(is_active) WHERE is_active = true;

CREATE OR REPLACE VIEW qa_loop_api_key_usage AS
SELECT
    ak.id,
    ak.name,
    ak.key_prefix,
    ak.permissions,
    ak.rate_limit_per_hour,
    ak.last_used_at,
    ak.expires_at,
    ak.created_at,
    ak.revoked_at,
    COALESCE(stats.request_count, 0) as total_requests,
    COALESCE(stats.success_count, 0) as successful_requests,
    COALESCE(stats.failure_count, 0) as failed_requests,
    COALESCE(stats.avg_duration_ms, 0) as avg_duration_ms
FROM qa_loop_api_keys ak
LEFT JOIN (
    SELECT
        api_key_id,
        COUNT(*) as request_count,
        SUM(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) as failure_count,
        ROUND(AVG(duration_ms)) as avg_duration_ms
    FROM qa_loop_webhook_logs
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY api_key_id
) stats ON ak.id = stats.api_key_id;

CREATE OR REPLACE FUNCTION clean_old_webhook_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM qa_loop_webhook_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
