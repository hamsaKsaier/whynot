import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindById } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
}));
vi.mock('../../../shared/database/repositories/user-repository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
  })),
}));

import { requireAdmin, requireSuperAdmin } from '../../middleware/admin-auth';

function makeMocks(user?: { id: string }) {
  const req = { user } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no user on request', async () => {
    const { req, res, next } = makeMocks();
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if user is not admin', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', role: 'user' });
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Admin access required' }));
  });

  it('returns 403 if user not found in DB', async () => {
    mockFindById.mockResolvedValue(null);
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next for admin role', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', role: 'admin' });
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next for super_admin role', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', role: 'super_admin' });
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next(err) on thrown error', async () => {
    mockFindById.mockRejectedValue(new Error('db error'));
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('requireSuperAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no user', async () => {
    const { req, res, next } = makeMocks();
    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for regular admin', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', role: 'admin' });
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Super admin access required' }));
  });

  it('returns 403 for regular user', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', role: 'user' });
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next for super_admin', async () => {
    mockFindById.mockResolvedValue({ id: 'u1', role: 'super_admin' });
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next(err) on thrown error', async () => {
    mockFindById.mockRejectedValue(new Error('db error'));
    const { req, res, next } = makeMocks({ id: 'u1' });
    await requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
