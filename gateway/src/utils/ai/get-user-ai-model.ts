import { UserAiConfigRepository } from '../../../shared/database/repositories/user-ai-config-repository';
import { decrypt } from '../crypto/secret-cipher';
import { selectAIProvider } from './select-ai-provider';
import type { AIProviderName } from './detect-provider';

const repo = new UserAiConfigRepository();

function providerBaseUrl(provider: AIProviderName): string {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com';
    case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'custom': return '';
  }
}

export async function getUserAIModel(userId: string) {
  const config = await repo.findDefault(userId);
  if (!config) return null;

  const apiKey = decrypt({
    ciphertext: config.api_key_encrypted,
    iv: config.api_key_iv,
    tag: config.api_key_tag,
  });

  const apiUrl = config.base_url || providerBaseUrl(config.provider as AIProviderName);

  const provider = selectAIProvider({
    apiUrl,
    apiKey,
    provider: config.provider as AIProviderName,
  });

  return provider(config.model);
}
