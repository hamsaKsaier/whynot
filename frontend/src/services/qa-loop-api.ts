// Re-use the authenticated axios instance from api.ts so every request
// automatically carries the JWT Bearer token + X-Workspace-ID header
// and respects the 401 → redirect-to-login interceptor.
import { apiClient } from './api';

// QA Loop Session types
export interface QALoopSession {
  id: string;
  project_id: string | null;
  target_url: string;
  mode: 'explore' | 'retest' | 'smart_retest';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  quality_score: number;
  quality_threshold: number;
  iteration_count: number;
  max_iterations: number;
  pages_explored: number;
  tests_generated: number;
  bugs_found: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  config?: Record<string, any>;
  report_data?: any;
}

export interface QALoopPage {
  id: string;
  session_id: string;
  url: string;
  title: string | null;
  page_type: string | null;
  description: string | null;
  is_explored: boolean;
  explored_at: string | null;
  created_at: string;
}

export interface QALoopTestCase {
  id: string;
  session_id: string;
  name: string;
  description: string | null;
  category: string;
  priority: number;
  steps: any[];
  last_run_status: string | null;
  created_at: string;
}

export interface QALoopBug {
  id: string;
  session_id: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string | null;
  // bug_type and reproduction_steps exist in the DB but were missing from the
  // interface, causing attackCategory to always fall back to 'security' (5.9)
  bug_type: string | null;
  reproduction_steps: any[];
  page_url: string | null;
  video_path: string | null;
  status: string;
  created_at: string;
}

export interface QALoopTestRun {
  id: string;
  session_id: string;
  test_case_id: string;
  test_case_name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';
  duration_ms: number | null;
  self_healed: boolean;
  executed_at: string;
}

export interface LoginCredentials {
  loginUrl?: string;        // URL to navigate to for login (defaults to targetUrl)
  emailSelector?: string;   // CSS selector for email/username field
  passwordSelector?: string; // CSS selector for password field
  submitSelector?: string;  // CSS selector for submit button
  email: string;            // The email/username value
  password: string;         // The password value
}

export interface StartSessionRequest {
  projectId?: string;
  targetUrl: string;
  mode?: 'explore' | 'retest' | 'smart_retest';
  qualityThreshold?: number;
  maxIterations?: number;
  maxDurationHours?: number;
  documentContext?: string;
  config?: Record<string, any>;
  loginCredentials?: LoginCredentials;
  testPriority?: 'functional_first' | 'balanced' | 'security_first';
  sourceSessionId?: string; // For continuing from an existing session
}

export interface SessionDetailsResponse {
  session: QALoopSession;
  pages: QALoopPage[];
  testCases: QALoopTestCase[];
  bugs: QALoopBug[];
  notes: any[];
  isActive: boolean;
}

// Start a new QA Loop session
export async function startQALoopSession(request: StartSessionRequest): Promise<{
  success: boolean;
  session: QALoopSession;
  wsToken?: string;
}> {
  const response = await apiClient.post('/qa-loop/sessions', request);
  return response.data;
}

// List QA Loop sessions
export async function listQALoopSessions(params?: {
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  sessions: QALoopSession[];
  total: number;
}> {
  const response = await apiClient.get('/qa-loop/sessions', { params });
  return response.data;
}

// Check for existing session by base URL (Phase 3)
// Accepts an optional AbortSignal so callers can cancel stale in-flight requests (4.7)
export async function checkExistingSession(
  targetUrl: string,
  options?: { signal?: AbortSignal }
): Promise<{
  exists: boolean;
  session?: {
    id: string;
    testCaseCount: number;
    bugsFound: number;
    completedAt: string;
  };
}> {
  const response = await apiClient.get('/qa-loop/sessions/check-existing', {
    params: { baseUrl: targetUrl },
    signal: options?.signal
  });
  return response.data;
}

// Get QA Loop session details
export async function getQALoopSession(sessionId: string): Promise<SessionDetailsResponse> {
  const response = await apiClient.get(`/qa-loop/sessions/${sessionId}`);
  return response.data;
}

// Pause QA Loop session
export async function pauseQALoopSession(sessionId: string): Promise<{
  success: boolean;
  status: string;
}> {
  const response = await apiClient.post(`/qa-loop/sessions/${sessionId}/pause`);
  return response.data;
}

// Resume QA Loop session
// loginCredentials can be supplied so the backend can re-establish the browser
// session (login state) without re-running the full auth exploration.
export async function resumeQALoopSession(
  sessionId: string,
  loginCredentials?: LoginCredentials
): Promise<{
  success: boolean;
  status: string;
  wsToken?: string;
}> {
  const response = await apiClient.post(`/qa-loop/sessions/${sessionId}/resume`, {
    ...(loginCredentials ? { loginCredentials } : {})
  });
  return response.data;
}

// Stop QA Loop session
export async function stopQALoopSession(sessionId: string): Promise<{
  success: boolean;
  status: string;
}> {
  const response = await apiClient.post(`/qa-loop/sessions/${sessionId}/stop`);
  return response.data;
}

// Run retest
export async function runRetest(sessionId: string, mode: 'quick' | 'smart' = 'quick'): Promise<{
  success: boolean;
  retestSessionId: string;
  mode: string;
  status: string;
}> {
  const response = await apiClient.post(`/qa-loop/sessions/${sessionId}/retest`, { mode });
  return response.data;
}

// Get test cases for a session
export async function getSessionTestCases(sessionId: string): Promise<{
  testCases: QALoopTestCase[];
}> {
  const response = await apiClient.get(`/qa-loop/sessions/${sessionId}/test-cases`);
  return response.data;
}

// Get bugs for a session
export async function getSessionBugs(sessionId: string): Promise<{
  bugs: QALoopBug[];
}> {
  const response = await apiClient.get(`/qa-loop/sessions/${sessionId}/bugs`);
  return response.data;
}

// Get pages for a session
export async function getSessionPages(sessionId: string): Promise<{
  pages: QALoopPage[];
}> {
  const response = await apiClient.get(`/qa-loop/sessions/${sessionId}/pages`);
  return response.data;
}

// Get test runs for a session
export async function getSessionTestRuns(sessionId: string): Promise<{
  testRuns: QALoopTestRun[];
}> {
  const response = await apiClient.get(`/qa-loop/sessions/${sessionId}/test-runs`);
  return response.data;
}

// ==================== DOCUMENT API (Phase 7) ====================

// Field names match the snake_case columns returned by the executor API (5.6)
export interface QALoopDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  summary?: string;
  chunk_count: number;
  estimated_tokens?: number;
  is_active: boolean;
  created_at: string;
}

// Upload a document to a session.
// Uses arrayBuffer() → Uint8Array → btoa() so binary files (PDFs, images) are
// not corrupted by the old file.text() + btoa(unescape(...)) approach (5.7)
export async function uploadDocument(
  sessionId: string,
  file: File
): Promise<{
  success: boolean;
  document: QALoopDocument;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // Build a binary string byte-by-byte so btoa() handles all values 0-255
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const contentBase64 = btoa(binary);

  const response = await apiClient.post(`/qa-loop/sessions/${sessionId}/documents`, {
    filename: file.name,
    contentBase64
  });

  return response.data;
}

// List documents for a session
export async function listDocuments(
  sessionId: string,
  activeOnly: boolean = false
): Promise<{
  documents: QALoopDocument[];
}> {
  const response = await apiClient.get(`/qa-loop/sessions/${sessionId}/documents`, {
    params: { activeOnly }
  });
  return response.data;
}

// Get a specific document
export async function getDocument(
  sessionId: string,
  documentId: string,
  includeContent: boolean = false
): Promise<{
  document: QALoopDocument & { content?: string };
}> {
  const response = await apiClient.get(
    `/qa-loop/sessions/${sessionId}/documents/${documentId}`,
    { params: { includeContent } }
  );
  return response.data;
}

// Toggle document active state
export async function toggleDocument(
  sessionId: string,
  documentId: string,
  isActive: boolean
): Promise<{
  success: boolean;
  isActive: boolean;
}> {
  const response = await apiClient.patch(
    `/qa-loop/sessions/${sessionId}/documents/${documentId}`,
    { isActive }
  );
  return response.data;
}

// Delete a document
export async function deleteDocument(
  sessionId: string,
  documentId: string
): Promise<{
  success: boolean;
}> {
  const response = await apiClient.delete(
    `/qa-loop/sessions/${sessionId}/documents/${documentId}`
  );
  return response.data;
}

// Get combined document context
export async function getCombinedDocuments(
  sessionId: string,
  maxTokens?: number
): Promise<{
  context: string;
  documentCount: number;
  estimatedTokens: number;
}> {
  const response = await apiClient.get(
    `/qa-loop/sessions/${sessionId}/documents/combined`,
    { params: { maxTokens } }
  );
  return response.data;
}

// ==================== BUG RETEST API ====================

export async function retestBug(bugId: string): Promise<{
  success: boolean;
  retestSessionId: string;
  testCaseId: string;
  status: string;
}> {
  const response = await apiClient.post(`/qa-loop/bugs/${bugId}/retest`);
  return response.data;
}

// ==================== PLAYWRIGHT EXPORT API ====================

// Export a single test case as Playwright .spec.ts file download
export async function exportTestCasePlaywright(testCaseId: string): Promise<void> {
  const response = await apiClient.get(
    `/qa-loop/test-cases/${testCaseId}/export-playwright`,
    { responseType: 'blob' }
  );

  // Extract filename from Content-Disposition header
  const disposition = response.headers['content-disposition'] || '';
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : `test-case-${testCaseId}.spec.ts`;

  // Trigger browser download
  const blob = new Blob([response.data], { type: 'text/typescript' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Export an entire test suite as a combined Playwright .spec.ts file download
export async function exportTestSuitePlaywright(suiteId: string): Promise<void> {
  const response = await apiClient.get(
    `/qa-loop/test-suites/${suiteId}/export-playwright`,
    { responseType: 'blob' }
  );

  const disposition = response.headers['content-disposition'] || '';
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : `test-suite-${suiteId}.spec.ts`;

  const blob = new Blob([response.data], { type: 'text/typescript' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Download the entire QA Loop session as a ready-to-run Playwright project ZIP.
 * Contains: package.json, playwright.config.ts, tests/*.spec.ts, README.md, .env.example.
 * Run after unzip: npm install && npx playwright install && npm test
 */
export async function exportSessionTestSuite(sessionId: string): Promise<void> {
  const response = await apiClient.get(
    `/qa-loop/sessions/${sessionId}/export`,
    { responseType: 'blob' }
  );

  const disposition = response.headers['content-disposition'] || '';
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : `whynot-testsuite-${sessionId.slice(0, 8)}.zip`;

  const blob = new Blob([response.data], { type: 'application/zip' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ==================== PROJECT HIERARCHY API ====================

export interface TestSuiteHierarchyBug {
  id: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string | null;
  bug_type: string | null;
  page_url: string | null;
  reproduction_steps: any[];
  evidence_screenshots: any[];
  status: string;
  root_cause: string | null;
  suggested_fix: string | null;
  video_path: string | null;
  regression_test_id: string | null;
  discovered_by_test_case_id: string | null;
  created_at: string;
}

export interface TestSuiteHierarchyTestCase {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priority: number;
  risk_level: string;
  steps: any[];
  last_run_status: string | null;
  last_run_at: string | null;
  pass_count: number;
  fail_count: number;
  confidence_score: number | null;
  total_runs: number;
  source: string;
  created_at: string;
  bugs: TestSuiteHierarchyBug[];
}

export interface TestSuiteHierarchy {
  id: string;
  session_id: string;
  name: string;
  description: string | null;
  target_url: string;
  status: string;
  quality_score: number;
  tests_generated: number;
  bugs_found: number;
  created_at: string;
  completed_at: string | null;
  is_qa_generated: boolean;
  test_cases: TestSuiteHierarchyTestCase[];
  unlinked_bugs: TestSuiteHierarchyBug[];
}

export async function getProjectTestSuiteHierarchy(projectId: string): Promise<{
  suites: TestSuiteHierarchy[];
}> {
  const response = await apiClient.get(`/qa-loop/projects/${projectId}/test-suite-hierarchy`);
  return response.data;
}
