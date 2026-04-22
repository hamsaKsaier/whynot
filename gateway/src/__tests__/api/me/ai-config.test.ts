import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const VALID_KEY = Buffer.from('a'.repeat(32)).toString('base64');
process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;

const mockConfigs: any[] = [];
let auditRows: any[] = [];

vi.mock('../../../../shared/database/repositories/user-ai-config-repository', () => {
  return {
    UserAiConfigRepository: vi.fn().mockImplementation(() => ({
      listByUser: vi.fn(async (userId: string) =>
        mockConfigs.filter((c) => c.user_id === userId)
      ),
      findById: vi.fn(async (id: string, userId: string) =>
        mockConfigs.find((c) => c.id === id && c.user_id === userId) ?? null
      ),
      findDefault: vi.fn(async (userId: string) =>
        mockConfigs.find((c) => c.user_id === userId && c.is_default) ?? null
      ),
      create: vi.fn(async (input: any) => {
        const row = { id: 'cfg-1', ...input, is_default: input.is_default ?? false, created_at: new Date(), updated_at: new Date() };
        mockConfigs.push(row);
        return row;
      }),
      update: vi.fn(async (id: string, userId: string, input: any) => {
        const idx = mockConfigs.findIndex((c) => c.id === id && c.user_id === userId);
        if (idx === -1) return null;
        Object.assign(mockConfigs[idx], input, { updated_at: new Date() });
        return mockConfigs[idx];
      }),
      delete: vi.fn(async (id: string, userId: string) => {
        const idx = mockConfigs.findIndex((c) => c.id === id && c.user_id === userId);
        if (idx === -1) return false;
        mockConfigs.splice(idx, 1);
        return true;
      }),
      setDefault: vi.fn(async (id: string, userId: string) => {
        mockConfigs.forEach((c) => { if (c.user_id === userId) c.is_default = false; });
        const target = mockConfigs.find((c) => c.id === id && c.user_id === userId);
        if (target) target.is_default = true;
        return target ?? null;
      }),
    })),
  };
});

vi.mock('../../../../shared/database/repositories/audit-repository', () => ({
  AuditRepository: vi.fn().mockImplementation(() => ({
    log: vi.fn(async (entry: any) => { auditRows.push(entry); }),
  })),
}));

vi.mock('../../../../shared/logger/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const userId = req.headers['x-test-user-id'] as string;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    req.user = { id: userId, email: `${userId}@test.com`, name: 'Test', role: 'user' };
    next();
  },
}));

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({ text: 'ok' })),
}));

vi.mock('../../../utils/ai/select-ai-provider', () => ({
  selectAIProvider: vi.fn(() => (model: string) => ({ modelId: model })),
}));

import { aiConfigRouter } from '../../../api/me/ai-config';
import { errorHandler } from '../../../middleware/error-handler';
import { encrypt } from '../../../utils/crypto/secret-cipher';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/me/ai-config', aiConfigRouter);
  app.use(errorHandler);
  return app;
}

describe('AI Config Endpoints', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mockConfigs.length = 0;
    auditRows.length = 0;
    app = createApp();
  });

  describe('POST / — create config', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/me/ai-config')
        .send({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test123' });
      expect(res.status).toBe(401);
    });

    it('creates config and returns masked key', async () => {
      const res = await request(app)
        .post('/api/me/ai-config')
        .set('x-test-user-id', 'user-1')
        .send({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test-key-ABCD' });
      expect(res.status).toBe(201);
      expect(res.body.apiKey).toMatch(/^sk-•{5}.{4}$/);
      expect(res.body.apiKey).not.toContain('test-key');
      expect(res.body.provider).toBe('openai');
    });

    it('returns 400 for invalid provider', async () => {
      const res = await request(app)
        .post('/api/me/ai-config')
        .set('x-test-user-id', 'user-1')
        .send({ provider: 'invalid-provider', model: 'x', apiKey: 'sk-test' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when apiKey is missing', async () => {
      const res = await request(app)
        .post('/api/me/ai-config')
        .set('x-test-user-id', 'user-1')
        .send({ provider: 'openai', model: 'gpt-4o' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET / — list configs (masked)', () => {
    it('returns masked API keys matching regex', async () => {
      const { ciphertext, iv, tag } = encrypt('sk-realkey-WXYZ');
      mockConfigs.push({
        id: 'cfg-a', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: 'https://api.openai.com/v1',
        api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: true, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .get('/api/me/ai-config')
        .set('x-test-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      const item = res.body.items[0];
      expect(item.apiKey).toMatch(/^sk-•{5}.{4}$/);
      expect(item.apiKey).toBe('sk-•••••WXYZ');
      expect(item.apiKey).not.toContain('realkey');
    });

    it('returns empty for another user (cross-user isolation)', async () => {
      const { ciphertext, iv, tag } = encrypt('sk-test1234');
      mockConfigs.push({
        id: 'cfg-b', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: null, api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .get('/api/me/ai-config')
        .set('x-test-user-id', 'user-2');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('PUT /:id — update config', () => {
    it('returns 404 for another user\'s config (cross-user 403-equivalent)', async () => {
      const { ciphertext, iv, tag } = encrypt('sk-1234');
      mockConfigs.push({
        id: 'cfg-c', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: null, api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .put('/api/me/ai-config/cfg-c')
        .set('x-test-user-id', 'user-2')
        .send({ model: 'gpt-4o-mini' });

      expect(res.status).toBe(404);
    });

    it('logs ai-config.rotated when apiKey changes', async () => {
      const { ciphertext, iv, tag } = encrypt('sk-old-ABCD');
      mockConfigs.push({
        id: 'cfg-d', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: null, api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      await request(app)
        .put('/api/me/ai-config/cfg-d')
        .set('x-test-user-id', 'user-1')
        .send({ apiKey: 'sk-new-key-EFGH' });

      const rotatedAudit = auditRows.find((r) => r.action === 'ai-config.rotated');
      expect(rotatedAudit).toBeDefined();
    });
  });

  describe('DELETE /:id', () => {
    it('returns 404 for cross-user delete', async () => {
      const { ciphertext, iv, tag } = encrypt('sk-1234');
      mockConfigs.push({
        id: 'cfg-e', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: null, api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .delete('/api/me/ai-config/cfg-e')
        .set('x-test-user-id', 'user-2');

      expect(res.status).toBe(404);
    });

    it('deletes and logs ai-config.revoked', async () => {
      const { ciphertext, iv, tag } = encrypt('sk-1234');
      mockConfigs.push({
        id: 'cfg-f', user_id: 'user-1', provider: 'anthropic', model: 'claude-sonnet-4-6',
        base_url: null, api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .delete('/api/me/ai-config/cfg-f')
        .set('x-test-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(auditRows.find((r) => r.action === 'ai-config.revoked')).toBeDefined();
    });
  });

  describe('PUT /:id/default — set default', () => {
    it('sets only one default per user', async () => {
      const enc1 = encrypt('sk-1111');
      const enc2 = encrypt('sk-2222');
      mockConfigs.push(
        { id: 'cfg-g', user_id: 'user-1', provider: 'openai', model: 'gpt-4o', base_url: null, api_key_encrypted: enc1.ciphertext, api_key_iv: enc1.iv, api_key_tag: enc1.tag, is_default: true, created_at: new Date(), updated_at: new Date() },
        { id: 'cfg-h', user_id: 'user-1', provider: 'anthropic', model: 'claude-sonnet-4-6', base_url: null, api_key_encrypted: enc2.ciphertext, api_key_iv: enc2.iv, api_key_tag: enc2.tag, is_default: false, created_at: new Date(), updated_at: new Date() },
      );

      const res = await request(app)
        .put('/api/me/ai-config/cfg-h/default')
        .set('x-test-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.isDefault).toBe(true);

      const defaults = mockConfigs.filter((c) => c.user_id === 'user-1' && c.is_default);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe('cfg-h');
    });

    it('returns 404 for cross-user set-default', async () => {
      const enc = encrypt('sk-1111');
      mockConfigs.push({
        id: 'cfg-i', user_id: 'user-1', provider: 'openai', model: 'gpt-4o', base_url: null,
        api_key_encrypted: enc.ciphertext, api_key_iv: enc.iv, api_key_tag: enc.tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .put('/api/me/ai-config/cfg-i/default')
        .set('x-test-user-id', 'user-2');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /:id/test — test connection', () => {
    it('returns latency on success', async () => {
      const enc = encrypt('sk-test-WXYZ');
      mockConfigs.push({
        id: 'cfg-j', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: 'https://api.openai.com/v1',
        api_key_encrypted: enc.ciphertext, api_key_iv: enc.iv, api_key_tag: enc.tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .post('/api/me/ai-config/cfg-j/test')
        .set('x-test-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(typeof res.body.latencyMs).toBe('number');
    });

    it('returns 404 for cross-user test', async () => {
      const enc = encrypt('sk-1234');
      mockConfigs.push({
        id: 'cfg-k', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: null, api_key_encrypted: enc.ciphertext, api_key_iv: enc.iv, api_key_tag: enc.tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .post('/api/me/ai-config/cfg-k/test')
        .set('x-test-user-id', 'user-2');

      expect(res.status).toBe(404);
    });
  });

  describe('Audit log invariant — no secrets leaked', () => {
    it('audit rows never contain plaintext API key', async () => {
      const apiKey = 'sk-super-secret-key-NEVER-LEAK';
      await request(app)
        .post('/api/me/ai-config')
        .set('x-test-user-id', 'user-1')
        .send({ provider: 'openai', model: 'gpt-4o', apiKey });

      for (const row of auditRows) {
        const json = JSON.stringify(row);
        expect(json).not.toContain(apiKey);
        expect(json).not.toContain('super-secret');
      }
    });

    it('audit rows never contain base64 ciphertext', async () => {
      const apiKey = 'sk-another-secret-1234';
      await request(app)
        .post('/api/me/ai-config')
        .set('x-test-user-id', 'user-1')
        .send({ provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey });

      for (const row of auditRows) {
        const json = JSON.stringify(row);
        expect(json).not.toContain(Buffer.from(apiKey).toString('base64'));
        expect(json).not.toMatch(/api_key_encrypted/);
        expect(json).not.toMatch(/ciphertext/i);
      }
    });

    it('audit details only contain provider and model', async () => {
      const apiKey = 'sk-check-details-ZZZZ';
      await request(app)
        .post('/api/me/ai-config')
        .set('x-test-user-id', 'user-1')
        .send({ provider: 'google', model: 'gemini-2.0-flash', apiKey });

      const createAudit = auditRows.find((r) => r.action === 'ai-config.set');
      expect(createAudit).toBeDefined();
      expect(Object.keys(createAudit.details)).toEqual(['provider', 'model']);
      expect(createAudit.details.provider).toBe('google');
      expect(createAudit.details.model).toBe('gemini-2.0-flash');
    });
  });

  describe('API key masking format', () => {
    it('masks key matching pattern sk-•••••XXXX', async () => {
      const { ciphertext, iv, tag } = encrypt('key-realvalue-AB12');
      mockConfigs.push({
        id: 'cfg-mask', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: null, api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .get('/api/me/ai-config')
        .set('x-test-user-id', 'user-1');

      expect(res.body.items[0].apiKey).toBe('sk-•••••AB12');
    });

    it('masks short keys (<=4 chars) as ••••', async () => {
      const { ciphertext, iv, tag } = encrypt('abcd');
      mockConfigs.push({
        id: 'cfg-short', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
        base_url: null, api_key_encrypted: ciphertext, api_key_iv: iv, api_key_tag: tag,
        is_default: false, created_at: new Date(), updated_at: new Date(),
      });

      const res = await request(app)
        .get('/api/me/ai-config')
        .set('x-test-user-id', 'user-1');

      expect(res.body.items[0].apiKey).toBe('••••');
    });
  });
});
