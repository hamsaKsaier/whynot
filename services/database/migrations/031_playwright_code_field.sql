-- Migration: 031_playwright_code_field.sql
-- Description: Add playwright_code column to qa_loop_test_cases for storing generated Playwright test code
-- Created: 2026-03-19

-- Add playwright_code to qa_loop_test_cases
ALTER TABLE qa_loop_test_cases ADD COLUMN IF NOT EXISTS playwright_code TEXT;

-- Add playwright_code to test_cases if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_cases') THEN
    ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS playwright_code TEXT;
  END IF;
END $$;
