import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { UserRepository } from '../../database/repositories/user-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('UserRepository', () => {
  const repo = new UserRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts and returns the new user', async () => {
      const user = { id: '1', email: 'a@b.com', name: 'Test' };
      mockQuery.mockResolvedValue([user]);
      const result = await repo.create({ name: 'Test', email: 'a@b.com' });
      expect(result).toEqual(user);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['a@b.com', null, 'Test', null, null, null],
      );
    });

    it('passes all optional fields when provided', async () => {
      const user = { id: '2', email: 'x@y.com', name: 'Full' };
      mockQuery.mockResolvedValue([user]);
      await repo.create({
        name: 'Full',
        email: 'x@y.com',
        password_hash: 'hash123',
        avatar_url: 'http://img.png',
        github_id: 'gh1',
        google_id: 'g1',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['x@y.com', 'hash123', 'Full', 'http://img.png', 'gh1', 'g1'],
      );
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }]);
      expect(await repo.findById('1')).toEqual({ id: '1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns user when found', async () => {
      mockQuery.mockResolvedValue([{ id: '1', email: 'a@b.com' }]);
      const result = await repo.findByEmail('a@b.com');
      expect(result).toEqual({ id: '1', email: 'a@b.com' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1'),
        ['a@b.com'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByEmail('nope@nope.com')).toBeNull();
    });
  });

  describe('findByGithubId', () => {
    it('returns user when found', async () => {
      mockQuery.mockResolvedValue([{ id: '1', github_id: 'gh1' }]);
      expect(await repo.findByGithubId('gh1')).toEqual({ id: '1', github_id: 'gh1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByGithubId('nope')).toBeNull();
    });
  });

  describe('findByGoogleId', () => {
    it('returns user when found', async () => {
      mockQuery.mockResolvedValue([{ id: '1', google_id: 'g1' }]);
      expect(await repo.findByGoogleId('g1')).toEqual({ id: '1', google_id: 'g1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByGoogleId('nope')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates provided fields and returns user', async () => {
      const updated = { id: '1', name: 'New Name' };
      mockQuery.mockResolvedValue([updated]);
      const result = await repo.update('1', { name: 'New Name' });
      expect(result).toEqual(updated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        ['New Name', '1'],
      );
    });

    it('returns null when user not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { name: 'Test' })).toBeNull();
    });

    it('falls back to findById when no updates provided', async () => {
      const existing = { id: '1', name: 'Test' };
      mockQuery.mockResolvedValue([existing]);
      const result = await repo.update('1', {});
      expect(result).toEqual(existing);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['1'],
      );
    });

    it('builds dynamic SET clause for multiple fields', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }]);
      await repo.update('1', { email: 'new@e.com', name: 'N', avatar_url: 'u', github_id: 'g', google_id: 'go' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        ['new@e.com', 'N', 'u', 'g', 'go', '1'],
      );
    });
  });

  describe('updateRole', () => {
    it('updates role and returns user', async () => {
      mockQuery.mockResolvedValue([{ id: '1', role: 'admin' }]);
      const result = await repo.updateRole('1', 'admin');
      expect(result).toEqual({ id: '1', role: 'admin' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role'),
        ['admin', '1'],
      );
    });

    it('returns null when user not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.updateRole('missing', 'user')).toBeNull();
    });
  });

  describe('findAllPaginated', () => {
    it('returns users and total count without filters', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '42' }])
        .mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);
      const result = await repo.findAllPaginated(0, 10);
      expect(result).toEqual({ users: [{ id: '1' }, { id: '2' }], total: 42 });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('applies search filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ id: '1' }]);
      await repo.findAllPaginated(0, 10, { search: 'test' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%test%']),
      );
    });

    it('applies role filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ id: '1' }]);
      await repo.findAllPaginated(0, 10, { role: 'admin' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('role = $'),
        expect.arrayContaining(['admin']),
      );
    });

    it('applies both search and role filters', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ id: '1' }]);
      await repo.findAllPaginated(0, 10, { search: 'test', role: 'admin' });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('countAll', () => {
    it('returns total user count', async () => {
      mockQuery.mockResolvedValue([{ count: '100' }]);
      expect(await repo.countAll()).toBe(100);
    });

    it('returns 0 when count is empty', async () => {
      mockQuery.mockResolvedValue([{}]);
      expect(await repo.countAll()).toBe(0);
    });
  });
});
