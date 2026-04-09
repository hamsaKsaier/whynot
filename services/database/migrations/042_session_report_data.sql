-- Add report_data JSONB column to store QA Lead synthesis report
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS report_data JSONB;
