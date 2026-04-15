export type AIProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'custom';

export function detectProvider(apiUrl: string): AIProviderName {
  if (apiUrl.includes('api.openai.com')) return 'openai';
  if (apiUrl.includes('api.anthropic.com')) return 'anthropic';
  if (apiUrl.includes('generativelanguage.googleapis.com')) return 'google';
  if (apiUrl.includes('openrouter.ai')) return 'openrouter';
  return 'custom';
}
