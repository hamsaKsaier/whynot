-- Failure Classification and Chat Migration
-- Adds support for failure analysis, chat sessions, and bug reporting

-- Failure analyses table
CREATE TABLE IF NOT EXISTS failure_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
  step_id VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  is_system_failure BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  recovery_attempted BOOLEAN NOT NULL DEFAULT false,
  recovery_success BOOLEAN,
  attempted_selectors JSONB,
  page_state JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  step_id VARCHAR(100),
  execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bug reports table
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
  step_id VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  error TEXT NOT NULL,
  screenshot_path VARCHAR(500),
  page_state JSONB,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  suggested_fix JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_failure_analyses_execution_id ON failure_analyses(execution_id);
CREATE INDEX IF NOT EXISTS idx_failure_analyses_step_id ON failure_analyses(step_id);
CREATE INDEX IF NOT EXISTS idx_failure_analyses_category ON failure_analyses(category);
CREATE INDEX IF NOT EXISTS idx_failure_analyses_is_system_failure ON failure_analyses(is_system_failure);
CREATE INDEX IF NOT EXISTS idx_failure_analyses_created_at ON failure_analyses(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_test_case_id ON chat_sessions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_execution_id ON chat_sessions(execution_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_bug_reports_execution_id ON bug_reports(execution_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_step_id ON bug_reports(step_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at);

-- Function to update updated_at timestamp for chat_sessions
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update updated_at timestamp for bug_reports
CREATE OR REPLACE FUNCTION update_bug_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at 
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_chat_sessions_updated_at();

DROP TRIGGER IF EXISTS update_bug_reports_updated_at ON bug_reports;
CREATE TRIGGER update_bug_reports_updated_at 
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW EXECUTE FUNCTION update_bug_reports_updated_at();






