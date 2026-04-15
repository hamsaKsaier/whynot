import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock workspace repository
const { mockFindById, mockFindAllByUserId } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindAllByUserId: vi.fn(),
}));
vi.mock('../../../shared/database/repositories/workspace-repository', () => ({
  WorkspaceRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findAllByUserId: mockFindAllByUserId,
  })),
}));

import { requireAuth, optionalAuth } from '../../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(payload: Record<string, unknown> = {}): string {
  return jwt.sign(
    { id: 'user-1', email: 'test@test.com', name: 'Test', role: 'user', ...payload },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function makeMocks(authHeader?: string, workspaceHeader?: string) {
  const req = {
    headers: {
      ...(authHeader ? { authorization: authHeader } : {}),
      ...(workspaceHeader ? { 'x-workspace-id': workspaceHeader } : {}),
    },
    user: undefined,
    workspaceId: undefined,
  } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAllByUserId.mockResolvedValue([{ id: 'ws-1' }]);
  });

  it('returns 401 if no Authorization header', async () => {
    const { req, res, next } = makeMocks();
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Authentication required' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if header does not start with Bearer', async () => {
    const { req, res, next } = makeMocks('Basic abc');
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for invalid token', async () => {
    const { req, res, next } = makeMocks('Bearer invalid.token.here');
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid or expired token' }),
    );
  });

  it('sets req.user and req.workspaceId for valid token', async () => {
    const token = makeToken();
    const { req, res, next } = makeMocks(`Bearer ${token}`);
    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(
      expect.objectContaining({ id: 'user-1', email: 'test@test.com', name: 'Test', role: 'user' }),
    );
    expect(req.workspaceId).toBe('ws-1');
  });

  it('uses X-Workspace-ID header when provided and owned', async () => {
    mockFindById.mockResolvedValue({ id: 'ws-custom', owner_id: 'user-1' });
    const token = makeToken();
    const { req, res, next } = makeMocks(`Bearer ${token}`, 'ws-custom');
    await requireAuth(req, res, next);

    expect(req.workspaceId).toBe('ws-custom');
  });

  it('falls back to first workspace when X-Workspace-ID is not owned', async () => {
    mockFindById.mockResolvedValue({ id: 'ws-custom', owner_id: 'other-user' });
    mockFindAllByUserId.mockResolvedValue([{ id: 'ws-default' }]);
    const token = makeToken();
    const { req, res, next } = makeMocks(`Bearer ${token}`, 'ws-custom');
    await requireAuth(req, res, next);

    expect(req.workspaceId).toBe('ws-default');
  });

  it('calls next(err) when no workspace exists', async () => {
    mockFindAllByUserId.mockResolvedValue([]);
    const token = makeToken();
    const { req, res, next } = makeMocks(`Bearer ${token}`);
    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No workspace found for user' }),
    );
  });

  it('defaults role to user when token has no role', async () => {
    const token = jwt.sign({ id: 'u2', email: 'u@t.com', name: 'U' }, JWT_SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeMocks(`Bearer ${token}`);
    await requireAuth(req, res, next);

    expect(req.user.role).toBe('user');
  });
});

describe('optionalAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next without setting user when no auth header', async () => {
    const { req, res, next } = makeMocks();
    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('sets user when valid token provided', async () => {
    const token = makeToken();
    const { req, res, next } = makeMocks(`Bearer ${token}`);
    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-1');
  });

  it('silently ignores invalid token', async () => {
    const { req, res, next } = makeMocks('Bearer bad-token');
    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('calls next even when header format is wrong', async () => {
    const { req, res, next } = makeMocks('NotBearer token');
    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
