import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

import { query } from '../../database/connection';
import { TestCaseRepository } from '../../database/repositories/test-case-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('TestCaseRepository', () => {
  const repo = new TestCaseRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts test case with valid UUID id', async () => {
      const tc = { id: '550e8400-e29b-41d4-a716-446655440000' };
      mockQuery.mockResolvedValue([tc]);
      const result = await repo.create({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        website_url: 'https://example.com',
        steps: [],
      } as any);
      expect(result).toEqual(tc);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_cases'),
        expect.arrayContaining(['550e8400-e29b-41d4-a716-446655440000', 'Test']),
      );
    });

    it('generates UUID when id is not valid UUID format', async () => {
      mockQuery.mockResolvedValue([{ id: 'generated-uuid' }]);
      await repo.create({
        id: 'not-a-uuid',
        name: 'Test',
        website_url: 'https://example.com',
        steps: [{ action: 'click' }],
      } as any);
      // The id param should NOT be 'not-a-uuid' since it generates a new one
      const callParams = mockQuery.mock.calls[0][1];
      expect(callParams[0]).not.toBe('not-a-uuid');
    });

    it('passes workspace_id when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      await repo.create(
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'T',
          website_url: 'https://x.com',
          steps: [],
        } as any,
        'ws1',
      );
      const callParams = mockQuery.mock.calls[0][1];
      expect(callParams[7]).toBe('ws1');
    });
  });

  describe('findById', () => {
    it('returns test case when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      expect(await repo.findById('tc1')).toEqual({ id: 'tc1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });

    it('scopes to workspace when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      await repo.findById('tc1', 'ws1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $2'),
        ['tc1', 'ws1'],
      );
    });
  });

  describe('findByWebsiteUrl', () => {
    it('returns test cases for URL', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      const result = await repo.findByWebsiteUrl('https://example.com');
      expect(result).toEqual([{ id: 'tc1' }]);
    });

    it('scopes to workspace when provided', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.findByWebsiteUrl('https://x.com', 10, 'ws1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $3'),
        ['https://x.com', 10, 'ws1'],
      );
    });
  });

  describe('list', () => {
    it('returns test cases with default pagination', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      const result = await repo.list();
      expect(result).toEqual([{ id: 'tc1' }]);
    });

    it('scopes to workspace when provided', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.list(0, 10, 'ws1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $3'),
        [10, 0, 'ws1'],
      );
    });
  });

  describe('update', () => {
    it('updates provided fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      await repo.update('tc1', { name: 'New Name' } as any);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_cases SET'),
        ['New Name', 'tc1'],
      );
    });

    it('serializes steps and metadata as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      await repo.update('tc1', {
        steps: [{ action: 'click' }],
        metadata: { browser: 'chrome' },
      } as any);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [JSON.stringify([{ action: 'click' }]), JSON.stringify({ browser: 'chrome' }), 'tc1'],
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'tc1' }]);
      await repo.update('tc1', {} as any);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['tc1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { name: 'X' } as any)).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes and returns true', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('tc1')).toBe(true);
    });
  });
});
