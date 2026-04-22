import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { stripeWebhookRouter } from '../api/webhooks/stripe';

const mockVerifyWebhookSignature = vi.fn();
const mockHandleWebhook = vi.fn();
const mockQuery = vi.fn();

vi.mock('../payments/payment-service', () => ({
  PaymentService: {
    stripeProvider: {
      verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
    },
    handleWebhook: (...args: unknown[]) => mockHandleWebhook(...args),
  },
}));

vi.mock('../../shared/database/connection', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock('../payments/audit-logger', () => ({
  writePaymentAuditLog: vi.fn(() => Promise.resolve()),
}));

function createApp() {
  const app = express();
  app.use(stripeWebhookRouter);
  return app;
}

function fakeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_test_123',
    type: 'invoice.paid',
    data: { object: { id: 'inv_1' } },
    ...overrides,
  };
}

describe('POST /api/webhooks/stripe', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.resetAllMocks();
    app = createApp();
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing stripe-signature/);
  });

  it('returns 400 on invalid signature', async () => {
    mockVerifyWebhookSignature.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad_sig')
      .send('{}');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Signature verification failed/);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('returns 200 and dispatches on valid new event', async () => {
    const event = fakeEvent();
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockQuery
      .mockResolvedValueOnce([{ event_id: event.id }]) // INSERT returning row = new
      .mockResolvedValueOnce([]); // UPDATE handled_at
    mockHandleWebhook.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify({ id: 'evt_test_123' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockHandleWebhook).toHaveBeenCalledOnce();
    expect(mockHandleWebhook).toHaveBeenCalledWith(event);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0]).toMatch(/UPDATE.*handled_at/);
  });

  it('returns 200 without dispatch on duplicate event', async () => {
    const event = fakeEvent();
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockQuery.mockResolvedValueOnce([]); // INSERT returns empty = duplicate

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify({ id: 'evt_test_123' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, dedupe: 'duplicate' });
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('returns 200 on unknown event type (no crash)', async () => {
    const event = fakeEvent({ type: 'unknown.event.type' });
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockQuery
      .mockResolvedValueOnce([{ event_id: event.id }])
      .mockResolvedValueOnce([]);
    mockHandleWebhook.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify({ id: 'evt_test_123' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('returns 200 even when dispatch throws (Stripe expects 2xx)', async () => {
    const event = fakeEvent();
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockQuery.mockResolvedValueOnce([{ event_id: event.id }]);
    mockHandleWebhook.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify({ id: 'evt_test_123' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('returns 400 when verified event has no id', async () => {
    mockVerifyWebhookSignature.mockReturnValue({ type: 'invoice.paid' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send('{}');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid event payload/);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('returns 500 when idempotency INSERT throws a DB error', async () => {
    const event = fakeEvent();
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify({ id: 'evt_test_123' }));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal error');
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('returns 400 on malformed body (non-JSON content type)', async () => {
    mockVerifyWebhookSignature.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'some_sig')
      .send('not json {{{');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Signature verification failed/);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('handles non-Error thrown by signature verification', async () => {
    mockVerifyWebhookSignature.mockImplementation(() => {
      throw 'string error';
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad_sig')
      .send('{}');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Signature verification failed/);
  });

  it('handles non-Error thrown by idempotency query', async () => {
    const event = fakeEvent();
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockQuery.mockRejectedValueOnce('db string error');

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify({ id: 'evt_test_123' }));

    expect(res.status).toBe(500);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('handles non-Error thrown by dispatch', async () => {
    const event = fakeEvent();
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockQuery.mockResolvedValueOnce([{ event_id: event.id }]);
    mockHandleWebhook.mockRejectedValue('dispatch string error');

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify({ id: 'evt_test_123' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('concurrent duplicate events produce exactly one dispatch', async () => {
    const event = fakeEvent({ id: 'evt_concurrent' });
    mockVerifyWebhookSignature.mockReturnValue(event);
    mockHandleWebhook.mockResolvedValue(undefined);

    let insertCallCount = 0;
    mockQuery.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO')) {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ event_id: event.id }]);
        }
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const makeReq = () =>
      request(app)
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'valid_sig')
        .send(JSON.stringify({ id: 'evt_concurrent' }));

    const results = await Promise.all([
      makeReq(), makeReq(), makeReq(), makeReq(), makeReq(),
    ]);

    for (const res of results) {
      expect(res.status).toBe(200);
    }
    expect(mockHandleWebhook).toHaveBeenCalledOnce();
  });
});
