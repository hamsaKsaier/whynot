import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../api';
import {
  startQALoopSession,
  listQALoopSessions,
  getQALoopSession,
  pauseQALoopSession,
  resumeQALoopSession,
  stopQALoopSession,
  runRetest,
  getSessionTestCases,
  getSessionBugs,
  getSessionPages,
  getSessionTestRuns,
  listDocuments,
  toggleDocument,
  deleteDocument,
  checkExistingSession,
  retestBug,
} from '../qa-loop-api';

describe('QA Loop API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session management', () => {
    it('startQALoopSession posts session config', async () => {
      const request = { targetUrl: 'https://example.com', qualityThreshold: 80, maxIterations: 3 };
      const response = { success: true, session: { id: 's-1', status: 'running' } };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await startQALoopSession(request);
      expect(apiClient.post).toHaveBeenCalledWith('/qa-loop/sessions', request);
      expect(result).toEqual(response);
    });

    it('listQALoopSessions fetches sessions', async () => {
      const response = { sessions: [], total: 0 };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await listQALoopSessions({ limit: 10, offset: 0 });
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions', {
        params: { limit: 10, offset: 0 },
      });
      expect(result).toEqual(response);
    });

    it('getQALoopSession fetches session details', async () => {
      const response = { session: { id: 's-1' }, pages: [], testCases: [], bugs: [] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getQALoopSession('s-1');
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions/s-1');
      expect(result).toEqual(response);
    });

    it('pauseQALoopSession pauses a session', async () => {
      const response = { success: true, status: 'paused' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await pauseQALoopSession('s-1');
      expect(apiClient.post).toHaveBeenCalledWith('/qa-loop/sessions/s-1/pause');
      expect(result).toEqual(response);
    });

    it('resumeQALoopSession resumes a session', async () => {
      const response = { success: true, status: 'running' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await resumeQALoopSession('s-1');
      expect(apiClient.post).toHaveBeenCalledWith('/qa-loop/sessions/s-1/resume', {});
      expect(result).toEqual(response);
    });

    it('resumeQALoopSession sends login credentials when provided', async () => {
      const creds = { email: 'test@test.com', password: 'pass' };
      const response = { success: true, status: 'running', wsToken: 'token' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await resumeQALoopSession('s-1', creds);
      expect(apiClient.post).toHaveBeenCalledWith('/qa-loop/sessions/s-1/resume', {
        loginCredentials: creds,
      });
      expect(result).toEqual(response);
    });

    it('stopQALoopSession stops a session', async () => {
      const response = { success: true, status: 'cancelled' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await stopQALoopSession('s-1');
      expect(apiClient.post).toHaveBeenCalledWith('/qa-loop/sessions/s-1/stop');
      expect(result).toEqual(response);
    });

    it('runRetest starts a retest', async () => {
      const response = { success: true, retestSessionId: 's-2', mode: 'quick', status: 'running' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await runRetest('s-1', 'quick');
      expect(apiClient.post).toHaveBeenCalledWith('/qa-loop/sessions/s-1/retest', { mode: 'quick' });
      expect(result).toEqual(response);
    });

    it('checkExistingSession checks for existing session', async () => {
      const response = { exists: true, session: { id: 's-1', testCaseCount: 5 } };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await checkExistingSession('https://example.com');
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions/check-existing', {
        params: { baseUrl: 'https://example.com' },
        signal: undefined,
      });
      expect(result).toEqual(response);
    });
  });

  describe('Session data', () => {
    it('getSessionTestCases fetches test cases', async () => {
      const response = { testCases: [{ id: 'tc-1', name: 'Test' }] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getSessionTestCases('s-1');
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions/s-1/test-cases');
      expect(result).toEqual(response);
    });

    it('getSessionBugs fetches bugs', async () => {
      const response = { bugs: [{ id: 'b-1', title: 'Bug' }] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getSessionBugs('s-1');
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions/s-1/bugs');
      expect(result).toEqual(response);
    });

    it('getSessionPages fetches pages', async () => {
      const response = { pages: [{ id: 'p-1', url: 'https://example.com' }] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getSessionPages('s-1');
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions/s-1/pages');
      expect(result).toEqual(response);
    });

    it('getSessionTestRuns fetches test runs', async () => {
      const response = { testRuns: [{ id: 'tr-1', status: 'passed' }] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await getSessionTestRuns('s-1');
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions/s-1/test-runs');
      expect(result).toEqual(response);
    });
  });

  describe('Documents', () => {
    it('listDocuments fetches documents', async () => {
      const response = { documents: [] };
      (apiClient.get as any).mockResolvedValueOnce({ data: response });

      const result = await listDocuments('s-1');
      expect(apiClient.get).toHaveBeenCalledWith('/qa-loop/sessions/s-1/documents', {
        params: { activeOnly: false },
      });
      expect(result).toEqual(response);
    });

    it('toggleDocument toggles active state', async () => {
      const response = { success: true, isActive: true };
      (apiClient.patch as any).mockResolvedValueOnce({ data: response });

      const result = await toggleDocument('s-1', 'doc-1', true);
      expect(apiClient.patch).toHaveBeenCalledWith('/qa-loop/sessions/s-1/documents/doc-1', {
        isActive: true,
      });
      expect(result).toEqual(response);
    });

    it('deleteDocument deletes a document', async () => {
      const response = { success: true };
      (apiClient.delete as any).mockResolvedValueOnce({ data: response });

      const result = await deleteDocument('s-1', 'doc-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/qa-loop/sessions/s-1/documents/doc-1');
      expect(result).toEqual(response);
    });
  });

  describe('Bug retest', () => {
    it('retestBug triggers a bug retest', async () => {
      const response = { success: true, retestSessionId: 's-2', testCaseId: 'tc-1', status: 'running' };
      (apiClient.post as any).mockResolvedValueOnce({ data: response });

      const result = await retestBug('bug-1');
      expect(apiClient.post).toHaveBeenCalledWith('/qa-loop/bugs/bug-1/retest');
      expect(result).toEqual(response);
    });
  });
});
