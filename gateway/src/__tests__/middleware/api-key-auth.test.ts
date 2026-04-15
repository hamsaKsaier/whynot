import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));
vi.mock('../../../shared/database/connection', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { generateApiKey, hashApiKey, requireApiKeyAuth } from '../../middleware/api-key-auth';

function makeMocks(authHeader?: string) {
  const req = { headers: { ...(authHeader ? { authorization: authHeader } : {}) } } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('generateApiKey', () => {
  it('returns key, hash, and prefix', () => {
    const result = generateApiKey();

    expect(result.key).toMatch(/^wn_ci_[a-f0-9]{48}$/);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.prefix).toBe(result.key.substring(0, 10));
  });

  it('generates unique keys each time', () => {
    const a = generateApiKey();
    const b = generateApiKey();

    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hash matches crypto.sha256 of key', () => {
    const result = generateApiKey();
    const expected = crypto.createHash('sha256').update(result.key).digest('hex');
    expect(result.hash).toBe(expected);
  });
});

describe('hashApiKey', () => {
  it('returns SHA-256 hex hash of key', () => {
    const key = 'wn_ci_test123';
    const expected = crypto.createHash('sha256').update(key).digest('hex');
    expect(hashApiKey(key)).toBe(expected);
  });

  it('produces same hash for same input', () => {
    expect(hashApiKey('wn_ci_abc')).toBe(hashApiKey('wn_ci_abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashApiKey('wn_ci_abc')).not.toBe(hashApiKey('wn_ci_xyz'));
  });
});

describe('requireApiKeyAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no Authorization header', async () => {
    const { req, res, next } = makeMocks();
    await requireApiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Missing or invalid API key') }),
    );
  });

  it('returns 401 if header does not use wn_ci_ prefix', async () => {
    const { req, res, next } = makeMocks('Bearer regular-jwt-token');
    await requireApiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 if key not found in database', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const { req, res, next } = makeMocks('Bearer wn_ci_abc123');
    await requireApiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid or deactivated API key' }),
    );
  });

  it('sets req.workspaceId and calls next for valid key', async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: 'key-1', workspace_id: 'ws-1', name: 'CI Key', is_active: true }])
      .mockResolvedValue([]); // last_used_at update

    const { req, res, next } = makeMocks('Bearer wn_ci_validkey123');
    await requireApiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.workspaceId).toBe('ws-1');
    expect(req.apiKeyId).toBe('key-1');
    expect(req.apiKeyName).toBe('CI Key');
  });

  it('fires last_used_at update (fire and forget)', async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: 'key-1', workspace_id: 'ws-1', name: 'CI', is_active: true }])
      .mockResolvedValue([]);

    const { req, res, next } = makeMocks('Bearer wn_ci_validkey123');
    await requireApiKeyAuth(req, res, next);

    // Second call should be UPDATE last_used_at
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0]).toContain('UPDATE ci_api_keys SET last_used_at');
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    const { req, res, next } = makeMocks('Bearer wn_ci_validkey123');
    await requireApiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication error' }));
  });
});
