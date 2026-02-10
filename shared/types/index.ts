// Shared TypeScript types for inter-service communication

export enum ActionType {
  NAVIGATE = "navigate",
  CLICK = "click",
  TYPE = "type",
  FILL = "fill",
  SELECT = "select",
  WAIT = "wait",
  ASSERT = "assert",
  SCROLL = "scroll",
  HOVER = "hover"
}

export interface ElementDescription {
  text?: string;
  role?: string;
  label?: string;
  placeholder?: string;
  position?: string;
  attributes?: Record<string, string>;
}

export interface TestStep {
  id: string;
  action: ActionType;
  target?: ElementDescription;
  value?: string;
  expected_outcome?: string;
  wait_time?: number;
  description: string;
  suggested_selectors?: ElementSelector[];
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  warnings: number;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  website_url: string;
  metadata?: Record<string, any>;
  scenario_type?: string; // 'positive' | 'negative' | 'edge'
  risk_level?: string; // 'high' | 'medium' | 'low'
  priority_score?: number; // 0-100
  validation_result?: ValidationResult;
}

export interface UserStory {
  story: string;
  website_url: string;
  additional_context?: string;
}

export interface ExecutionResult {
  execution_id: string;
  test_case_id: string;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'paused' | 'cancelled';
  steps: StepResult[];
  total_duration_ms: number;
  screenshots: string[];
  error?: string;
  started_at: string;
  completed_at?: string;
}

export enum FailureCategory {
  SELECTOR_FAILURE = 'selector_failure',
  TIMING_FAILURE = 'timing_failure',
  PAGE_LOAD_FAILURE = 'page_load_failure',
  SELECTOR_INSTABILITY = 'selector_instability',
  ELEMENT_MISSING = 'element_missing',
  ELEMENT_NOT_VISIBLE = 'element_not_visible',
  ELEMENT_NOT_INTERACTABLE = 'element_not_interactable',
  ASSERTION_FAILURE = 'assertion_failure',
  FUNCTIONAL_BUG = 'functional_bug',
  UNKNOWN = 'unknown'
}

export interface FailureAnalysis {
  category: FailureCategory;
  confidence: number;
  isSystemFailure: boolean;
  reason: string;
  suggestedActions: string[];
  recoveryAttempted: boolean;
  recoverySuccess?: boolean;
}

export interface PageState {
  url: string;
  title: string;
  html_snippet?: string;
  element_count?: number;
}

export interface StepResult {
  step_id: string;
  success: boolean;
  error?: string;
  screenshot_path?: string;
  execution_time_ms: number;
  element_found?: boolean;
  selector_used?: ElementSelector;
  failure_analysis?: FailureAnalysis;
  attempted_selectors?: ElementSelector[];
  page_state?: PageState;
  recovery_attempts?: number;
  visual_comparison?: VisualComparisonResult;
}

export interface ElementSelector {
  type: 'data-testid' | 'id' | 'class' | 'text' | 'xpath' | 'css' | 'aria-label' | 'visual' | 'name';
  value: string;
  stability_score: number;
  confidence?: number;
}

export interface SetupHook {
  id: string;
  name: string;
  level: 'global' | 'suite' | 'test_case';
  steps: TestStep[];
  enabled: boolean;
  test_case_id?: string | null;
  folder_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Visual Regression Intelligence Types
export interface VisualBaseline {
  id: string;
  test_case_id: string;
  step_id: string;
  screenshot_path: string;
  screenshot_hash: string;
  baseline_version: number;
  execution_id?: string | null;
  is_locked: boolean;
  created_at: string;
  created_by: string;
}

export interface AIVisualDiffAnalysis {
  difference_types: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  descriptions: string[];
  affected_areas?: Array<{
    region: string;
    description: string;
  }>;
  recommendations?: string[];
}

export interface VisualComparisonResult {
  isRegression: boolean;
  pixelDiffScore: number; // 0.0 to 1.0 (percentage of pixels different)
  diffImagePath?: string;
  aiAnalysis?: AIVisualDiffAnalysis;
  severity: 'low' | 'medium' | 'high' | 'critical';
  differences: string[]; // Human-readable descriptions
}

export interface VisualComparison {
  id: string;
  execution_id: string;
  step_id: string;
  baseline_id?: string | null;
  current_screenshot_path: string;
  diff_image_path?: string | null;
  pixel_diff_score: number;
  ai_diff_analysis?: AIVisualDiffAnalysis | null;
  is_regression: boolean;
  regression_severity?: 'low' | 'medium' | 'high' | 'critical' | null;
  ignored: boolean;
  created_at: string;
}

export interface ComparisonOptions {
  pixelThreshold?: number; // Default: 0.01 (1%)
  enableAIAnalysis?: boolean; // Default: true
  generateDiffImage?: boolean; // Default: true
}
