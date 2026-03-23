import axios from 'axios';
import type {
  RunTestRequest,
  RunTestResponse,
  GenerateTestsRequest,
  GenerateTestsResponse,
  ExecutionResult,
  TestCase,
  FlowData,
  Project,
  UserStory
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes for test execution
});

// ─── Auth interceptors ────────────────────────────────────────────────────────

/** Attach JWT Bearer token + active workspace ID to every request */
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const workspaceId = localStorage.getItem('active_workspace_id');
  if (workspaceId) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)['X-Workspace-ID'] = workspaceId;
  }
  return config;
});

/** On 401, clear token and redirect to /login (skip for auth-specific endpoints) */
/** On 402/403 with billing codes, dispatch upgrade prompt event */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const details = error.response?.data?.details;

    if (status === 401) {
      const url: string = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/');
      if (!isAuthEndpoint) {
        localStorage.removeItem('auth_token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Credit / feature / subscription gates
    if (status === 402 && code === 'INSUFFICIENT_CREDITS') {
      window.dispatchEvent(new CustomEvent('upgrade-prompt', {
        detail: { type: 'credits', details },
      }));
    } else if (status === 403 && (code === 'FEATURE_NOT_AVAILABLE' || code === 'FEATURE_LIMIT_REACHED')) {
      window.dispatchEvent(new CustomEvent('upgrade-prompt', {
        detail: { type: 'feature', details },
      }));
    } else if (status === 403 && (code === 'NO_SUBSCRIPTION' || code === 'SUBSCRIPTION_INACTIVE' || code === 'TRIAL_EXPIRED')) {
      window.dispatchEvent(new CustomEvent('upgrade-prompt', {
        detail: { type: 'subscription', details: { ...details, status: code } },
      }));
    }

    return Promise.reject(error);
  }
);

// Health check
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/health');
    return response.data.status === 'healthy';
  } catch {
    return false;
  }
};

// Generate test cases from user story
export const generateTests = async (
  request: GenerateTestsRequest
): Promise<GenerateTestsResponse> => {
  const response = await apiClient.post<GenerateTestsResponse>(
    '/generate-tests',
    request
  );
  return response.data;
};

// Run complete test workflow (generate + execute)
export const runTest = async (
  request: RunTestRequest
): Promise<RunTestResponse> => {
  const response = await apiClient.post<RunTestResponse>(
    '/run-test',
    request
  );
  return response.data;
};

// Execute a test case (test case already generated)
// For non-headless mode, this returns executionId immediately
// For headless mode, this returns the full result
export const executeTest = async (
  testCase: any,
  headless: boolean = false
): Promise<ExecutionResult | { execution_id: string; status: string; message?: string; test_case_id: string; website_url: string }> => {
  const response = await apiClient.post<any>(
    `/execute-test?headless=${headless}`,
    testCase
  );
  return response.data;
};

// Get execution result by ID (for polling final results)
export const getExecutionResult = async (
  executionId: string
): Promise<ExecutionResult> => {
  const response = await apiClient.get<ExecutionResult>(
    `/executions/${executionId}`
  );
  return response.data;
};

// Get all executions with pagination, filtering, and search
export const getExecutions = async (options?: {
  offset?: number;
  limit?: number;
  status?: 'completed' | 'failed' | 'running' | 'timeout' | 'paused';
  search?: string;
}): Promise<{
  executions: ExecutionResult[];
  total: number;
  offset: number;
  limit: number;
}> => {
  const params = new URLSearchParams();
  if (options?.offset !== undefined) params.append('offset', String(options.offset));
  if (options?.limit !== undefined) params.append('limit', String(options.limit));
  if (options?.status) params.append('status', options.status);
  if (options?.search) params.append('search', options.search);

  const response = await apiClient.get<{
    executions: ExecutionResult[];
    total: number;
    offset: number;
    limit: number;
  }>(`/executions?${params.toString()}`);
  return response.data;
};

// Get execution by ID (alias for getExecutionResult, but more explicit)
export const getExecutionById = async (
  executionId: string
): Promise<ExecutionResult> => {
  const response = await apiClient.get<ExecutionResult>(
    `/executions/${executionId}`
  );
  return response.data;
};

// Stop a running execution
export const stopExecution = async (
  executionId: string
): Promise<{ success: boolean; message: string; execution_id: string }> => {
  const response = await apiClient.post<{ success: boolean; message: string; execution_id: string }>(
    `/executions/${executionId}/stop`
  );
  return response.data;
};

// Get test results (future use)
export const getTestResults = async (
  executionId: string
): Promise<ExecutionResult> => {
  const response = await apiClient.get<ExecutionResult>(
    `/results/${executionId}`
  );
  return response.data;
};

// Get all saved test cases
export const getTestCases = async (): Promise<{ test_cases: TestCase[] }> => {
  const response = await apiClient.get<{ test_cases: TestCase[] }>('/test-cases');
  return response.data;
};

// Update a test case
export const updateTestCase = async (id: string, updates: Partial<TestCase>): Promise<TestCase> => {
  const response = await apiClient.put<{ success: boolean; test_case: TestCase }>(`/test-cases/${id}`, updates);
  return response.data.test_case;
};

// Delete a test case
export const deleteTestCase = async (id: string): Promise<void> => {
  await apiClient.delete(`/test-cases/${id}`);
};

// Get flow data for visualization
export const getFlowData = async (): Promise<{ projects: FlowData['projects'] }> => {
  const response = await apiClient.get<{ projects: FlowData['projects'] }>('/flow-data');
  return response.data;
};

// ==================== PROJECT API ====================

export interface ProjectWithStats extends Project {
  user_story_count: number;
}

export interface ProjectsResponse {
  projects: ProjectWithStats[];
  offset: number;
  limit: number;
  total: number;
}

// Get all projects
export const getProjects = async (offset = 0, limit = 50): Promise<ProjectsResponse> => {
  const response = await apiClient.get<ProjectsResponse>('/projects', {
    params: { offset, limit }
  });
  return response.data;
};

// Get project by ID
export const getProject = async (id: string): Promise<{ project: ProjectWithStats }> => {
  const response = await apiClient.get<{ project: ProjectWithStats }>(`/projects/${id}`);
  return response.data;
};

// Create a new project
export const createProject = async (data: {
  name: string;
  description?: string;
  website_url?: string;
}): Promise<{ success: boolean; project: Project }> => {
  const response = await apiClient.post<{ success: boolean; project: Project }>('/projects', data);
  return response.data;
};

// Update a project
export const updateProject = async (
  id: string,
  data: { name?: string; description?: string; website_url?: string }
): Promise<{ success: boolean; project: Project }> => {
  const response = await apiClient.put<{ success: boolean; project: Project }>(`/projects/${id}`, data);
  return response.data;
};

// Delete a project
export const deleteProject = async (id: string): Promise<void> => {
  await apiClient.delete(`/projects/${id}`);
};

// ==================== PROJECT CONTEXT API ====================

export const getProjectContext = async (projectId: string): Promise<{ context: any; user_prd: string }> => {
  const response = await apiClient.get<{ context: any; user_prd: string }>(`/projects/${projectId}/context`);
  return response.data;
};

export const updateProjectPrd = async (projectId: string, prd: string): Promise<void> => {
  await apiClient.put(`/projects/${projectId}/prd`, { user_prd: prd });
};

export const resetProjectContext = async (projectId: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/context`);
};

// Get test cases grouped by category for a project
export interface CategoryGroup {
  name: string;
  testCases: any[];
  stats: { passed: number; failed: number; review: number; skipped: number };
}

export interface ProjectTestCasesByCategory {
  categories: CategoryGroup[];
  bugs: any[];
  scanHistory: any[];
}

export const getProjectTestCasesByCategory = async (projectId: string): Promise<ProjectTestCasesByCategory> => {
  const response = await apiClient.get<ProjectTestCasesByCategory>(`/projects/${projectId}/test-cases-by-category`);
  return response.data;
};

// ==================== USER STORY API ====================

export interface UserStoryWithStats extends UserStory {
  test_case_count: number;
}

export interface UserStoriesResponse {
  user_stories: UserStoryWithStats[];
  offset: number;
  limit: number;
  total: number;
}

// Get user stories for a project
export const getUserStories = async (
  projectId: string,
  offset = 0,
  limit = 100
): Promise<UserStoriesResponse> => {
  const response = await apiClient.get<UserStoriesResponse>(`/projects/${projectId}/user-stories`, {
    params: { offset, limit }
  });
  return response.data;
};

// Get user story by ID
export const getUserStory = async (id: string): Promise<{ user_story: UserStoryWithStats }> => {
  const response = await apiClient.get<{ user_story: UserStoryWithStats }>(`/user-stories/${id}`);
  return response.data;
};

// Create a user story in a project
export const createUserStory = async (
  projectId: string,
  data: { story: string; website_url?: string; additional_context?: string }
): Promise<{ success: boolean; user_story: UserStory }> => {
  const response = await apiClient.post<{ success: boolean; user_story: UserStory }>(
    `/projects/${projectId}/user-stories`,
    data
  );
  return response.data;
};

// Update a user story
export const updateUserStory = async (
  id: string,
  data: { story?: string; website_url?: string; additional_context?: string }
): Promise<{ success: boolean; user_story: UserStory }> => {
  const response = await apiClient.put<{ success: boolean; user_story: UserStory }>(
    `/user-stories/${id}`,
    data
  );
  return response.data;
};

// Delete a user story
export const deleteUserStory = async (id: string): Promise<void> => {
  await apiClient.delete(`/user-stories/${id}`);
};

// ==================== EXTENDED GENERATE TESTS ====================

export interface GenerateTestsWithContextRequest extends GenerateTestsRequest {
  project_id?: string;
  user_story_id?: string;
  prerequisite_steps?: Array<{ action: 'click' | 'type'; selector: string; value?: string }>;
  quick_mode?: boolean;
}

export interface GenerateTestsWithContextResponse extends GenerateTestsResponse {
  user_story_id?: string;
}

// Generate tests with project/user story context
export const generateTestsWithContext = async (
  request: GenerateTestsWithContextRequest
): Promise<GenerateTestsWithContextResponse> => {
  const response = await apiClient.post<GenerateTestsWithContextResponse>(
    '/generate-tests',
    request
  );
  return response.data;
};

// ==================== FOLDER API ====================

export interface Folder {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderWithStats extends Folder {
  user_story_count: number;
}

// Get folders for a project
export const getFolders = async (projectId: string): Promise<{ folders: FolderWithStats[] }> => {
  const response = await apiClient.get<{ folders: FolderWithStats[] }>(`/projects/${projectId}/folders`);
  return response.data;
};

// Create a folder
export const createFolder = async (
  projectId: string,
  data: { name: string; color?: string }
): Promise<{ success: boolean; folder: Folder }> => {
  const response = await apiClient.post<{ success: boolean; folder: Folder }>(
    `/projects/${projectId}/folders`,
    data
  );
  return response.data;
};

// Update a folder
export const updateFolder = async (
  id: string,
  data: { name?: string; color?: string }
): Promise<{ success: boolean; folder: Folder }> => {
  const response = await apiClient.put<{ success: boolean; folder: Folder }>(`/folders/${id}`, data);
  return response.data;
};

// Delete a folder
export const deleteFolder = async (id: string): Promise<void> => {
  await apiClient.delete(`/folders/${id}`);
};

// Assign user story to folder
export const assignUserStoryToFolder = async (
  userStoryId: string,
  folderId: string | null
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.put<{ success: boolean; message: string }>(
    `/user-stories/${userStoryId}/folder`,
    { folder_id: folderId }
  );
  return response.data;
};

// ==================== DASHBOARD API ====================

export interface DashboardStats {
  totalTestCases: number;
  totalQASessions: number;
  totalBugsFound: number;
  successRate: number;
  totalExecutions: number;
  recentSessions: Array<{
    id: string;
    target_url: string;
    status: string;
    quality_score: number;
    tests_generated: number;
    bugs_found: number;
    pages_explored: number;
    created_at: string;
    completed_at: string | null;
  }>;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await apiClient.get<DashboardStats>('/dashboard/stats');
  return response.data;
};

// ==================== ENVIRONMENTS API ====================

export interface SavedEnvironment {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Get all saved environments
export const getEnvironments = async (): Promise<{ environments: SavedEnvironment[] }> => {
  const response = await apiClient.get<{ environments: SavedEnvironment[] }>('/environments');
  return response.data;
};

// Create a new environment
export const createEnvironment = async (data: {
  name: string;
  url: string;
  description?: string;
}): Promise<{ success: boolean; environment: SavedEnvironment }> => {
  const response = await apiClient.post<{ success: boolean; environment: SavedEnvironment }>('/environments', data);
  return response.data;
};

// Update an environment
export const updateEnvironment = async (
  id: string,
  data: { name?: string; url?: string; description?: string }
): Promise<{ success: boolean; environment: SavedEnvironment }> => {
  const response = await apiClient.put<{ success: boolean; environment: SavedEnvironment }>(`/environments/${id}`, data);
  return response.data;
};

// Delete an environment
export const deleteEnvironment = async (id: string): Promise<void> => {
  await apiClient.delete(`/environments/${id}`);
};

// ==================== VISUAL REGRESSION ENDPOINTS ====================

import type { VisualBaseline, VisualComparison } from '../types';

// Get baselines for a test case
export const getTestCaseBaselines = async (testCaseId: string): Promise<{ baselines: VisualBaseline[] }> => {
  const response = await apiClient.get<{ baselines: VisualBaseline[] }>(
    `/test-cases/${testCaseId}/baselines`
  );
  return response.data;
};

// Get baseline history for a test case and step
export const getBaselineHistory = async (
  testCaseId: string,
  stepId: string
): Promise<{ baselines: VisualBaseline[] }> => {
  const response = await apiClient.get<{ baselines: VisualBaseline[] }>(
    `/test-cases/${testCaseId}/baselines/${stepId}`
  );
  return response.data;
};

// Create/update baseline (manual)
export const createBaseline = async (
  testCaseId: string,
  baselineData: { step_id: string; screenshot_path: string; execution_id?: string }
): Promise<{ success: boolean; baseline: VisualBaseline }> => {
  const response = await apiClient.post<{ success: boolean; baseline: VisualBaseline }>(
    `/test-cases/${testCaseId}/baselines`,
    baselineData
  );
  return response.data;
};

// Lock/unlock baseline
export const setBaselineLock = async (
  testCaseId: string,
  baselineId: string,
  isLocked: boolean
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.put<{ success: boolean; message: string }>(
    `/test-cases/${testCaseId}/baselines/${baselineId}/lock`,
    { is_locked: isLocked }
  );
  return response.data;
};

// Get visual comparisons for an execution
export const getExecutionVisualComparisons = async (
  executionId: string
): Promise<{ comparisons: VisualComparison[] }> => {
  const response = await apiClient.get<{ comparisons: VisualComparison[] }>(
    `/executions/${executionId}/visual-comparisons`
  );
  return response.data;
};

// Get all visual regressions (filtered, paginated)
export const getVisualRegressions = async (options?: {
  ignored?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  limit?: number;
  offset?: number;
}): Promise<{ regressions: VisualComparison[] }> => {
  const params = new URLSearchParams();
  if (options?.ignored !== undefined) params.append('ignored', String(options.ignored));
  if (options?.severity) params.append('severity', options.severity);
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));

  const response = await apiClient.get<{ regressions: VisualComparison[] }>(
    `/visual-regressions?${params.toString()}`
  );
  return response.data;
};

// Ignore/unignore a visual regression
export const setVisualRegressionIgnored = async (
  comparisonId: string,
  ignored: boolean
): Promise<{ success: boolean; comparison: VisualComparison }> => {
  const response = await apiClient.put<{ success: boolean; comparison: VisualComparison }>(
    `/visual-regressions/${comparisonId}/ignore`,
    { ignored }
  );
  return response.data;
};

// ─── Billing API ──────────────────────────────────────────────────────────────

export const getBillingSubscription = async () => {
  const response = await apiClient.get('/billing/subscription');
  return response.data;
};

export const getBillingCredits = async () => {
  const response = await apiClient.get('/billing/credits');
  return response.data;
};

export const getBillingCreditsHistory = async (offset = 0, limit = 50) => {
  const response = await apiClient.get('/billing/credits/history', { params: { offset, limit } });
  return response.data;
};

export const getBillingUsage = async () => {
  const response = await apiClient.get('/billing/usage');
  return response.data;
};

export const getPublicPlans = async () => {
  const response = await apiClient.get('/plans');
  return response.data;
};

export const createCheckoutSession = async (planId: string) => {
  const response = await apiClient.post('/billing/checkout', { plan_id: planId });
  return response.data;
};

export const createPortalSession = async () => {
  const response = await apiClient.post('/billing/portal');
  return response.data;
};

export const getBillingInvoices = async () => {
  const response = await apiClient.get('/billing/invoices');
  return response.data;
};

export const cancelSubscription = async (immediate = false) => {
  const response = await apiClient.post('/billing/cancel', { immediate });
  return response.data;
};

export const reactivateSubscription = async () => {
  const response = await apiClient.post('/billing/reactivate');
  return response.data;
};

export default apiClient;

