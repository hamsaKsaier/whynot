import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_KEY = Buffer.from('a'.repeat(32)).toString('base64');
process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;

import { encrypt } from '../../../utils/crypto/secret-cipher';

const mockFindDefault = vi.fn();

vi.mock('../../../../shared/database/repositories/user-ai-config-repository', () => {
  return {
    UserAiConfigRepository: class {
      findDefault = (...args: any[]) => mockFindDefault(...args);
    },
  };
});

vi.mock('../../../utils/ai/select-ai-provider', () => ({
  selectAIProvider: vi.fn(({ provider }: any) => {
    return (model: string) => ({ modelId: model, provider: provider ?? 'openai' });
  }),
}));

describe('getUserAIModel', () => {
  beforeEach(() => {
    mockFindDefault.mockReset();
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
});
