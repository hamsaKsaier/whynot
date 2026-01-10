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
  type: 'data-testid' | 'id' | 'class' | 'text' | 'xpath' | 'css' | 'aria-label' | 'visual';
  value: string;
  stability_score: number;
  confidence?: number;
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
  success?: boolean; // Optional to support pending/running states
  error?: string;
  screenshot_path?: string;
  execution_time_ms: number;
  element_found?: boolean;
  selector_used?: ElementSelector;
  failure_analysis?: FailureAnalysis;
  attempted_selectors?: ElementSelector[];
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

export interface RunTestRequest {
  website_url: string;
  user_story: string;
  headless?: boolean;
}

export interface RunTestResponse {
  success: boolean;
  test_case?: TestCase;
  execution_result?: ExecutionResult;
  summary?: {
    test_name: string;
    total_steps: number;
    passed_steps: number;
    failed_steps: number;
    status: string;
    duration_ms: number;
  };
  error?: string;
}

export interface GenerateTestsRequest {
  website_url: string;
  user_story: string;
  additional_context?: string;
}

export interface GenerateTestsResponse {
  test_cases: TestCase[];
}

// Flow visualization types
export interface Project {
  id: string;
  name: string;
  description?: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserStory {
  id: string;
  project_id: string;
  story: string;
  website_url?: string;
  additional_context?: string;
  folder_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TestSuite {
  id: string;
  user_story_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type FlowNodeType = 'project' | 'folder' | 'userStory' | 'testSuite' | 'testCase' | 'testStep';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  data: {
    label: string;
    description?: string;
    [key: string]: any;
  };
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

// User Story Folder for organizing stories
export interface UserStoryFolder {
  id: string;
  project_id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface FlowData {
  projects: Array<{
    project: Project;
    folders?: UserStoryFolder[];
    user_stories: Array<{
      user_story: UserStory & { folder_id?: string };
      test_suites: Array<{
        test_suite: TestSuite;
        test_cases: Array<{
          test_case: TestCase;
          steps: TestStep[];
        }>;
      }>;
      // For test cases without test suites
      test_cases?: Array<{
        test_case: TestCase;
        steps: TestStep[];
      }>;
    }>;
  }>;
}





