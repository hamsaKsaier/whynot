-- Migration 037: Add verification_status to qa_loop_bugs
ALTER TABLE qa_loop_bugs ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'potential';
