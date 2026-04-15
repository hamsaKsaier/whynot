import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler, asyncHandler, createError, type AppError } from '../../middleware/error-handler';

function makeMocks() {
  const req = { url: '/test', method: 'GET', body: {}, path: '/test', t: vi.fn((k: string) => k) } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 500 for plain Error', () => {
    const { req, res, next } = makeMocks();
    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'boom',
        path: '/test',
      }),
    );
  });

  it('uses statusCode from AppError', () => {
    const { req, res, next } = makeMocks();
    const err = createError('Not found', 404, 'NOT_FOUND');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Not found' }),
    );
  });

  it('includes stack and details in non-production', () => {
    const { req, res, next } = makeMocks();
    const err = createError('bad', 400, 'BAD', { field: 'email' });
    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeDefined();
    expect(body.details).toEqual({ field: 'email' });
  });

  it('does not include stack/details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { req, res, next } = makeMocks();
      const err = createError('bad', 400, 'BAD', { field: 'email' });
      errorHandler(err, req, res, next);

      const body = res.json.mock.calls[0][0];
      expect(body.stack).toBeUndefined();
      expect(body.details).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('handles ECONNREFUSED with service unavailable', () => {
    const { req, res, next } = makeMocks();
    const err = createError('connection refused', 500, 'ECONNREFUSED');
    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('errors:service.unavailable');
    expect(body.suggestion).toBe('errors:server.serviceUnavailableSuggestion');
  });

  it('handles ETIMEDOUT with timeout message', () => {
    const { req, res, next } = makeMocks();
    const err = createError('timed out', 500, 'ETIMEDOUT');
    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('errors:service.timeout');
    expect(body.suggestion).toBe('errors:server.timeoutSuggestion');
  });

  it('falls back to key lookup when req.t is missing', () => {
    const { res, next } = makeMocks();
    const req = { url: '/test', method: 'GET', body: {}, path: '/test' } as any;
    const err = new Error('');
    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('errors:server.internal');
  });

  it('includes ISO 8601 timestamp', () => {
    const { req, res, next } = makeMocks();
    errorHandler(new Error('x'), req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('asyncHandler', () => {
  it('calls next with error if async function rejects', async () => {
    const { req, res, next } = makeMocks();
    const handler = asyncHandler(async () => {
      throw new Error('async fail');
    });

    handler(req, res, next);
    // Allow microtask to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not call next on success', async () => {
    const { req, res, next } = makeMocks();
    const handler = asyncHandler(async (_req, resObj) => {
      resObj.status(200).json({ ok: true });
    });

    handler(req, res, next);
    await new Promise((r) => setTimeout(r, 10));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('createError', () => {
  it('creates an error with all fields', () => {
    const err = createError('test', 422, 'VALIDATION', { field: 'x' });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION');
    expect(err.details).toEqual({ field: 'x' });
  });

  it('defaults statusCode to 500', () => {
    const err = createError('internal');
    expect(err.statusCode).toBe(500);
  });

  it('allows optional code and details', () => {
    const err = createError('simple', 400);
    expect(err.code).toBeUndefined();
    expect(err.details).toBeUndefined();
  });
});
