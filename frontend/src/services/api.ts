import axios from 'axios';
import type { 
  RunTestRequest, 
  RunTestResponse, 
  GenerateTestsRequest, 
  GenerateTestsResponse,
  ExecutionResult,
  TestCase
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes for test execution
});

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

export default apiClient;





