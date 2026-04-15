import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockPost, mockPut, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      patch: mockPatch,
      delete: mockDelete,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: '/api' },
    })),
  },
}));

import {
  checkHealth,
  generateTests,
  runTest,
  getTestCases,
  updateTestCase,
  deleteTestCase,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getUserStories,
  createUserStory,
  updateUserStory,
  deleteUserStory,
  getExecutions,
  getExecutionResult,
  stopExecution,
  getDashboardStats,
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  getBillingSubscription,
  getBillingCredits,
  getPublicPlans,
  createCheckoutSession,
  cancelSubscription,
} from '../api';

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('checkHealth', () => {
    it('returns true when API is healthy', async () => {
      mockGet.mockResolvedValueOnce({ data: { status: 'healthy' } });
      const result = await checkHealth();
      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/health');
    });

    it('returns false when API is unhealthy', async () => {
      mockGet.mockResolvedValueOnce({ data: { status: 'down' } });
      const result = await checkHealth();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      const result = await checkHealth();
      expect(result).toBe(false);
    });
  });

  describe('generateTests', () => {
    it('posts to /generate-tests', async () => {
      const request = { user_story: 'As a user I can login', website_url: 'https://example.com' };
      mockPost.mockResolvedValueOnce({ data: { test_cases: [] } });
      const result = await generateTests(request as any);
      expect(mockPost).toHaveBeenCalledWith('/generate-tests', request);
      expect(result).toEqual({ test_cases: [] });
    });
  });

  describe('runTest', () => {
    it('posts to /run-test', async () => {
      const request = { user_story: 'test', website_url: 'https://example.com' };
      mockPost.mockResolvedValueOnce({ data: { execution_id: '123' } });
      const result = await runTest(request as any);
      expect(mockPost).toHaveBeenCalledWith('/run-test', request);
      expect(result).toEqual({ execution_id: '123' });
    });
  });

  describe('Test Cases API', () => {
    it('getTestCases fetches from /test-cases', async () => {
      mockGet.mockResolvedValueOnce({ data: { test_cases: [] } });
      const result = await getTestCases();
      expect(mockGet).toHaveBeenCalledWith('/test-cases');
      expect(result).toEqual({ test_cases: [] });
    });

    it('updateTestCase updates a test case', async () => {
      mockPut.mockResolvedValueOnce({ data: { success: true, test_case: { id: '1', name: 'Updated' } } });
      const result = await updateTestCase('1', { name: 'Updated' } as any);
      expect(mockPut).toHaveBeenCalledWith('/test-cases/1', { name: 'Updated' });
      expect(result).toEqual({ id: '1', name: 'Updated' });
    });

    it('deleteTestCase deletes a test case', async () => {
      mockDelete.mockResolvedValueOnce({});
      await deleteTestCase('1');
      expect(mockDelete).toHaveBeenCalledWith('/test-cases/1');
    });
  });

  describe('Projects API', () => {
    it('getProjects fetches projects', async () => {
      mockGet.mockResolvedValueOnce({ data: { projects: [], offset: 0, limit: 50, total: 0 } });
      const result = await getProjects(0, 50);
      expect(mockGet).toHaveBeenCalledWith('/projects', { params: { offset: 0, limit: 50 } });
    });

    it('getProject fetches a single project', async () => {
      mockGet.mockResolvedValueOnce({ data: { project: { id: '1' } } });
      const result = await getProject('1');
      expect(mockGet).toHaveBeenCalledWith('/projects/1');
    });

    it('createProject creates a project', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true, project: { id: '1' } } });
      await createProject({ name: 'New' });
      expect(mockPost).toHaveBeenCalledWith('/projects', { name: 'New' });
    });

    it('updateProject updates a project', async () => {
      mockPut.mockResolvedValueOnce({ data: { success: true, project: { id: '1' } } });
      await updateProject('1', { name: 'Updated' });
      expect(mockPut).toHaveBeenCalledWith('/projects/1', { name: 'Updated' });
    });

    it('deleteProject deletes a project', async () => {
      mockDelete.mockResolvedValueOnce({});
      await deleteProject('1');
      expect(mockDelete).toHaveBeenCalledWith('/projects/1');
    });
  });

  describe('User Stories API', () => {
    it('getUserStories fetches stories', async () => {
      mockGet.mockResolvedValueOnce({ data: { user_stories: [] } });
      await getUserStories('proj-1');
      expect(mockGet).toHaveBeenCalledWith('/projects/proj-1/user-stories', { params: { offset: 0, limit: 100 } });
    });

    it('createUserStory creates a story', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true, user_story: {} } });
      await createUserStory('proj-1', { story: 'test' });
      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/user-stories', { story: 'test' });
    });

    it('updateUserStory updates a story', async () => {
      mockPut.mockResolvedValueOnce({ data: { success: true, user_story: {} } });
      await updateUserStory('1', { story: 'updated' });
      expect(mockPut).toHaveBeenCalledWith('/user-stories/1', { story: 'updated' });
    });

    it('deleteUserStory deletes a story', async () => {
      mockDelete.mockResolvedValueOnce({});
      await deleteUserStory('1');
      expect(mockDelete).toHaveBeenCalledWith('/user-stories/1');
    });
  });

  describe('Executions API', () => {
    it('getExecutions fetches with filters', async () => {
      mockGet.mockResolvedValueOnce({ data: { executions: [], total: 0 } });
      await getExecutions({ offset: 0, limit: 10, status: 'completed' });
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/executions?'));
    });

    it('getExecutionResult fetches by ID', async () => {
      mockGet.mockResolvedValueOnce({ data: { execution_id: '123' } });
      const result = await getExecutionResult('123');
      expect(mockGet).toHaveBeenCalledWith('/executions/123');
    });

    it('stopExecution stops a running execution', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await stopExecution('123');
      expect(mockPost).toHaveBeenCalledWith('/executions/123/stop');
    });
  });

  describe('Dashboard API', () => {
    it('getDashboardStats fetches stats', async () => {
      mockGet.mockResolvedValueOnce({ data: { totalTestCases: 10 } });
      const result = await getDashboardStats();
      expect(mockGet).toHaveBeenCalledWith('/dashboard/stats');
      expect(result).toEqual({ totalTestCases: 10 });
    });
  });

  describe('Environments API', () => {
    it('getEnvironments fetches all', async () => {
      mockGet.mockResolvedValueOnce({ data: { environments: [] } });
      await getEnvironments();
      expect(mockGet).toHaveBeenCalledWith('/environments');
    });

    it('createEnvironment creates one', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await createEnvironment({ name: 'Staging', url: 'https://staging.com' });
      expect(mockPost).toHaveBeenCalledWith('/environments', { name: 'Staging', url: 'https://staging.com' });
    });

    it('updateEnvironment updates one', async () => {
      mockPut.mockResolvedValueOnce({ data: { success: true } });
      await updateEnvironment('1', { name: 'Updated' });
      expect(mockPut).toHaveBeenCalledWith('/environments/1', { name: 'Updated' });
    });

    it('deleteEnvironment deletes one', async () => {
      mockDelete.mockResolvedValueOnce({});
      await deleteEnvironment('1');
      expect(mockDelete).toHaveBeenCalledWith('/environments/1');
    });
  });

  describe('Auth API', () => {
    it('forgotPassword sends email', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await forgotPassword('test@test.com');
      expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'test@test.com' });
    });

    it('resetPassword sends token and new password', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await resetPassword('token123', 'newPass123');
      expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', { token: 'token123', newPassword: 'newPass123' });
    });
  });

  describe('Profile API', () => {
    it('getProfile fetches profile', async () => {
      mockGet.mockResolvedValueOnce({ data: { name: 'Test' } });
      await getProfile();
      expect(mockGet).toHaveBeenCalledWith('/me/profile');
    });

    it('updateProfile patches profile', async () => {
      mockPatch.mockResolvedValueOnce({ data: { name: 'Updated' } });
      await updateProfile({ name: 'Updated' });
      expect(mockPatch).toHaveBeenCalledWith('/me/profile', { name: 'Updated' });
    });

    it('changePassword sends passwords', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await changePassword('old', 'new');
      expect(mockPost).toHaveBeenCalledWith('/me/password', { currentPassword: 'old', newPassword: 'new' });
    });
  });

  describe('Billing API', () => {
    it('getBillingSubscription fetches subscription', async () => {
      mockGet.mockResolvedValueOnce({ data: { plan: 'pro' } });
      await getBillingSubscription();
      expect(mockGet).toHaveBeenCalledWith('/billing/subscription');
    });

    it('getBillingCredits fetches credits', async () => {
      mockGet.mockResolvedValueOnce({ data: { balance: 100 } });
      await getBillingCredits();
      expect(mockGet).toHaveBeenCalledWith('/billing/credits');
    });

    it('getPublicPlans fetches plans', async () => {
      mockGet.mockResolvedValueOnce({ data: { plans: [] } });
      await getPublicPlans();
      expect(mockGet).toHaveBeenCalledWith('/plans');
    });

    it('createCheckoutSession creates checkout', async () => {
      mockPost.mockResolvedValueOnce({ data: { url: 'https://stripe.com' } });
      await createCheckoutSession('plan-1');
      expect(mockPost).toHaveBeenCalledWith('/billing/checkout', { plan_id: 'plan-1' });
    });

    it('cancelSubscription cancels', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await cancelSubscription(true);
      expect(mockPost).toHaveBeenCalledWith('/billing/cancel', { immediate: true });
    });
  });
});
