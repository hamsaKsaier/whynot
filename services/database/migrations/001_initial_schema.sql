-- Initial database schema for WhyNot

-- Test cases table
CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  website_url VARCHAR(500) NOT NULL,
  user_story TEXT NOT NULL,
  steps JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  total_duration_ms INTEGER,
  error TEXT,
  screenshots TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step results table
CREATE TABLE IF NOT EXISTS step_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
  step_id VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER,
  error TEXT,
  screenshot_path VARCHAR(500),
  element_found BOOLEAN,
  selector_used JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_executions_test_case_id ON executions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at);
CREATE INDEX IF NOT EXISTS idx_step_results_execution_id ON step_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_website_url ON test_cases(website_url);
CREATE INDEX IF NOT EXISTS idx_test_cases_created_at ON test_cases(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

























