import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockEnd = vi.fn();
const mockOn = vi.fn();
const mockRelease = vi.fn();
const mockClientQuery = vi.fn();

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
    on: mockOn,
  })),
}));

vi.mock('../logger/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('database/connection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  describe('getPool', () => {
    it('creates a singleton pool', async () => {
      const { getPool } = await import('../database/connection');
      const pool1 = getPool();
      const pool2 = getPool();
      expect(pool1).toBe(pool2);
    });

    it('creates pool from individual env vars when DATABASE_URL missing', async () => {
      delete process.env.DATABASE_URL;
      process.env.POSTGRES_USER = 'user1';
      process.env.POSTGRES_PASSWORD = 'pass1';
      process.env.POSTGRES_HOST = 'db-host';
      process.env.POSTGRES_PORT = '5433';
      process.env.POSTGRES_DB = 'mydb';

      const { getPool } = await import('../database/connection');
      getPool();

      const { Pool } = await import('pg');
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user1:pass1@db-host:5433/mydb',
        })
      );

      delete process.env.POSTGRES_USER;
      delete process.env.POSTGRES_PASSWORD;
      delete process.env.POSTGRES_HOST;
      delete process.env.POSTGRES_PORT;
      delete process.env.POSTGRES_DB;
    });

    it('registers error and connect event handlers', async () => {
      const { getPool } = await import('../database/connection');
      getPool();
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('error handler logs the error', async () => {
      const { getPool } = await import('../database/connection');
      getPool();
      const errorHandler = mockOn.mock.calls.find((c: any[]) => c[0] === 'error')?.[1];
      expect(() => errorHandler(new Error('pool error'))).not.toThrow();
    });

    it('connect handler logs connection', async () => {
      const { getPool } = await import('../database/connection');
      getPool();
      const connectHandler = mockOn.mock.calls.find((c: any[]) => c[0] === 'connect')?.[1];
      expect(() => connectHandler()).not.toThrow();
    });
  });

  describe('query', () => {
    it('executes query and returns rows', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
      const { query } = await import('../database/connection');
      const result = await query('SELECT 1');
      expect(result).toEqual([{ id: 1 }]);
    });

    it('passes params to pool.query', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const { query } = await import('../database/connection');
      await query('SELECT $1', ['test']);
      expect(mockQuery).toHaveBeenCalledWith('SELECT $1', ['test']);
    });

    it('throws on query error', async () => {
      mockQuery.mockRejectedValue(new Error('query failed'));
      const { query } = await import('../database/connection');
      await expect(query('BAD SQL')).rejects.toThrow('query failed');
    });
  });

  describe('transaction', () => {
    it('commits on success', async () => {
      const client = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(client);
      mockClientQuery.mockResolvedValue({});

      const { transaction } = await import('../database/connection');
      const result = await transaction(async (c) => {
        await c.query('INSERT INTO t VALUES (1)');
        return 'done';
      });

      expect(result).toBe('done');
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('rolls back on error', async () => {
      const client = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(client);
      mockClientQuery.mockResolvedValue({});

      const { transaction } = await import('../database/connection');
      await expect(
        transaction(async () => {
          throw new Error('tx error');
        })
      ).rejects.toThrow('tx error');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('closes the pool', async () => {
      mockEnd.mockResolvedValue(undefined);
      const { getPool, close } = await import('../database/connection');
      getPool();
      await close();
      expect(mockEnd).toHaveBeenCalled();
    });

    it('does nothing when no pool exists', async () => {
      const { close } = await import('../database/connection');
      await close();
      expect(mockEnd).not.toHaveBeenCalled();
    });
  });
});
