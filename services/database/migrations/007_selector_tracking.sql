-- Add failure tracking to selector_learning table
-- This migration adds columns to track selector failure rates and last attempt timestamps

ALTER TABLE selector_learning 
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMP;

-- Add index for querying by last_attempted_at
CREATE INDEX IF NOT EXISTS idx_selector_learning_last_attempted 
ON selector_learning(last_attempted_at);

-- Note: The proven_selectors JSONB array stores per-selector stats:
-- - success_count: number of successful attempts
-- - failure_count: number of failed attempts  
-- - success_rate: calculated as success_count / (success_count + failure_count)
-- - last_attempted_at: timestamp of last attempt
