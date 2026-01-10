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

export interface TestCase {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  website_url: string;
  metadata?: Record<string, any>;
}

export interface ElementSelector {
  type: 'data-testid' | 'id' | 'class' | 'text' | 'xpath' | 'css' | 'aria-label' | 'visual' | 'name';
  value: string;
  stability_score: number;
  confidence?: number;
}

export interface ElementLocation {
  selectors: ElementSelector[];
  screenshot_region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export enum FailureCategory {
  // System failures (our fault - should retry/recover)
  SELECTOR_FAILURE = 'selector_failure',        // All selectors failed
  TIMING_FAILURE = 'timing_failure',            // Element not ready yet
  PAGE_LOAD_FAILURE = 'page_load_failure',      // Page didn't load properly
  SELECTOR_INSTABILITY = 'selector_instability', // Selector worked before but not now
  
  // Application failures (legitimate bugs - report to dev)
  ELEMENT_MISSING = 'element_missing',           // Element doesn't exist in DOM
  ELEMENT_NOT_VISIBLE = 'element_not_visible',  // Element exists but hidden
  ELEMENT_NOT_INTERACTABLE = 'element_not_interactable', // Can't click/type
  ASSERTION_FAILURE = 'assertion_failure',      // Expected state not met
  FUNCTIONAL_BUG = 'functional_bug',            // App logic error
  
  // Ambiguous (needs analysis)
  UNKNOWN = 'unknown'
}

export interface FailureAnalysis {
  category: FailureCategory;
  confidence: number; // 0.0 to 1.0
  isSystemFailure: boolean; // true = our fault, false = app bug
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
  
  // Failure analysis fields
  failure_analysis?: FailureAnalysis;
  attempted_selectors?: ElementSelector[]; // All selectors we tried
  page_state?: PageState;
  recovery_attempts?: number;
}

export interface ExecutionResult {
  execution_id: string;
  test_case_id: string;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'paused';
  steps: StepResult[];
  total_duration_ms: number;
  screenshots: string[];
  error?: string;
  started_at: string;
  completed_at?: string;
}

