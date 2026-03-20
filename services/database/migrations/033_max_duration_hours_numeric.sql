-- Migration 033: Change max_duration_hours from INTEGER to NUMERIC
-- Allows fractional hour values (e.g. 0.5 for 30 minutes)

ALTER TABLE qa_loop_sessions
    ALTER COLUMN max_duration_hours TYPE NUMERIC USING max_duration_hours::NUMERIC;
