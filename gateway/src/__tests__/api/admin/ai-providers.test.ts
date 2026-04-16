import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const VALID_KEY = Buffer.from('a'.repeat(32)).toString('base64');
process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;

// ─── Hoisted mock state (accessible inside vi.mock factories) ────────────────

const { mockPlatformKeyCache, mockState } = vi.hoisted(() => {
  return {
    mockPlatformKeyCache: {
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
      get: vi.fn(() => null),
      set: vi.fn(),
    },
    mockState: {
      auditRows: [] as any[],
      billingStore: {} as Record<string, string>,
      platformConfigs: [] as any[],
    },
  };
});

// Direct access via mockState.auditRows, mockState.billingStore, mockState.platformConfigs

function seedProviders() {
  mockState.platformConfigs.length = 0;
  for (const [provider, displayName, defaultModel, models] of [
    ['anthropic', 'Anthropic', 'claude-sonnet-4-6', ['claude-opus-4-6', 'claude-sonnet-4-6']],
    ['google', 'Google AI', 'gemini-2.0-flash', ['gemini-2.0-flash', 'gemini-1.5-pro']],
    ['openai', 'OpenAI', 'gpt-4o', ['gpt-4o', 'gpt-4o-mini']],
    ['openrouter', 'OpenRouter', 'anthropic/claude-sonnet-4', ['anthropic/claude-sonnet-4', 'openai/gpt-4o']],
  ] as const) {
    mockState.platformConfigs.push({
      id: `id-${provider}`,
      provider,
      display_name: displayName,
      hasKey: false,
      hasFallbackKey: false,
      maskedKey: null,
      maskedFallbackKey: null,
      default_model: defaultModel,
      models: [...models],
      is_active: false,
      rate_limit: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}

function findMockProvider(provider: string) {
  return mockState.platformConfigs.find((c: any) => c.provider === provider) ?? null;
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../../../shared/database/repositories/platform-ai-config-repository', () => ({
  PlatformAiConfigRepository: vi.fn().mockImplementation(() => {
    function find(provider: string) {
      return mockState.platformConfigs.find((c: any) => c.provider === provider) ?? null;
    }
    return {
      listAll: vi.fn(async () => [...mockState.platformConfigs].sort((a: any, b: any) => a.provider.localeCompare(b.provider))),
      findByProvider: vi.fn(async (provider: string) => find(provider)),
      findActive: vi.fn(async () => mockState.platformConfigs.filter((c: any) => c.is_active)),
      upsertKey: vi.fn(async (provider: string, _apiKey: string) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        p.hasKey = true;
        p.is_active = true;
        p.maskedKey = `sk-•••••${_apiKey.slice(-4)}`;
        return p;
      }),
      upsertFallbackKey: vi.fn(async (provider: string, _apiKey: string) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        p.hasFallbackKey = true;
        p.maskedFallbackKey = `sk-•••••${_apiKey.slice(-4)}`;
        return p;
      }),
      removeKey: vi.fn(async (provider: string) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        p.hasKey = false;
        p.maskedKey = null;
        p.is_active = false;
        return p;
      }),
      removeFallbackKey: vi.fn(async (provider: string) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        p.hasFallbackKey = false;
        p.maskedFallbackKey = null;
        return p;
      }),
      getDecryptedKey: vi.fn(async (provider: string) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        return p.hasKey ? 'decrypted-primary-key' : null;
      }),
      getDecryptedFallbackKey: vi.fn(async (provider: string) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        return p.hasFallbackKey ? 'decrypted-fallback-key' : null;
      }),
      setActive: vi.fn(async (provider: string, active: boolean) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        if (active && !p.hasKey) throw new Error('ai.cannotActivateWithoutKey');
        p.is_active = active;
        return p;
      }),
      updateRateLimit: vi.fn(async (provider: string, rateLimit: number) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        p.rate_limit = rateLimit;
        return p;
      }),
      updateDefaultModel: vi.fn(async (provider: string, model: string) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        p.default_model = model;
        return p;
      }),
      updateModels: vi.fn(async (provider: string, models: string[]) => {
        const p = find(provider);
        if (!p) throw new Error('ai.providerNotFound');
        p.models = models;
        return p;
      }),
    };
  }),
}));

vi.mock('../../../../shared/database/repositories/billing-config-repository', () => ({
  BillingConfigRepository: vi.fn().mockImplementation(() => ({
    get: vi.fn(async (key: string) => mockState.billingStore[key] ?? null),
    set: vi.fn(async (key: string, value: string) => { mockState.billingStore[key] = value; }),
    getDefaultAiProvider: vi.fn(async () => {
      const v = mockState.billingStore['default_ai_provider'];
      return v ? JSON.parse(v) : null;
    }),
    setDefaultAiProvider: vi.fn(async (provider: string, model: string) => {
      mockState.billingStore['default_ai_provider'] = JSON.stringify({ provider, model });
    }),
    getAiFallbackOrder: vi.fn(async () => {
      const v = mockState.billingStore['ai_fallback_order'];
      return v ? JSON.parse(v) : [];
    }),
    setAiFallbackOrder: vi.fn(async (order: string[]) => {
      mockState.billingStore['ai_fallback_order'] = JSON.stringify(order);
    }),
  })),
}));

vi.mock('../../../../shared/database/repositories/audit-repository', () => ({
  AuditRepository: vi.fn().mockImplementation(() => ({
    log: vi.fn(async (entry: any) => { mockState.auditRows.push(entry); }),
  })),
}));

vi.mock('../../../utils/ai/platform-key-cache', () => ({
  platformKeyCache: mockPlatformKeyCache,
}));

vi.mock('../../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const userId = req.headers['x-test-user-id'] as string;
    const role = req.headers['x-test-user-role'] as string || 'user';
    if (!userId) return _res.status(401).json({ success: false, error: 'Authentication required' });
    req.user = { id: userId, email: `${userId}@test.com`, name: 'Test', role };
    next();
  },
}));

vi.mock('../../../middleware/admin-auth', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
  },
}));

vi.mock('../../../../shared/logger/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({ text: 'ok' })),
}));

vi.mock('../../../utils/ai/select-ai-provider', () => ({
  selectAIProvider: vi.fn(() => (model: string) => ({ modelId: model })),
}));

vi.mock('../../../utils/ai/provider-base-url', () => ({
  providerBaseUrl: vi.fn(() => 'https://api.example.com'),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { PlatformAiConfigRepository } from '../../../../shared/database/repositories/platform-ai-config-repository';
import { DecryptionKeyMismatchError } from '../../../utils/crypto/secret-cipher';
import { BillingConfigRepository } from '../../../../shared/database/repositories/billing-config-repository';
import { AuditRepository } from '../../../../shared/database/repositories/audit-repository';
import { errorHandler, asyncHandler, createError } from '../../../middleware/error-handler';
import { requireAuth } from '../../../middleware/auth';
import { requireSuperAdmin } from '../../../middleware/admin-auth';
import { platformKeyCache } from '../../../utils/ai/platform-key-cache';
import { generateText } from 'ai';
import { selectAIProvider } from '../../../utils/ai/select-ai-provider';
import { providerBaseUrl } from '../../../utils/ai/provider-base-url';
import type { AIProviderName } from '../../../utils/ai/detect-provider';

// ─── Build mini app that mirrors main.ts admin AI routes ─────────────────────

const KNOWN_AI_PROVIDERS = ['openai', 'anthropic', 'google', 'openrouter'] as const;

function isKnownProvider(p: string): p is (typeof KNOWN_AI_PROVIDERS)[number] {
  return (KNOWN_AI_PROVIDERS as readonly string[]).includes(p);
}

function createApp() {
  const app = express();
  app.use(express.json());

  const platformAiConfigRepository = new PlatformAiConfigRepository();
  const billingConfigRepository = new BillingConfigRepository();
  const auditRepository = new AuditRepository();

  function auditLog(req: any, action: string, targetType?: string, targetId?: string, details?: Record<string, any>) {
    auditRepository.log({
      actor_id: req.user?.id,
      actor_email: req.user?.email || undefined,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent'],
    }).catch(() => {});
  }

  // i18n stub
  app.use((req: any, _res, next) => {
    req.t = (key: string, params?: any) => {
      let msg = key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          msg = msg.replace(`{{${k}}}`, String(v));
        }
      }
      return msg;
    };
    next();
  });

  // GET /api/admin/ai-providers
  app.get('/api/admin/ai-providers', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
    const [configs, defaultProvider, fallbackOrder] = await Promise.all([
      platformAiConfigRepository.listAll(),
      billingConfigRepository.getDefaultAiProvider(),
      billingConfigRepository.getAiFallbackOrder(),
    ]);
    const providers = configs.map((c: any) => ({
      provider: c.provider,
      displayName: c.display_name,
      enabled: c.is_active,
      rateLimit: c.rate_limit,
      hasKey: c.hasKey,
      hasFallbackKey: c.hasFallbackKey,
      maskedKey: c.maskedKey,
      maskedFallbackKey: c.maskedFallbackKey,
      defaultModel: c.default_model || '',
      models: c.models || [],
    }));
    res.json({
      success: true,
      providers,
      defaultProvider: defaultProvider || { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      fallbackOrder: fallbackOrder.length > 0 ? fallbackOrder : [...KNOWN_AI_PROVIDERS],
    });
  }));

  // PATCH /api/admin/ai-providers
  app.patch('/api/admin/ai-providers', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { providers } = req.body;
    if (!Array.isArray(providers)) {
      throw createError('Body must contain a "providers" array', 400, 'INVALID_BODY');
    }
    for (const entry of providers) {
      if (!entry || typeof entry !== 'object') throw createError('Invalid entry', 400, 'INVALID_ENTRY');
      if (typeof entry.provider !== 'string' || !isKnownProvider(entry.provider)) {
        throw createError(`Unknown provider: ${entry.provider}`, 400, 'INVALID_ENTRY');
      }
    }
    for (const entry of providers) {
      const provider = entry.provider as string;
      if (typeof entry.enabled === 'boolean') {
        await platformAiConfigRepository.setActive(provider, entry.enabled);
      }
      if (entry.rateLimit !== undefined) {
        const rl = Number(entry.rateLimit);
        if (!Number.isInteger(rl) || rl < 0) throw createError('Invalid rate limit', 400, 'INVALID_ENTRY');
        await platformAiConfigRepository.updateRateLimit(provider, rl);
      }
      if (typeof entry.defaultModel === 'string' && entry.defaultModel.length > 0) {
        await platformAiConfigRepository.updateDefaultModel(provider, entry.defaultModel);
      }
      if (Array.isArray(entry.models)) {
        await platformAiConfigRepository.updateModels(provider, entry.models);
      }
      platformKeyCache.invalidate(provider);
    }
    auditLog(req, 'ai_providers.update', 'platform_ai_config', undefined, {
      updatedProviders: providers.map((p: any) => p.provider),
    });
    const [allConfigs, defaultProvider, fallbackOrder] = await Promise.all([
      platformAiConfigRepository.listAll(),
      billingConfigRepository.getDefaultAiProvider(),
      billingConfigRepository.getAiFallbackOrder(),
    ]);
    res.json({
      success: true,
      providers: allConfigs.map((c: any) => ({
        provider: c.provider, displayName: c.display_name, enabled: c.is_active,
        rateLimit: c.rate_limit, hasKey: c.hasKey, hasFallbackKey: c.hasFallbackKey,
        maskedKey: c.maskedKey, maskedFallbackKey: c.maskedFallbackKey,
        defaultModel: c.default_model || '', models: c.models || [],
      })),
      defaultProvider: defaultProvider || { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      fallbackOrder: fallbackOrder.length > 0 ? fallbackOrder : [...KNOWN_AI_PROVIDERS],
    });
  }));

  // POST /api/admin/ai-providers/:provider/key
  app.post('/api/admin/ai-providers/:provider/key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { provider } = req.params;
    if (!isKnownProvider(provider)) throw createError(`Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) throw createError('API key is required', 400, 'KEY_REQUIRED');
    if (apiKey.length > 500) throw createError('API key exceeds maximum length', 400, 'KEY_TOO_LONG');
    const updated = await platformAiConfigRepository.upsertKey(provider, apiKey.trim());
    platformKeyCache.invalidate(provider);
    auditLog(req, 'ai-provider.key-set', 'platform_ai_config', provider, { provider });
    res.json({ success: true, provider, hasKey: true, maskedKey: (updated as any).maskedKey });
  }));

  // DELETE /api/admin/ai-providers/:provider/key
  app.delete('/api/admin/ai-providers/:provider/key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { provider } = req.params;
    if (!isKnownProvider(provider)) throw createError(`Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
    await platformAiConfigRepository.removeKey(provider);
    platformKeyCache.invalidate(provider);
    auditLog(req, 'ai-provider.key-removed', 'platform_ai_config', provider, { provider });
    res.json({ success: true, provider, hasKey: false });
  }));

  // POST /api/admin/ai-providers/:provider/fallback-key
  app.post('/api/admin/ai-providers/:provider/fallback-key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { provider } = req.params;
    if (!isKnownProvider(provider)) throw createError(`Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) throw createError('API key is required', 400, 'KEY_REQUIRED');
    if (apiKey.length > 500) throw createError('API key exceeds maximum length', 400, 'KEY_TOO_LONG');
    const updated = await platformAiConfigRepository.upsertFallbackKey(provider, apiKey.trim());
    platformKeyCache.invalidate(provider);
    auditLog(req, 'ai-provider.fallback-key-set', 'platform_ai_config', provider, { provider });
    res.json({ success: true, provider, hasFallbackKey: true, maskedFallbackKey: (updated as any).maskedFallbackKey });
  }));

  // DELETE /api/admin/ai-providers/:provider/fallback-key
  app.delete('/api/admin/ai-providers/:provider/fallback-key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { provider } = req.params;
    if (!isKnownProvider(provider)) throw createError(`Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
    await platformAiConfigRepository.removeFallbackKey(provider);
    platformKeyCache.invalidate(provider);
    auditLog(req, 'ai-provider.fallback-key-removed', 'platform_ai_config', provider, { provider });
    res.json({ success: true, provider, hasFallbackKey: false });
  }));

  // POST /api/admin/ai-providers/:provider/test
  app.post('/api/admin/ai-providers/:provider/test', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { provider } = req.params;
    if (!isKnownProvider(provider)) throw createError(`Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
    const useFallback = req.query.useFallback === 'true';
    let apiKey: string | null;
    try {
      apiKey = useFallback
        ? await platformAiConfigRepository.getDecryptedFallbackKey(provider)
        : await platformAiConfigRepository.getDecryptedKey(provider);
    } catch (err) {
      if (err instanceof DecryptionKeyMismatchError) {
        res.json({
          success: false,
          error: `Stored API key for ${provider} can no longer be decrypted (encryption key changed). Please re-enter the key.`,
          code: 'KEY_DECRYPT_FAILED',
          provider,
        });
        return;
      }
      throw err;
    }
    if (!apiKey) {
      res.json({ success: false, error: `No API key configured for ${provider}`, provider });
      return;
    }
    const config = await platformAiConfigRepository.findByProvider(provider);
    const model = (config as any)?.default_model || '';
    const apiUrl = providerBaseUrl(provider as AIProviderName);
    const start = Date.now();
    try {
      const aiProvider = selectAIProvider({ apiUrl: apiUrl as string, apiKey, provider: provider as AIProviderName });
      await generateText({ model: (aiProvider as any)(model), prompt: 'Say "ok"', maxOutputTokens: 1 });
      const latencyMs = Date.now() - start;
      res.json({ success: true, ok: true, latencyMs, provider });
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      res.json({ success: true, ok: false, error: err.message || 'Connection test failed', latencyMs, provider });
    }
  }));

  // PATCH /api/admin/ai-providers/default-model
  app.patch('/api/admin/ai-providers/default-model', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { provider, model } = req.body;
    if (!provider || typeof provider !== 'string' || !isKnownProvider(provider)) {
      throw createError(`Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
    }
    if (!model || typeof model !== 'string') throw createError('Model is required', 400, 'INVALID_MODEL');
    const config = await platformAiConfigRepository.findByProvider(provider);
    if (!config || !(config as any).is_active) {
      throw createError(`Provider ${provider} is not active`, 400, 'PROVIDER_NOT_ACTIVE');
    }
    if ((config as any).models.length > 0 && !(config as any).models.includes(model)) {
      throw createError(`Model ${model} is not available for ${provider}`, 400, 'MODEL_NOT_AVAILABLE');
    }
    await billingConfigRepository.setDefaultAiProvider(provider, model);
    platformKeyCache.invalidate();
    auditLog(req, 'ai-provider.default-changed', 'platform_ai_config', provider, { provider, model });
    res.json({ success: true, defaultProvider: { provider, model } });
  }));

  // PATCH /api/admin/ai-providers/fallback-order
  app.patch('/api/admin/ai-providers/fallback-order', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
    const { order } = req.body;
    if (!Array.isArray(order)) throw createError('Fallback order must be an array', 400, 'INVALID_ORDER');
    const uniqueOrder = new Set(order);
    if (uniqueOrder.size !== order.length) throw createError('No duplicates', 400, 'INVALID_ORDER');
    for (const p of order) {
      if (!isKnownProvider(p)) throw createError(`Unknown provider: ${p}`, 400, 'INVALID_ORDER');
    }
    if (order.length !== KNOWN_AI_PROVIDERS.length) throw createError('Must include all providers', 400, 'INVALID_ORDER');
    await billingConfigRepository.setAiFallbackOrder(order);
    platformKeyCache.invalidate();
    auditLog(req, 'ai-provider.fallback-order-changed', 'platform_ai_config', undefined, { order });
    res.json({ success: true, fallbackOrder: order });
  }));

  // User endpoint
  app.get('/api/me/ai-providers', requireAuth, asyncHandler(async (_req, res) => {
    const configs = await platformAiConfigRepository.findActive();
    const allowed = (configs as any[]).map((c: any) => c.provider);
    res.json({ success: true, providers: allowed });
  }));

  app.use(errorHandler);
  return app;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ADMIN_HEADERS = { 'x-test-user-id': 'admin-1', 'x-test-user-role': 'superadmin' };
const USER_HEADERS = { 'x-test-user-id': 'user-1', 'x-test-user-role': 'user' };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Admin AI Providers API', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    seedProviders();
    mockState.auditRows.length = 0;
    mockState.billingStore = {};
    mockPlatformKeyCache.invalidate.mockClear();
    mockPlatformKeyCache.invalidateAll.mockClear();
    app = createApp();
  });

  // ─── GET /api/admin/ai-providers ────────────────────────────────────────

  describe('GET /api/admin/ai-providers', () => {
    it('returns all 4 providers with correct shape', async () => {
      const res = await request(app).get('/api/admin/ai-providers').set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.providers).toHaveLength(4);
      const first = res.body.providers[0];
      expect(first).toHaveProperty('provider');
      expect(first).toHaveProperty('displayName');
      expect(first).toHaveProperty('enabled');
      expect(first).toHaveProperty('rateLimit');
      expect(first).toHaveProperty('hasKey');
      expect(first).toHaveProperty('hasFallbackKey');
      expect(first).toHaveProperty('maskedKey');
      expect(first).toHaveProperty('maskedFallbackKey');
      expect(first).toHaveProperty('defaultModel');
      expect(first).toHaveProperty('models');
    });

    it('returns hasKey: false for all initially', async () => {
      const res = await request(app).get('/api/admin/ai-providers').set(ADMIN_HEADERS);
      for (const p of res.body.providers) {
        expect(p.hasKey).toBe(false);
        expect(p.maskedKey).toBeNull();
      }
    });

    it('returns defaultProvider and fallbackOrder', async () => {
      const res = await request(app).get('/api/admin/ai-providers').set(ADMIN_HEADERS);
      expect(res.body.defaultProvider).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
      expect(res.body.fallbackOrder).toEqual(['openai', 'anthropic', 'google', 'openrouter']);
    });

    it('returns correct defaultProvider from billing_config', async () => {
      mockState.billingStore['default_ai_provider'] = JSON.stringify({ provider: 'openai', model: 'gpt-4o' });
      const res = await request(app).get('/api/admin/ai-providers').set(ADMIN_HEADERS);
      expect(res.body.defaultProvider).toEqual({ provider: 'openai', model: 'gpt-4o' });
    });

    it('returns 403 for non-superadmin', async () => {
      const res = await request(app).get('/api/admin/ai-providers').set(USER_HEADERS);
      expect(res.status).toBe(403);
    });

    it('returns 401 for unauthenticated', async () => {
      const res = await request(app).get('/api/admin/ai-providers');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/admin/ai-providers/:provider/key ─────────────────────────

  describe('POST /api/admin/ai-providers/:provider/key', () => {
    it('sets key and returns maskedKey with last 4 chars', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-proj-abc123XYZ9' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.hasKey).toBe(true);
      expect(res.body.maskedKey).toContain('XYZ9');
      expect(res.body.provider).toBe('openai');
    });

    it('auto-enables provider', async () => {
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });
      const p = findMockProvider('openai');
      expect(p.is_active).toBe(true);
    });

    it('invalidates cache', async () => {
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });
      expect(mockPlatformKeyCache.invalidate).toHaveBeenCalledWith('openai');
    });

    it('creates audit log entry', async () => {
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });
      const entry = mockState.auditRows.find((r) => r.action === 'ai-provider.key-set');
      expect(entry).toBeDefined();
      expect(entry.details.provider).toBe('openai');
      expect(entry.details).not.toHaveProperty('apiKey');
    });

    it('returns 400 for invalid provider', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/invalid-provider/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for empty apiKey', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing apiKey', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 403 for non-superadmin', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(USER_HEADERS)
        .send({ apiKey: 'sk-test1234' });
      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /api/admin/ai-providers/:provider/key ───────────────────────

  describe('DELETE /api/admin/ai-providers/:provider/key', () => {
    it('removes key and sets hasKey: false', async () => {
      // First set a key
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });

      const res = await request(app)
        .delete('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.hasKey).toBe(false);
    });

    it('auto-disables provider', async () => {
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });

      await request(app)
        .delete('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS);
      const p = findMockProvider('openai');
      expect(p.is_active).toBe(false);
    });

    it('creates audit log entry', async () => {
      await request(app)
        .delete('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS);
      const entry = mockState.auditRows.find((r) => r.action === 'ai-provider.key-removed');
      expect(entry).toBeDefined();
    });
  });

  // ─── POST /api/admin/ai-providers/:provider/fallback-key ───────────────

  describe('POST /api/admin/ai-providers/:provider/fallback-key', () => {
    it('stores fallback key and returns masked', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/anthropic/fallback-key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-fallback-ABCD' });
      expect(res.status).toBe(200);
      expect(res.body.hasFallbackKey).toBe(true);
      expect(res.body.maskedFallbackKey).toContain('ABCD');
    });

    it('creates audit log entry', async () => {
      await request(app)
        .post('/api/admin/ai-providers/anthropic/fallback-key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-fallback-ABCD' });
      const entry = mockState.auditRows.find((r) => r.action === 'ai-provider.fallback-key-set');
      expect(entry).toBeDefined();
    });
  });

  // ─── DELETE /api/admin/ai-providers/:provider/fallback-key ──────────────

  describe('DELETE /api/admin/ai-providers/:provider/fallback-key', () => {
    it('removes fallback key', async () => {
      await request(app)
        .post('/api/admin/ai-providers/anthropic/fallback-key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-fallback-ABCD' });

      const res = await request(app)
        .delete('/api/admin/ai-providers/anthropic/fallback-key')
        .set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.hasFallbackKey).toBe(false);
    });

    it('creates audit log entry', async () => {
      await request(app)
        .delete('/api/admin/ai-providers/anthropic/fallback-key')
        .set(ADMIN_HEADERS);
      const entry = mockState.auditRows.find((r) => r.action === 'ai-provider.fallback-key-removed');
      expect(entry).toBeDefined();
    });
  });

  // ─── POST /api/admin/ai-providers/:provider/test ────────────────────────

  describe('POST /api/admin/ai-providers/:provider/test', () => {
    it('returns ok: true with latencyMs when key configured', async () => {
      // Set a key first
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });

      const res = await request(app)
        .post('/api/admin/ai-providers/openai/test')
        .set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(typeof res.body.latencyMs).toBe('number');
      expect(res.body.provider).toBe('openai');
    });

    it('returns error when no key configured', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/openai/test')
        .set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No API key configured');
    });

    it('tests fallback key with ?useFallback=true', async () => {
      await request(app)
        .post('/api/admin/ai-providers/openai/fallback-key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-fallback1234' });

      const res = await request(app)
        .post('/api/admin/ai-providers/openai/test?useFallback=true')
        .set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns ok: false when AI call fails', async () => {
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });

      // Make generateText throw
      const { generateText: mockGen } = await import('ai');
      (mockGen as any).mockRejectedValueOnce(new Error('Invalid API key'));

      const res = await request(app)
        .post('/api/admin/ai-providers/openai/test')
        .set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Invalid API key');
    });

    it('returns 403 for non-superadmin', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/openai/test')
        .set(USER_HEADERS);
      expect(res.status).toBe(403);
    });

    it('returns KEY_DECRYPT_FAILED when stored key cannot be decrypted', async () => {
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });

      const repoInstance = vi
        .mocked(PlatformAiConfigRepository)
        .mock.results.at(-1)?.value;
      (repoInstance.getDecryptedKey as any).mockRejectedValueOnce(
        new DecryptionKeyMismatchError(),
      );

      const res = await request(app)
        .post('/api/admin/ai-providers/openai/test')
        .set(ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('KEY_DECRYPT_FAILED');
      expect(res.body.provider).toBe('openai');
      expect(res.body.error).toContain('can no longer be decrypted');
    });
  });

  // ─── PATCH /api/admin/ai-providers/default-model ────────────────────────

  describe('PATCH /api/admin/ai-providers/default-model', () => {
    beforeEach(async () => {
      // Activate openai so it can be set as default
      const p = findMockProvider('openai');
      p.hasKey = true;
      p.is_active = true;
    });

    it('sets default model and returns it', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers/default-model')
        .set(ADMIN_HEADERS)
        .send({ provider: 'openai', model: 'gpt-4o' });
      expect(res.status).toBe(200);
      expect(res.body.defaultProvider).toEqual({ provider: 'openai', model: 'gpt-4o' });
    });

    it('verifies via GET', async () => {
      await request(app)
        .patch('/api/admin/ai-providers/default-model')
        .set(ADMIN_HEADERS)
        .send({ provider: 'openai', model: 'gpt-4o-mini' });

      const res = await request(app).get('/api/admin/ai-providers').set(ADMIN_HEADERS);
      expect(res.body.defaultProvider).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    });

    it('rejects inactive provider', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers/default-model')
        .set(ADMIN_HEADERS)
        .send({ provider: 'google', model: 'gemini-2.0-flash' });
      expect(res.status).toBe(400);
    });

    it('rejects model not in provider models list', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers/default-model')
        .set(ADMIN_HEADERS)
        .send({ provider: 'openai', model: 'nonexistent-model' });
      expect(res.status).toBe(400);
    });

    it('creates audit log entry', async () => {
      await request(app)
        .patch('/api/admin/ai-providers/default-model')
        .set(ADMIN_HEADERS)
        .send({ provider: 'openai', model: 'gpt-4o' });
      const entry = mockState.auditRows.find((r) => r.action === 'ai-provider.default-changed');
      expect(entry).toBeDefined();
      expect(entry.details).toEqual({ provider: 'openai', model: 'gpt-4o' });
    });
  });

  // ─── PATCH /api/admin/ai-providers/fallback-order ───────────────────────

  describe('PATCH /api/admin/ai-providers/fallback-order', () => {
    it('sets order and verifies via GET', async () => {
      const order = ['anthropic', 'openai', 'google', 'openrouter'];
      const res = await request(app)
        .patch('/api/admin/ai-providers/fallback-order')
        .set(ADMIN_HEADERS)
        .send({ order });
      expect(res.status).toBe(200);
      expect(res.body.fallbackOrder).toEqual(order);

      const getRes = await request(app).get('/api/admin/ai-providers').set(ADMIN_HEADERS);
      expect(getRes.body.fallbackOrder).toEqual(order);
    });

    it('rejects unknown providers', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers/fallback-order')
        .set(ADMIN_HEADERS)
        .send({ order: ['anthropic', 'openai', 'google', 'unknown'] });
      expect(res.status).toBe(400);
    });

    it('rejects duplicates', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers/fallback-order')
        .set(ADMIN_HEADERS)
        .send({ order: ['anthropic', 'openai', 'openai', 'google'] });
      expect(res.status).toBe(400);
    });

    it('rejects incomplete list', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers/fallback-order')
        .set(ADMIN_HEADERS)
        .send({ order: ['anthropic', 'openai'] });
      expect(res.status).toBe(400);
    });

    it('creates audit log entry', async () => {
      const order = ['openrouter', 'google', 'openai', 'anthropic'];
      await request(app)
        .patch('/api/admin/ai-providers/fallback-order')
        .set(ADMIN_HEADERS)
        .send({ order });
      const entry = mockState.auditRows.find((r) => r.action === 'ai-provider.fallback-order-changed');
      expect(entry).toBeDefined();
      expect(entry.details.order).toEqual(order);
    });
  });

  // ─── Key masking ────────────────────────────────────────────────────────

  describe('Key masking', () => {
    it('masks key showing last 4 chars', async () => {
      const res = await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-proj-abc123XYZ9' });
      expect(res.body.maskedKey).toMatch(/sk-•{5}XYZ9/);
    });

    it('null key returns null in GET', async () => {
      const res = await request(app).get('/api/admin/ai-providers').set(ADMIN_HEADERS);
      const openai = res.body.providers.find((p: any) => p.provider === 'openai');
      expect(openai.maskedKey).toBeNull();
    });
  });

  // ─── Cache invalidation ─────────────────────────────────────────────────

  describe('Cache invalidation', () => {
    it('key set invalidates cache', async () => {
      mockPlatformKeyCache.invalidate.mockClear();
      await request(app)
        .post('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });
      expect(mockPlatformKeyCache.invalidate).toHaveBeenCalledWith('openai');
    });

    it('key delete invalidates cache', async () => {
      mockPlatformKeyCache.invalidate.mockClear();
      await request(app)
        .delete('/api/admin/ai-providers/openai/key')
        .set(ADMIN_HEADERS);
      expect(mockPlatformKeyCache.invalidate).toHaveBeenCalledWith('openai');
    });

    it('fallback key set invalidates cache', async () => {
      mockPlatformKeyCache.invalidate.mockClear();
      await request(app)
        .post('/api/admin/ai-providers/openai/fallback-key')
        .set(ADMIN_HEADERS)
        .send({ apiKey: 'sk-test1234' });
      expect(mockPlatformKeyCache.invalidate).toHaveBeenCalledWith('openai');
    });

    it('default-model invalidates entire cache', async () => {
      const p = findMockProvider('openai');
      p.hasKey = true;
      p.is_active = true;
      mockPlatformKeyCache.invalidate.mockClear();
      await request(app)
        .patch('/api/admin/ai-providers/default-model')
        .set(ADMIN_HEADERS)
        .send({ provider: 'openai', model: 'gpt-4o' });
      expect(mockPlatformKeyCache.invalidate).toHaveBeenCalled();
    });

    it('fallback-order invalidates entire cache', async () => {
      mockPlatformKeyCache.invalidate.mockClear();
      await request(app)
        .patch('/api/admin/ai-providers/fallback-order')
        .set(ADMIN_HEADERS)
        .send({ order: ['anthropic', 'openai', 'google', 'openrouter'] });
      expect(mockPlatformKeyCache.invalidate).toHaveBeenCalled();
    });
  });

  // ─── PATCH /api/admin/ai-providers (bulk update) ────────────────────────

  describe('PATCH /api/admin/ai-providers', () => {
    it('updates rate limit for a provider', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers')
        .set(ADMIN_HEADERS)
        .send({ providers: [{ provider: 'openai', rateLimit: 100 }] });
      expect(res.status).toBe(200);
      const openai = res.body.providers.find((p: any) => p.provider === 'openai');
      expect(openai.rateLimit).toBe(100);
    });

    it('updates default model for a provider', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers')
        .set(ADMIN_HEADERS)
        .send({ providers: [{ provider: 'openai', defaultModel: 'gpt-4o-mini' }] });
      expect(res.status).toBe(200);
      const openai = res.body.providers.find((p: any) => p.provider === 'openai');
      expect(openai.defaultModel).toBe('gpt-4o-mini');
    });

    it('updates models list for a provider', async () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'o1'];
      const res = await request(app)
        .patch('/api/admin/ai-providers')
        .set(ADMIN_HEADERS)
        .send({ providers: [{ provider: 'openai', models }] });
      expect(res.status).toBe(200);
      const openai = res.body.providers.find((p: any) => p.provider === 'openai');
      expect(openai.models).toEqual(models);
    });

    it('creates audit log', async () => {
      await request(app)
        .patch('/api/admin/ai-providers')
        .set(ADMIN_HEADERS)
        .send({ providers: [{ provider: 'openai', rateLimit: 50 }] });
      const entry = mockState.auditRows.find((r) => r.action === 'ai_providers.update');
      expect(entry).toBeDefined();
    });

    it('returns 400 for invalid provider', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers')
        .set(ADMIN_HEADERS)
        .send({ providers: [{ provider: 'invalid' }] });
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is not array', async () => {
      const res = await request(app)
        .patch('/api/admin/ai-providers')
        .set(ADMIN_HEADERS)
        .send({ providers: 'not-array' });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/me/ai-providers (user endpoint) ──────────────────────────

  describe('GET /api/me/ai-providers', () => {
    it('returns only active providers', async () => {
      const p = findMockProvider('openai');
      p.hasKey = true;
      p.is_active = true;

      const res = await request(app).get('/api/me/ai-providers').set(USER_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.providers).toEqual(['openai']);
    });

    it('returns empty when no providers active', async () => {
      const res = await request(app).get('/api/me/ai-providers').set(USER_HEADERS);
      expect(res.status).toBe(200);
      expect(res.body.providers).toEqual([]);
    });
  });
});
