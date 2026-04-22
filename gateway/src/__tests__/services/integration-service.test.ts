import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCreate, mockFindByWorkspace, mockFindById,
  mockUpdate, mockDelete, mockCreateBugTask, mockFindBugTasks,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindByWorkspace: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockCreateBugTask: vi.fn(),
  mockFindBugTasks: vi.fn(),
}));

vi.mock('../../../shared/database/repositories/integration-repository', () => ({
  IntegrationRepository: vi.fn().mockImplementation(() => ({
    create: mockCreate,
    findByWorkspace: mockFindByWorkspace,
    findById: mockFindById,
    update: mockUpdate,
    delete: mockDelete,
    createBugTask: mockCreateBugTask,
    findBugTasks: mockFindBugTasks,
  })),
}));

vi.mock('../../../shared/database/connection', () => ({
  query: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { IntegrationService } from '../../services/integration-service';

describe('IntegrationService', () => {
  let service: IntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntegrationService();
  });

  describe('CRUD operations', () => {
    it('createIntegration delegates to repository', async () => {
      const input = { workspace_id: 'ws-1', type: 'jira' as const, name: 'Jira', config: {} };
      mockCreate.mockResolvedValue({ id: 'int-1', ...input });

      const result = await service.createIntegration(input as any);
      expect(result.id).toBe('int-1');
      expect(mockCreate).toHaveBeenCalledWith(input);
    });

    it('getIntegrations returns workspace integrations', async () => {
      mockFindByWorkspace.mockResolvedValue([{ id: 'int-1' }]);
      const result = await service.getIntegrations('ws-1');
      expect(result).toHaveLength(1);
    });

    it('getIntegration returns single integration', async () => {
      mockFindById.mockResolvedValue({ id: 'int-1' });
      const result = await service.getIntegration('int-1');
      expect(result?.id).toBe('int-1');
    });

    it('getIntegration returns null when not found', async () => {
      mockFindById.mockResolvedValue(null);
      const result = await service.getIntegration('non-existent');
      expect(result).toBeNull();
    });

    it('updateIntegration delegates to repository', async () => {
      mockUpdate.mockResolvedValue({ id: 'int-1', name: 'Updated' });
      const result = await service.updateIntegration('int-1', { name: 'Updated' });
      expect(result?.name).toBe('Updated');
    });

    it('deleteIntegration delegates to repository', async () => {
      mockDelete.mockResolvedValue(true);
      const result = await service.deleteIntegration('int-1');
      expect(result).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('returns failure for Jira with missing config', async () => {
      const integration = { type: 'jira', config: {} } as any;
      const result = await service.testConnection(integration);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required Jira config');
    });

    it('returns failure for ClickUp with missing apiToken', async () => {
      const integration = { type: 'clickup', config: {} } as any;
      const result = await service.testConnection(integration);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required ClickUp config');
    });

    it('returns failure for Linear with missing apiKey', async () => {
      const integration = { type: 'linear', config: {} } as any;
      const result = await service.testConnection(integration);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required Linear config');
    });

    it('returns failure for unknown integration type', async () => {
      const integration = { type: 'unknown', config: {} } as any;
      const result = await service.testConnection(integration);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown integration type');
    });

    it('tests Jira connection successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ displayName: 'John Doe' }),
      });

      const integration = {
        type: 'jira',
        config: { apiUrl: 'https://jira.test.com', email: 'test@test.com', apiToken: 'token' },
      } as any;
      const result = await service.testConnection(integration);

      expect(result.success).toBe(true);
      expect(result.message).toContain('John Doe');
    });

    it('tests ClickUp connection successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { username: 'testuser' } }),
      });

      const integration = { type: 'clickup', config: { apiToken: 'token' } } as any;
      const result = await service.testConnection(integration);

      expect(result.success).toBe(true);
      expect(result.message).toContain('testuser');
    });

    it('tests Linear connection successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { viewer: { name: 'Linear User' } } }),
      });

      const integration = { type: 'linear', config: { apiKey: 'lin_key' } } as any;
      const result = await service.testConnection(integration);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Linear User');
    });
  });

  describe('getBugTasks', () => {
    it('delegates to repository', async () => {
      mockFindBugTasks.mockResolvedValue([{ id: 'bt-1', bug_id: 'bug-1' }]);
      const result = await service.getBugTasks('bug-1');
      expect(result).toHaveLength(1);
    });
  });
});
