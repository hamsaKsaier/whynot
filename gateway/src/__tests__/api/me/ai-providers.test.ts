import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockActiveProviders = [
  {
    id: '1',
    provider: 'openai',
    display_name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini'],
    default_model: 'gpt-4o',
    is_active: true,
  },
  {
    id: '2',
    provider: 'anthropic',
    display_name: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6'],
    default_model: 'claude-sonnet-4-6',
    is_active: true,
  },
];

let currentActiveProviders = [...mockActiveProviders];
let mockSubscription: any = null;
let mockPlan: any = null;
let mockDefaultAiProvider: any = null;

vi.mock('../../../../shared/database/repositories/platform-ai-config-repository', () => ({
  PlatformAiConfigRepository: vi.fn().mockImplementation(() => ({
    findActive: vi.fn(async () => currentActiveProviders),
  })),
}));

vi.mock('../../../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByWorkspaceId: vi.fn(async () => mockSubscription),
  })),
}));

vi.mock('../../../../shared/database/repositories/plan-repository', () => ({
  PlanRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(async () => mockPlan),
  })),
}));

vi.mock('../../../../shared/database/repositories/billing-config-repository', () => ({
  BillingConfigRepository: vi.fn().mockImplementation(() => ({
    getDefaultAiProvider: vi.fn(async () => mockDefaultAiProvider),
  })),
}));

vi.mock('../../../../shared/database/repositories/audit-repository', () => ({
  AuditRepository: vi.fn().mockImplementation(() => ({
    log: vi.fn(),
  })),
}));

vi.mock('../../../../shared/logger/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const userId = req.headers['x-test-user-id'] as string;
    if (!userId) {
      return _res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.user = { id: userId, email: `${userId}@test.com`, name: 'Test', role: 'user' };
    req.workspaceId = req.headers['x-test-workspace-id'] || 'ws-1';
    next();
  },
}));

vi.mock('../../../../shared/constants/pricing', () => ({
  PLANS: {
    free: { name: 'Free', monthlyCents: 0n, tier: 'byo_keys' },
    pro_byo: { name: 'Pro (BYO)', monthlyCents: 2900n, tier: 'byo_keys' },
    pro_managed: { name: 'Pro (Managed)', monthlyCents: 4900n, tier: 'managed_payg' },
  },
  isPlanSlug: (v: string) => ['free', 'pro_byo', 'pro_managed'].includes(v),
}));

import { errorHandler, asyncHandler } from '../../../middleware/error-handler';
import { requireAuth } from '../../../middleware/auth';
import { PlatformAiConfigRepository } from '../../../../shared/database/repositories/platform-ai-config-repository';
import { SubscriptionRepository } from '../../../../shared/database/repositories/subscription-repository';
import { PlanRepository } from '../../../../shared/database/repositories/plan-repository';
import { BillingConfigRepository } from '../../../../shared/database/repositories/billing-config-repository';
import { PLANS, isPlanSlug } from '../../../../shared/constants/pricing';

// ── App ─────────────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());

  const platformAiConfigRepository = new PlatformAiConfigRepository();
  const subscriptionRepository = new SubscriptionRepository();
  const planRepository = new PlanRepository();
  const billingConfigRepository = new BillingConfigRepository();

  app.get('/api/me/ai-providers', requireAuth, asyncHandler(async (req: any, res) => {
    const configs = await platformAiConfigRepository.findActive();

    const providers = configs.map((c: any) => ({
      provider: c.provider,
      displayName: c.display_name,
      models: c.models || [],
      defaultModel: c.default_model || '',
    }));

    providers.push({
      provider: 'custom',
      displayName: 'Custom (OpenAI-compatible)',
      models: [],
      defaultModel: '',
    });

    let tier: 'byo_keys' | 'managed_payg' = 'byo_keys';
    if (req.workspaceId) {
      const subscription = await subscriptionRepository.findByWorkspaceId(req.workspaceId);
      if (subscription) {
        const plan = await planRepository.findById(subscription.plan_id);
        if (plan && isPlanSlug(plan.slug)) {
          tier = (PLANS as any)[plan.slug].tier;
        }
      }
    }

    const hasPlatformKeys = configs.length > 0;
    const platformDefault = await billingConfigRepository.getDefaultAiProvider();

    res.json({
      success: true,
      providers,
      tier,
      hasPlatformKeys,
      platformDefault,
    });
  }));

  app.use(errorHandler);
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/me/ai-providers', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    currentActiveProviders = [...mockActiveProviders];
    mockSubscription = null;
    mockPlan = null;
    mockDefaultAiProvider = null;
    app = createApp();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/me/ai-providers');
    expect(res.status).toBe(401);
  });

  it('returns correct shape with providers, tier, platformDefault', async () => {
    mockDefaultAiProvider = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.providers).toBeInstanceOf(Array);
    expect(res.body.tier).toBeDefined();
    expect(res.body.hasPlatformKeys).toBeDefined();
    expect(res.body.platformDefault).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  });

  it('returns tier: byo_keys with no subscription', async () => {
    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('byo_keys');
  });

  it('returns tier: byo_keys with free plan subscription', async () => {
    mockSubscription = { id: 'sub-1', plan_id: 'plan-free' };
    mockPlan = { id: 'plan-free', slug: 'free' };

    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('byo_keys');
  });

  it('returns tier: managed_payg with pro_managed subscription', async () => {
    mockSubscription = { id: 'sub-1', plan_id: 'plan-managed' };
    mockPlan = { id: 'plan-managed', slug: 'pro_managed' };

    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('managed_payg');
  });

  it('only returns active providers (disabled ones excluded)', async () => {
    currentActiveProviders = [mockActiveProviders[0]]; // only openai

    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);

    const providerNames = res.body.providers.map((p: any) => p.provider);
    expect(providerNames).toContain('openai');
    expect(providerNames).not.toContain('anthropic');
    // Custom is always included
    expect(providerNames).toContain('custom');
  });

  it('always includes custom provider option', async () => {
    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);

    const customProvider = res.body.providers.find((p: any) => p.provider === 'custom');
    expect(customProvider).toBeDefined();
    expect(customProvider.displayName).toBe('Custom (OpenAI-compatible)');
    expect(customProvider.models).toEqual([]);
  });

  it('returns correct models per provider from platform config', async () => {
    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);

    const openai = res.body.providers.find((p: any) => p.provider === 'openai');
    expect(openai.models).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(openai.defaultModel).toBe('gpt-4o');

    const anthropic = res.body.providers.find((p: any) => p.provider === 'anthropic');
    expect(anthropic.models).toEqual(['claude-sonnet-4-6', 'claude-opus-4-6']);
    expect(anthropic.defaultModel).toBe('claude-sonnet-4-6');
  });

  it('returns hasPlatformKeys: false when no active providers', async () => {
    currentActiveProviders = [];

    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.hasPlatformKeys).toBe(false);
    // Only custom should be in the list
    expect(res.body.providers).toHaveLength(1);
    expect(res.body.providers[0].provider).toBe('custom');
  });

  it('returns platformDefault: null when none configured', async () => {
    mockDefaultAiProvider = null;

    const res = await request(app)
      .get('/api/me/ai-providers')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.platformDefault).toBeNull();
  });
});
