import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_KEY = Buffer.from('a'.repeat(32)).toString('base64');
process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;

import { encrypt } from '../../../utils/crypto/secret-cipher';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindDefault = vi.fn();
const mockFindByWorkspaceId = vi.fn();
const mockFindBySlug = vi.fn();
const mockFindById = vi.fn();
const mockGetPlatformAIModel = vi.fn();

vi.mock('../../../../shared/database/repositories/user-ai-config-repository', () => ({
  UserAiConfigRepository: class {
    findDefault = (...args: any[]) => mockFindDefault(...args);
  },
}));

vi.mock('../../../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: class {
    findByWorkspaceId = (...args: any[]) => mockFindByWorkspaceId(...args);
  },
}));

vi.mock('../../../../shared/database/repositories/plan-repository', () => ({
  PlanRepository: class {
    findBySlug = (...args: any[]) => mockFindBySlug(...args);
    findById = (...args: any[]) => mockFindById(...args);
  },
}));

vi.mock('../../../utils/ai/select-ai-provider', () => ({
  selectAIProvider: vi.fn(({ provider }: any) => {
    return (model: string) => ({ modelId: model, provider: provider ?? 'openai' });
  }),
}));

vi.mock('../../../utils/ai/get-platform-ai-model', () => ({
  getPlatformAIModel: (...args: any[]) => mockGetPlatformAIModel(...args),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getUserAIModel', () => {
  beforeEach(() => {
    mockFindDefault.mockReset();
    mockFindByWorkspaceId.mockReset();
    mockFindBySlug.mockReset();
    mockFindById.mockReset();
    mockGetPlatformAIModel.mockReset();
  });

  it('returns null when user has no default config', async () => {
    mockFindDefault.mockResolvedValue(null);
    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1');
    expect(result).toBeNull();
  });

  it('returns model instance when default config exists', async () => {
    const enc = encrypt('sk-test-key');
    mockFindDefault.mockResolvedValue({
      id: 'cfg-1', user_id: 'user-1', provider: 'openai', model: 'gpt-4o',
      base_url: 'https://api.openai.com/v1',
      api_key_encrypted: enc.ciphertext, api_key_iv: enc.iv, api_key_tag: enc.tag,
      is_default: true,
    });
    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1');
    expect(result).toEqual({ modelId: 'gpt-4o', provider: 'openai' });
  });

  it('uses provider base URL when base_url is null', async () => {
    const enc = encrypt('sk-ant-key');
    mockFindDefault.mockResolvedValue({
      id: 'cfg-2', user_id: 'user-1', provider: 'anthropic', model: 'claude-sonnet-4-6',
      base_url: null,
      api_key_encrypted: enc.ciphertext, api_key_iv: enc.iv, api_key_tag: enc.tag,
      is_default: true,
    });
    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1');
    expect(result).toEqual({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });
  });

  it('returns null when no user config and no workspaceId', async () => {
    mockFindDefault.mockResolvedValue(null);
    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1');
    expect(result).toBeNull();
    expect(mockFindByWorkspaceId).not.toHaveBeenCalled();
  });

  it('returns null when no user config and workspace is byo_keys tier', async () => {
    mockFindDefault.mockResolvedValue(null);
    mockFindByWorkspaceId.mockResolvedValue({ id: 'sub-1', plan_id: 'free' });
    mockFindBySlug.mockResolvedValue({ id: 'plan-1', slug: 'free', name: 'Free' });

    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1', 'ws-1');

    expect(result).toBeNull();
    expect(mockGetPlatformAIModel).not.toHaveBeenCalled();
  });

  it('returns platform model when no user config and workspace is managed_payg tier (plan found by slug)', async () => {
    mockFindDefault.mockResolvedValue(null);
    mockFindByWorkspaceId.mockResolvedValue({ id: 'sub-1', plan_id: 'pro_managed' });
    mockFindBySlug.mockResolvedValue({ id: 'plan-1', slug: 'pro_managed', name: 'Pro Managed' });
    mockGetPlatformAIModel.mockResolvedValue({ modelId: 'gpt-4o', provider: 'openai' });

    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1', 'ws-1');

    expect(result).toEqual({ modelId: 'gpt-4o', provider: 'openai' });
    expect(mockGetPlatformAIModel).toHaveBeenCalledOnce();
  });

  it('returns platform model when plan found by ID fallback with managed_payg tier', async () => {
    mockFindDefault.mockResolvedValue(null);
    mockFindByWorkspaceId.mockResolvedValue({ id: 'sub-1', plan_id: 'uuid-plan-id' });
    mockFindBySlug.mockResolvedValue(null); // slug lookup fails
    mockFindById.mockResolvedValue({ id: 'uuid-plan-id', slug: 'pro_managed', name: 'Pro Managed' });
    mockGetPlatformAIModel.mockResolvedValue({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });

    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1', 'ws-1');

    expect(result).toEqual({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });
    expect(mockGetPlatformAIModel).toHaveBeenCalledOnce();
  });

  it('returns user model even for managed_payg tier when user has own config', async () => {
    const enc = encrypt('sk-user-key');
    mockFindDefault.mockResolvedValue({
      id: 'cfg-1', user_id: 'user-1', provider: 'anthropic', model: 'claude-sonnet-4-6',
      base_url: null,
      api_key_encrypted: enc.ciphertext, api_key_iv: enc.iv, api_key_tag: enc.tag,
      is_default: true,
    });

    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1', 'ws-1');

    expect(result).toEqual({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });
    // Should not check subscription when user has own config
    expect(mockFindByWorkspaceId).not.toHaveBeenCalled();
    expect(mockGetPlatformAIModel).not.toHaveBeenCalled();
  });

  it('returns null when no subscription found for workspace', async () => {
    mockFindDefault.mockResolvedValue(null);
    mockFindByWorkspaceId.mockResolvedValue(null);

    const { getUserAIModel } = await import('../../../utils/ai/get-user-ai-model');
    const result = await getUserAIModel('user-1', 'ws-1');

    expect(result).toBeNull();
  });
});
