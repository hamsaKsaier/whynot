import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { detectProvider, type AIProviderName } from './detect-provider';

export interface AIProviderConfig {
  apiUrl: string;
  apiKey: string;
  provider?: AIProviderName;
}

export class AIProviderError extends Error {
  public readonly i18nKey: string;
  public readonly provider: string;

  constructor(i18nKey: string, provider: string) {
    super(`Unknown AI provider: ${provider}`);
    this.name = 'AIProviderError';
    this.i18nKey = i18nKey;
    this.provider = provider;
  }
}

export function selectAIProvider(config: AIProviderConfig) {
  const providerName = config.provider ?? detectProvider(config.apiUrl);

  switch (providerName) {
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey });

    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey });

    case 'google':
      return createGoogleGenerativeAI({ apiKey: config.apiKey });

    case 'openrouter':
      // OpenRouter does not support the Responses API — must use
      // createOpenAICompatible instead of createOpenAI (see commit e231a08).
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: config.apiKey,
      });

    case 'custom':
      return createOpenAICompatible({
        name: 'custom',
        baseURL: config.apiUrl,
        apiKey: config.apiKey,
      });

    default: {
      const exhaustive: never = providerName;
      throw new AIProviderError('errors:ai.unknownProvider', String(exhaustive));
    }
  }
}
