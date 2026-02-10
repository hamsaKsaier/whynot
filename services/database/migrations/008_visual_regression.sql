-- Visual Regression Intelligence Migration
-- Adds support for visual regression testing with baseline management and comparison

-- Visual baselines table
CREATE TABLE IF NOT EXISTS visual_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
  step_id VARCHAR(100) NOT NULL,
  screenshot_path VARCHAR(500) NOT NULL,
  screenshot_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for quick comparison
  baseline_version INTEGER NOT NULL DEFAULT 1,
  execution_id UUID REFERENCES executions(id) ON DELETE SET NULL, -- Reference to execution that created baseline
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(50) DEFAULT 'system',
  UNIQUE(test_case_id, step_id, baseline_version)
);

-- Visual comparisons table
CREATE TABLE IF NOT EXISTS visual_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
  step_id VARCHAR(100) NOT NULL,
  baseline_id UUID REFERENCES visual_baselines(id) ON DELETE SET NULL,
  current_screenshot_path VARCHAR(500) NOT NULL,
  diff_image_path VARCHAR(500), -- Optional: store visual diff image
  pixel_diff_score DECIMAL(5, 4) NOT NULL, -- 0.0 to 1.0 (percentage of pixels different)
  ai_diff_analysis JSONB, -- AI analysis result with semantic descriptions
  is_regression BOOLEAN NOT NULL, -- True if visual regression detected
  regression_severity VARCHAR(20) CHECK (regression_severity IN ('low', 'medium', 'high', 'critical')),
  ignored BOOLEAN DEFAULT false, -- User can ignore specific regressions
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_visual_baselines_test_case_step ON visual_baselines(test_case_id, step_id);
CREATE INDEX IF NOT EXISTS idx_visual_baselines_version ON visual_baselines(baseline_version DESC);
CREATE INDEX IF NOT EXISTS idx_visual_baselines_execution ON visual_baselines(execution_id);
CREATE INDEX IF NOT EXISTS idx_visual_comparisons_execution ON visual_comparisons(execution_id);
CREATE INDEX IF NOT EXISTS idx_visual_comparisons_regression ON visual_comparisons(is_regression, regression_severity);
CREATE INDEX IF NOT EXISTS idx_visual_comparisons_baseline ON visual_comparisons(baseline_id);
CREATE INDEX IF NOT EXISTS idx_visual_comparisons_ignored ON visual_comparisons(ignored);
