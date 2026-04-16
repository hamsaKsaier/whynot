import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_KEY = Buffer.from('a'.repeat(32)).toString('base64');
process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;

import { encrypt } from '../../../utils/crypto/secret-cipher';

// ─── Mock: PlatformAiConfigRepository ─────────────────────────────────────────

const mockGetDecryptedKey = vi.fn();
const mockGetDecryptedFallbackKey = vi.fn();
const mockFindByProvider = vi.fn();
const mockFindActive = vi.fn();

vi.mock('../../../../shared/database/repositories/platform-ai-config-repository', () => ({
  PlatformAiConfigRepository: class {
    getDecryptedKey = (...args: any[]) => mockGetDecryptedKey(...args);
    getDecryptedFallbackKey = (...args: any[]) => mockGetDecryptedFallbackKey(...args);
    findByProvider = (...args: any[]) => mockFindByProvider(...args);
    findActive = (...args: any[]) => mockFindActive(...args);
  },
}));

// ─── Mock: BillingConfigRepository ────────────────────────────────────────────

const mockGetDefaultAiProvider = vi.fn();
const mockGetAiFallbackOrder = vi.fn();

vi.mock('../../../../shared/database/repositories/billing-config-repository', () => ({
  BillingConfigRepository: class {
    getDefaultAiProvider = (...args: any[]) => mockGetDefaultAiProvider(...args);
    getAiFallbackOrder = (...args: any[]) => mockGetAiFallbackOrder(...args);
  },
}));

// ─── Mock: selectAIProvider ───────────────────────────────────────────────────

vi.mock('../../../utils/ai/select-ai-provider', () => ({
  selectAIProvider: vi.fn(({ provider }: any) => {
    return (model: string) => ({ modelId: model, provider: provider ?? 'openai' });
  }),
}));

// ─── Mock: platformKeyCache ───────────────────────────────────────────────────

vi.mock('../../../utils/ai/platform-key-cache', () => {
  const cache = new Map<string, any>();
  return {
    platformKeyCache: {
      get: (provider: string) => cache.get(provider) ?? null,
      set: (provider: string, entry: any) => cache.set(provider, entry),
      invalidate: (provider?: string) => { if (provider) cache.delete(provider); else cache.clear(); },
      invalidateAll: () => cache.clear(),
    },
  };
});

import { platformKeyCache } from '../../../utils/ai/platform-key-cache';

// ─── Helper ───────────────────────────────────────────────────────────────────

function safeProvider(provider: string, overrides?: Partial<{
  default_model: string | null;
  models: string[];
  is_active: boolean;
}>) {
  return {
    id: `id-${provider}`,
    provider,
    display_name: provider,
    hasKey: true,
    hasFallbackKey: false,
    maskedKey: 'sk-•••••test',
    maskedFallbackKey: null,
    default_model: overrides?.default_model ?? 'default-model',
    models: overrides?.models ?? ['default-model'],
    is_active: overrides?.is_active ?? true,
    rate_limit: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getPlatformAIModel', () => {
  beforeEach(() => {
    mockGetDecryptedKey.mockReset();
    mockGetDecryptedFallbackKey.mockReset();
    mockFindByProvider.mockReset();
    mockFindActive.mockReset();
    mockGetDefaultAiProvider.mockReset();
    mockGetAiFallbackOrder.mockReset();
    platformKeyCache.invalidateAll();
  });

  it('returns default provider model when default has active key', async () => {
    mockGetDefaultAiProvider.mockResolvedValue({ provider: 'openai', model: 'gpt-4o' });
    mockGetDecryptedKey.mockResolvedValue('sk-openai-key');
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockResolvedValue(safeProvider('openai', { default_model: 'gpt-4o' }));

    const { getPlatformAIModel } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModel();

    expect(result).toEqual({ modelId: 'gpt-4o', provider: 'openai' });
  });

  it('falls back to next provider when default has no key', async () => {
    mockGetDefaultAiProvider.mockResolvedValue({ provider: 'openai', model: 'gpt-4o' });
    mockGetAiFallbackOrder.mockResolvedValue(['openai', 'anthropic', 'google']);

    // openai has no key
    mockGetDecryptedKey.mockImplementation((p: string) => {
      if (p === 'openai') return Promise.resolve(null);
      if (p === 'anthropic') return Promise.resolve('sk-ant-key');
      return Promise.resolve(null);
    });
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockImplementation((p: string) => {
      if (p === 'openai') return Promise.resolve(safeProvider('openai', { is_active: false }));
      if (p === 'anthropic') return Promise.resolve(safeProvider('anthropic', { default_model: 'claude-sonnet-4-6' }));
      return Promise.resolve(null);
    });

    const { getPlatformAIModel } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModel();

    expect(result).toEqual({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('falls back through entire chain, returning first active', async () => {
    mockGetDefaultAiProvider.mockResolvedValue({ provider: 'openai', model: 'gpt-4o' });
    mockGetAiFallbackOrder.mockResolvedValue(['openai', 'anthropic', 'google']);

    mockGetDecryptedKey.mockImplementation((p: string) => {
      if (p === 'google') return Promise.resolve('google-key');
      return Promise.resolve(null);
    });
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockImplementation((p: string) => {
      if (p === 'openai') return Promise.resolve(safeProvider('openai', { is_active: false }));
      if (p === 'anthropic') return Promise.resolve(safeProvider('anthropic', { is_active: false }));
      if (p === 'google') return Promise.resolve(safeProvider('google', { default_model: 'gemini-pro' }));
      return Promise.resolve(null);
    });

    const { getPlatformAIModel } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModel();

    expect(result).toEqual({ modelId: 'gemini-pro', provider: 'google' });
  });

  it('throws descriptive error when no providers have active keys', async () => {
    mockGetDefaultAiProvider.mockResolvedValue(null);
    mockGetAiFallbackOrder.mockResolvedValue([]);

    const { getPlatformAIModel } = await import('../../../utils/ai/get-platform-ai-model');

    await expect(getPlatformAIModel()).rejects.toThrow('errors:ai.noPlatformKey');
  });

  it('uses fallback key when primary is null but fallback exists', async () => {
    mockGetDefaultAiProvider.mockResolvedValue({ provider: 'openai', model: 'gpt-4o' });

    mockGetDecryptedKey.mockResolvedValue(null);
    mockGetDecryptedFallbackKey.mockResolvedValue('sk-fallback-key');
    mockFindByProvider.mockResolvedValue(safeProvider('openai', { default_model: 'gpt-4o' }));

    const { getPlatformAIModel } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModel();

    expect(result).toEqual({ modelId: 'gpt-4o', provider: 'openai' });
  });

  it('respects ai_fallback_order from billing_config', async () => {
    // Default provider missing, custom fallback order puts google first
    mockGetDefaultAiProvider.mockResolvedValue({ provider: 'openai', model: 'gpt-4o' });
    mockGetAiFallbackOrder.mockResolvedValue(['google', 'anthropic', 'openai']);

    mockGetDecryptedKey.mockImplementation((p: string) => {
      if (p === 'google') return Promise.resolve('google-key');
      return Promise.resolve(null);
    });
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockImplementation((p: string) => {
      if (p === 'openai') return Promise.resolve(safeProvider('openai', { is_active: false }));
      if (p === 'google') return Promise.resolve(safeProvider('google', { default_model: 'gemini-pro' }));
      return Promise.resolve(null);
    });

    const { getPlatformAIModel } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModel();

    expect(result).toEqual({ modelId: 'gemini-pro', provider: 'google' });
  });

  it('skips providers not in platform_ai_config table', async () => {
    mockGetDefaultAiProvider.mockResolvedValue(null);
    mockGetAiFallbackOrder.mockResolvedValue(['openai', 'anthropic']);

    // openai throws (not in table), anthropic has key
    mockGetDecryptedKey.mockImplementation((p: string) => {
      if (p === 'openai') return Promise.reject(new Error('ai.providerNotFound'));
      if (p === 'anthropic') return Promise.resolve('sk-ant-key');
      return Promise.resolve(null);
    });
    mockGetDecryptedFallbackKey.mockImplementation((p: string) => {
      if (p === 'openai') return Promise.reject(new Error('ai.providerNotFound'));
      return Promise.resolve(null);
    });
    mockFindByProvider.mockImplementation((p: string) => {
      if (p === 'anthropic') return Promise.resolve(safeProvider('anthropic', { default_model: 'claude-sonnet-4-6' }));
      return Promise.resolve(null);
    });

    const { getPlatformAIModel } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModel();

    expect(result).toEqual({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });
  });
});

describe('getPlatformAIModelForProvider', () => {
  beforeEach(() => {
    mockGetDecryptedKey.mockReset();
    mockGetDecryptedFallbackKey.mockReset();
    mockFindByProvider.mockReset();
    platformKeyCache.invalidateAll();
  });

  it('returns specific provider model when key exists', async () => {
    mockGetDecryptedKey.mockResolvedValue('sk-ant-key');
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockResolvedValue(safeProvider('anthropic', { default_model: 'claude-sonnet-4-6' }));

    const { getPlatformAIModelForProvider } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModelForProvider('anthropic');

    expect(result).toEqual({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('returns null when provider has no key', async () => {
    mockGetDecryptedKey.mockResolvedValue(null);
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockResolvedValue(safeProvider('openai', { is_active: false }));

    const { getPlatformAIModelForProvider } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModelForProvider('openai');

    expect(result).toBeNull();
  });

  it('uses custom model param when provided', async () => {
    mockGetDecryptedKey.mockResolvedValue('sk-openai-key');
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockResolvedValue(safeProvider('openai', { default_model: 'gpt-4o' }));

    const { getPlatformAIModelForProvider } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModelForProvider('openai', 'gpt-4o-mini');

    expect(result).toEqual({ modelId: 'gpt-4o-mini', provider: 'openai' });
  });

  it('uses provider default_model when model param omitted', async () => {
    mockGetDecryptedKey.mockResolvedValue('sk-google-key');
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockResolvedValue(safeProvider('google', { default_model: 'gemini-pro' }));

    const { getPlatformAIModelForProvider } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAIModelForProvider('google');

    expect(result).toEqual({ modelId: 'gemini-pro', provider: 'google' });
  });
});

describe('getPlatformAPIKey', () => {
  beforeEach(() => {
    mockGetDecryptedKey.mockReset();
    mockGetDecryptedFallbackKey.mockReset();
    mockFindByProvider.mockReset();
    platformKeyCache.invalidateAll();
  });

  it('returns decrypted primary key', async () => {
    mockGetDecryptedKey.mockResolvedValue('sk-primary-key');
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockResolvedValue(safeProvider('openai'));

    const { getPlatformAPIKey } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAPIKey('openai');

    expect(result).toBe('sk-primary-key');
  });

  it('returns decrypted fallback key when primary is null', async () => {
    mockGetDecryptedKey.mockResolvedValue(null);
    mockGetDecryptedFallbackKey.mockResolvedValue('sk-fallback-key');
    mockFindByProvider.mockResolvedValue(safeProvider('openai'));

    const { getPlatformAPIKey } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAPIKey('openai');

    expect(result).toBe('sk-fallback-key');
  });

  it('returns null when neither key exists', async () => {
    mockGetDecryptedKey.mockResolvedValue(null);
    mockGetDecryptedFallbackKey.mockResolvedValue(null);
    mockFindByProvider.mockResolvedValue(safeProvider('openai', { is_active: false }));

    const { getPlatformAPIKey } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getPlatformAPIKey('openai');

    expect(result).toBeNull();
  });
});

describe('getAllPlatformConfigs', () => {
  beforeEach(() => {
    mockGetDecryptedKey.mockReset();
    mockGetDecryptedFallbackKey.mockReset();
    mockFindActive.mockReset();
    platformKeyCache.invalidateAll();
  });

  it('returns all active providers with decrypted keys', async () => {
    mockFindActive.mockResolvedValue([
      safeProvider('openai', { default_model: 'gpt-4o', models: ['gpt-4o'] }),
      safeProvider('anthropic', { default_model: 'claude-sonnet-4-6', models: ['claude-sonnet-4-6'] }),
    ]);
    mockGetDecryptedKey.mockImplementation((p: string) => {
      if (p === 'openai') return Promise.resolve('sk-openai');
      if (p === 'anthropic') return Promise.resolve('sk-ant');
      return Promise.resolve(null);
    });
    mockGetDecryptedFallbackKey.mockResolvedValue(null);

    const { getAllPlatformConfigs } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getAllPlatformConfigs();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      provider: 'openai',
      apiKey: 'sk-openai',
      fallbackKey: null,
      defaultModel: 'gpt-4o',
      models: ['gpt-4o'],
    });
    expect(result[1]).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-ant',
      fallbackKey: null,
      defaultModel: 'claude-sonnet-4-6',
      models: ['claude-sonnet-4-6'],
    });
  });

  it('includes fallback keys where present', async () => {
    mockFindActive.mockResolvedValue([
      safeProvider('openai', { default_model: 'gpt-4o', models: ['gpt-4o'] }),
    ]);
    mockGetDecryptedKey.mockResolvedValue('sk-primary');
    mockGetDecryptedFallbackKey.mockResolvedValue('sk-fallback');

    const { getAllPlatformConfigs } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getAllPlatformConfigs();

    expect(result).toHaveLength(1);
    expect(result[0].fallbackKey).toBe('sk-fallback');
  });

  it('returns empty array when no providers configured', async () => {
    mockFindActive.mockResolvedValue([]);

    const { getAllPlatformConfigs } = await import('../../../utils/ai/get-platform-ai-model');
    const result = await getAllPlatformConfigs();

    expect(result).toEqual([]);
  });
});
