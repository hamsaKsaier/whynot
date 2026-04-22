import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

import { query, transaction } from '../../database/connection';
import { UserAiConfigRepository } from '../../database/repositories/user-ai-config-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockTransaction = transaction as ReturnType<typeof vi.fn>;

describe('UserAiConfigRepository', () => {
  const repo = new UserAiConfigRepository();

  beforeEach(() => {
    mockQuery.mockReset();
    mockTransaction.mockReset();
  });

  describe('listByUser', () => {
    it('returns configs for user', async () => {
      mockQuery.mockResolvedValue([{ id: 'c1' }]);
      const result = await repo.listByUser('u1');
      expect(result).toEqual([{ id: 'c1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        ['u1'],
      );
    });
  });

  describe('findById', () => {
    it('returns config when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'c1' }]);
      expect(await repo.findById('c1', 'u1')).toEqual({ id: 'c1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('id = $1 AND user_id = $2'),
        ['c1', 'u1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing', 'u1')).toBeNull();
    });
  });

  describe('findDefault', () => {
    it('returns default config', async () => {
      mockQuery.mockResolvedValue([{ id: 'c1', is_default: true }]);
      expect(await repo.findDefault('u1')).toEqual({ id: 'c1', is_default: true });
    });

    it('returns null when no default', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findDefault('u1')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts config and returns it', async () => {
      const config = { id: 'c1' };
      const encrypted = Buffer.from('enc');
      const iv = Buffer.from('iv');
      const tag = Buffer.from('tag');
      mockQuery.mockResolvedValue([config]);
      const result = await repo.create({
        user_id: 'u1',
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: encrypted,
        api_key_iv: iv,
        api_key_tag: tag,
      });
      expect(result).toEqual(config);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_ai_config'),
        ['u1', 'openai', 'gpt-4', null, encrypted, iv, tag, false],
      );
    });

    it('passes optional fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'c1' }]);
      await repo.create({
        user_id: 'u1',
        provider: 'anthropic',
        model: 'claude-3',
        base_url: 'https://api.example.com',
        api_key_encrypted: Buffer.from('e'),
        api_key_iv: Buffer.from('i'),
        api_key_tag: Buffer.from('t'),
        is_default: true,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['https://api.example.com', true]),
      );
    });
  });

  describe('update', () => {
    it('updates provided fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'c1' }]);
      await repo.update('c1', 'u1', { provider: 'anthropic', model: 'claude-4' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_ai_config SET'),
        ['anthropic', 'claude-4', 'c1', 'u1'],
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'c1' }]);
      await repo.update('c1', 'u1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('id = $1 AND user_id = $2'),
        ['c1', 'u1'],
      );
    });

    it('updates api key fields together', async () => {
      const enc = Buffer.from('enc');
      const iv = Buffer.from('iv');
      const tag = Buffer.from('tag');
      mockQuery.mockResolvedValue([{ id: 'c1' }]);
      await repo.update('c1', 'u1', {
        api_key_encrypted: enc,
        api_key_iv: iv,
        api_key_tag: tag,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('api_key_encrypted'),
        [enc, iv, tag, 'c1', 'u1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', 'u1', { provider: 'x' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValue([{ id: 'c1' }]);
      expect(await repo.delete('c1', 'u1')).toBe(true);
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('missing', 'u1')).toBe(false);
    });
  });

  describe('setDefault', () => {
    it('unsets old default and sets new one via transaction', async () => {
      const config = { id: 'c1', is_default: true };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] }) // unset old
            .mockResolvedValueOnce({ rows: [config] }), // set new
        };
        return cb(mockClient);
      });
      const result = await repo.setDefault('c1', 'u1');
      expect(result).toEqual(config);
    });

    it('returns null when config not found', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return cb(mockClient);
      });
      const result = await repo.setDefault('missing', 'u1');
      expect(result).toBeNull();
    });
  });
});
