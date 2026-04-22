import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindWorkspaceById, mockFindUserById } = vi.hoisted(() => ({
  mockFindWorkspaceById: vi.fn(),
  mockFindUserById: vi.fn(),
}));

vi.mock('../../../shared/database/repositories/workspace-repository', () => ({
  WorkspaceRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindWorkspaceById,
  })),
}));

vi.mock('../../../shared/database/repositories/user-repository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindUserById,
  })),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { resolveWorkspaceRecipient } from '../../emails/notification-helper';

describe('resolveWorkspaceRecipient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns email recipient for valid workspace and user', async () => {
    mockFindWorkspaceById.mockResolvedValue({ id: 'ws-1', owner_id: 'u-1' });
    mockFindUserById.mockResolvedValue({ id: 'u-1', email: 'owner@test.com', name: 'Owner' });

    const result = await resolveWorkspaceRecipient('ws-1');

    expect(result).toEqual({
      email: 'owner@test.com',
      name: 'Owner',
      locale: 'en',
    });
  });

  it('returns null if workspace not found', async () => {
    mockFindWorkspaceById.mockResolvedValue(null);

    const result = await resolveWorkspaceRecipient('ws-bad');
    expect(result).toBeNull();
  });

  it('returns null if user not found', async () => {
    mockFindWorkspaceById.mockResolvedValue({ id: 'ws-1', owner_id: 'u-1' });
    mockFindUserById.mockResolvedValue(null);

    const result = await resolveWorkspaceRecipient('ws-1');
    expect(result).toBeNull();
  });

  it('returns null if user has no email', async () => {
    mockFindWorkspaceById.mockResolvedValue({ id: 'ws-1', owner_id: 'u-1' });
    mockFindUserById.mockResolvedValue({ id: 'u-1', email: null, name: 'No Email' });

    const result = await resolveWorkspaceRecipient('ws-1');
    expect(result).toBeNull();
  });

  it('returns null on error (does not throw)', async () => {
    mockFindWorkspaceById.mockRejectedValue(new Error('db error'));

    const result = await resolveWorkspaceRecipient('ws-1');
    expect(result).toBeNull();
  });
});
