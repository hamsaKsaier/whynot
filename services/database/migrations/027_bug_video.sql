-- Add video recording path to sessions and bugs
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE qa_loop_bugs ADD COLUMN IF NOT EXISTS video_path TEXT;
