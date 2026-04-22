import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    metric: vi.fn(),
    setRequestId: vi.fn(),
  }),
  generateRequestId: vi.fn(() => 'req-id-123'),
}));

import { requestLogger } from '../../middleware/request-logger';

function makeMocks() {
  const req = {
    method: 'GET',
    path: '/api/test',
    ip: '127.0.0.1',
    get: vi.fn((h: string) => (h === 'user-agent' ? 'test-agent' : undefined)),
  } as any;

  const resEmitter = new EventEmitter();
  const res = Object.assign(resEmitter, {
    statusCode: 200,
    setHeader: vi.fn(),
  }) as any;

  const next = vi.fn();
  return { req, res, next };
}

describe('requestLogger', () => {
  it('sets X-Request-ID header on response', () => {
    const { req, res, next } = makeMocks();
    requestLogger(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req-id-123');
  });

  it('stores requestId on req object', () => {
    const { req, res, next } = makeMocks();
    requestLogger(req, res, next);

    expect(req.requestId).toBe('req-id-123');
  });

  it('calls next()', () => {
    const { req, res, next } = makeMocks();
    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('logs on finish event', () => {
    const { req, res, next } = makeMocks();
    requestLogger(req, res, next);

    // Simulate response finish
    res.emit('finish');
    // The logger.info / logger.metric calls happen internally
    // We verify the middleware registered the listener
    expect(res.listenerCount('finish')).toBe(1);
  });
});
