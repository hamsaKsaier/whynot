-- Migration: 010_chaos_agent.sql
-- Description: Creates tables for Chaos Agent (adversarial/security testing)
-- Phase 3 of QA Loop implementation

-- Chaos attack patterns library
CREATE TABLE qa_loop_chaos_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,  -- 'injection', 'xss', 'boundary', 'timing', 'security', 'a11y'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    payloads JSONB NOT NULL DEFAULT '[]',  -- Array of attack payloads
    applies_to VARCHAR(50) NOT NULL,  -- 'text_input', 'url', 'header', 'form', 'any'
    severity VARCHAR(20) DEFAULT 'high',  -- 'critical', 'high', 'medium', 'low'
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-populate with common attack patterns (global patterns with null session_id)
INSERT INTO qa_loop_chaos_patterns (id, session_id, category, name, description, payloads, applies_to, severity) VALUES
-- SQL Injection
(gen_random_uuid(), NULL, 'injection', 'sql_injection_basic', 'Basic SQL injection payloads', 
 '["'' OR ''1''=''1", "1'' OR ''1''=''1", "'' OR 1=1--", "admin''--", "1; DROP TABLE users--", "'' UNION SELECT * FROM users--"]'::jsonb,
 'text_input', 'critical'),

-- XSS
(gen_random_uuid(), NULL, 'xss', 'xss_script_tags', 'Script tag XSS vectors',
 '["<script>alert(''xss'')</script>", "<script>alert(document.cookie)</script>", "<img src=x onerror=alert(''xss'')>", "<svg onload=alert(''xss'')>", "<body onload=alert(''xss'')>"]'::jsonb,
 'text_input', 'critical'),

(gen_random_uuid(), NULL, 'xss', 'xss_event_handlers', 'Event handler XSS vectors',
 '["<img onerror=alert(1) src=x>", "<div onmouseover=alert(1)>hover</div>", "<input onfocus=alert(1) autofocus>", "<marquee onstart=alert(1)>"]'::jsonb,
 'text_input', 'high'),

-- Boundary testing
(gen_random_uuid(), NULL, 'boundary', 'empty_values', 'Empty and whitespace values',
 '["", " ", "  ", "\t", "\n", "\r\n"]'::jsonb,
 'text_input', 'medium'),

(gen_random_uuid(), NULL, 'boundary', 'extreme_lengths', 'Extreme length values',
 '["a", "' || repeat('a', 1000) || '", "' || repeat('a', 10000) || '"]'::jsonb,
 'text_input', 'medium'),

(gen_random_uuid(), NULL, 'boundary', 'special_characters', 'Special character payloads',
 '["!@#$%^&*()", "<>{}[]|\\", "\"''`~", "../../../../etc/passwd", "..\\..\\..\\windows\\system32", "null", "undefined", "NaN"]'::jsonb,
 'text_input', 'medium'),

(gen_random_uuid(), NULL, 'boundary', 'numeric_boundaries', 'Numeric edge cases',
 '["0", "-1", "-999999999", "999999999", "1.7976931348623157E+10308", "2147483647", "-2147483648", "NaN", "Infinity"]'::jsonb,
 'text_input', 'medium'),

(gen_random_uuid(), NULL, 'boundary', 'unicode_special', 'Unicode and emoji payloads',
 '["🔥💀🎉", "ñ", "你好", "مرحبا", "🏳️‍🌈", "\u0000", "\uFFFF", "​"]'::jsonb,
 'text_input', 'low'),

-- Command injection
(gen_random_uuid(), NULL, 'injection', 'command_injection', 'OS command injection payloads',
 '["; ls -la", "| cat /etc/passwd", "$(whoami)", "`id`", "& dir", "|| ping -c 1 127.0.0.1"]'::jsonb,
 'text_input', 'critical'),

-- Path traversal
(gen_random_uuid(), NULL, 'injection', 'path_traversal', 'Path traversal payloads',
 '["../../../etc/passwd", "..\\..\\..\\windows\\win.ini", "....//....//etc/passwd", "%2e%2e%2f%2e%2e%2f", "..%252f..%252f"]'::jsonb,
 'text_input', 'high'),

-- LDAP injection
(gen_random_uuid(), NULL, 'injection', 'ldap_injection', 'LDAP injection payloads',
 '["*", "*)(&", "*)(uid=*))(|(uid=*", "admin)(&)", "x])(|(cn=*"])"]'::jsonb,
 'text_input', 'high'),

-- Header injection
(gen_random_uuid(), NULL, 'security', 'header_injection', 'HTTP header injection payloads',
 '["value\r\nX-Injected: header", "value%0d%0aX-Injected:%20header", "value\nSet-Cookie: malicious=1"]'::jsonb,
 'header', 'high'),

-- Timing attacks
(gen_random_uuid(), NULL, 'timing', 'race_condition', 'Race condition test markers',
 '["RACE_CONDITION_TEST"]'::jsonb,
 'any', 'medium'),

-- Accessibility
(gen_random_uuid(), NULL, 'a11y', 'keyboard_navigation', 'Keyboard accessibility test',
 '["TAB_NAVIGATION_TEST"]'::jsonb,
 'any', 'medium'),

(gen_random_uuid(), NULL, 'a11y', 'screen_reader', 'Screen reader accessibility test',
 '["ARIA_LABELS_TEST"]'::jsonb,
 'any', 'medium');

-- Chaos test results
CREATE TABLE qa_loop_chaos_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    pattern_id UUID REFERENCES qa_loop_chaos_patterns(id) ON DELETE SET NULL,
    page_url TEXT NOT NULL,
    element_selector TEXT,
    element_type VARCHAR(50),  -- 'input', 'textarea', 'form', 'url', 'header'
    attack_category VARCHAR(50) NOT NULL,
    attack_name VARCHAR(100) NOT NULL,
    payload_used TEXT,
    
    -- Result
    result VARCHAR(20) NOT NULL,  -- 'vulnerable', 'blocked', 'error', 'timeout', 'inconclusive'
    vulnerability_confirmed BOOLEAN DEFAULT false,
    
    -- Evidence
    evidence_screenshot TEXT,
    console_output TEXT,
    network_response JSONB,
    dom_changes JSONB,
    error_message TEXT,
    
    -- Analysis
    severity VARCHAR(20),
    confidence DECIMAL(3,2),
    false_positive_likelihood DECIMAL(3,2),
    
    -- Reproduction
    reproduction_steps JSONB DEFAULT '[]',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chaos session summary
CREATE TABLE qa_loop_chaos_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
    
    -- Counts by category
    total_attacks INTEGER DEFAULT 0,
    vulnerabilities_found INTEGER DEFAULT 0,
    blocked_attacks INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    
    -- Breakdown by severity
    critical_findings INTEGER DEFAULT 0,
    high_findings INTEGER DEFAULT 0,
    medium_findings INTEGER DEFAULT 0,
    low_findings INTEGER DEFAULT 0,
    
    -- Breakdown by category
    injection_findings INTEGER DEFAULT 0,
    xss_findings INTEGER DEFAULT 0,
    boundary_findings INTEGER DEFAULT 0,
    timing_findings INTEGER DEFAULT 0,
    security_findings INTEGER DEFAULT 0,
    a11y_findings INTEGER DEFAULT 0,
    
    -- Coverage
    pages_tested INTEGER DEFAULT 0,
    inputs_tested INTEGER DEFAULT 0,
    forms_tested INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_chaos_patterns_category ON qa_loop_chaos_patterns(category);
CREATE INDEX idx_chaos_patterns_session ON qa_loop_chaos_patterns(session_id);
CREATE INDEX idx_chaos_results_session ON qa_loop_chaos_results(session_id);
CREATE INDEX idx_chaos_results_page ON qa_loop_chaos_results(page_url);
CREATE INDEX idx_chaos_results_result ON qa_loop_chaos_results(result);
CREATE INDEX idx_chaos_results_severity ON qa_loop_chaos_results(severity);
CREATE INDEX idx_chaos_summaries_session ON qa_loop_chaos_summaries(session_id);

-- Trigger for updated_at
CREATE TRIGGER qa_loop_chaos_summaries_updated_at
    BEFORE UPDATE ON qa_loop_chaos_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_loop_updated_at();
