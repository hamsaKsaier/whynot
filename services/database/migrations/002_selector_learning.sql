-- Selector Learning Table
-- Stores proven selectors that worked in previous executions for faster subsequent runs

CREATE TABLE IF NOT EXISTS selector_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
  step_id VARCHAR(100) NOT NULL,
  target_description JSONB NOT NULL,
  proven_selectors JSONB[] NOT NULL,
  page_state_hash VARCHAR(64),
  success_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_selector_learning_test_case_step ON selector_learning(test_case_id, step_id);
CREATE INDEX IF NOT EXISTS idx_selector_learning_page_state ON selector_learning(page_state_hash);
CREATE INDEX IF NOT EXISTS idx_selector_learning_last_used ON selector_learning(last_used_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_selector_learning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_selector_learning_updated_at BEFORE UPDATE ON selector_learning
    FOR EACH ROW EXECUTE FUNCTION update_selector_learning_updated_at();














