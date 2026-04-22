import type { AIProviderName } from './detect-provider';

export function providerBaseUrl(provider: AIProviderName): string {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com';
    case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'custom': return '';
  }
}
