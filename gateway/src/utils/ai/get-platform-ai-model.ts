import { PlatformAiConfigRepository } from '../../../shared/database/repositories/platform-ai-config-repository';
import { BillingConfigRepository } from '../../../shared/database/repositories/billing-config-repository';
import { decrypt } from '../crypto/secret-cipher';
import { selectAIProvider } from './select-ai-provider';
import { platformKeyCache } from './platform-key-cache';
import { providerBaseUrl } from './provider-base-url';
import type { AIProviderName } from './detect-provider';

const platformRepo = new PlatformAiConfigRepository();
const billingRepo = new BillingConfigRepository();

interface DecryptedConfig {
  provider: string;
  apiKey: string;
  fallbackKey: string | null;
  defaultModel: string;
  models: string[];
}

async function getDecryptedConfig(providerName: string): Promise<DecryptedConfig | null> {
  const cached = platformKeyCache.get(providerName);
  if (cached) {
    return {
      provider: cached.provider,
      apiKey: cached.key,
      fallbackKey: cached.fallbackKey,
      defaultModel: cached.model,
      models: cached.models,
    };
  }

  let apiKey: string | null;
  try {
    apiKey = await platformRepo.getDecryptedKey(providerName);
  } catch {
    return null;
  }

  let fallbackKey: string | null = null;
  try {
    fallbackKey = await platformRepo.getDecryptedFallbackKey(providerName);
  } catch {
    // Provider not found — already handled above
  }

  const effectiveKey = apiKey ?? fallbackKey;
  if (!effectiveKey) return null;

  const safe = await platformRepo.findByProvider(providerName);
  if (!safe || !safe.is_active) return null;

  const config: DecryptedConfig = {
    provider: providerName,
    apiKey: effectiveKey,
    fallbackKey: apiKey ? fallbackKey : null,
    defaultModel: safe.default_model ?? '',
    models: safe.models,
  };

  platformKeyCache.set(providerName, {
    key: effectiveKey,
    fallbackKey: apiKey ? fallbackKey : null,
    model: config.defaultModel,
    models: config.models,
    provider: providerName,
    isActive: true,
  });

  return config;
}

/**
 * Get the platform's default AI model.
 * Reads the admin-configured default provider/model from billing_config,
 * fetches the encrypted key from platform_ai_config, decrypts it,
 * and returns a ready-to-use AI model instance.
 *
 * Falls back through the configured fallback order if the default
 * provider has no active key.
 */
export async function getPlatformAIModel() {
  const defaults = await billingRepo.getDefaultAiProvider();

  if (defaults) {
    const config = await getDecryptedConfig(defaults.provider);
    if (config) {
      const baseUrl = providerBaseUrl(config.provider as AIProviderName);
      const provider = selectAIProvider({
        apiUrl: baseUrl,
        apiKey: config.apiKey,
        provider: config.provider as AIProviderName,
      });
      return provider(defaults.model || config.defaultModel);
    }
  }

  const fallbackOrder = await billingRepo.getAiFallbackOrder();
  const tried = defaults ? defaults.provider : null;

  for (const providerName of fallbackOrder) {
    if (providerName === tried) continue;

    const config = await getDecryptedConfig(providerName);
    if (config) {
      const baseUrl = providerBaseUrl(config.provider as AIProviderName);
      const provider = selectAIProvider({
        apiUrl: baseUrl,
        apiKey: config.apiKey,
        provider: config.provider as AIProviderName,
      });
      return provider(config.defaultModel);
    }
  }

  throw new Error('errors:ai.noPlatformKey');
}

/**
 * Get the platform's AI model for a specific provider.
 * Used when the caller needs a specific provider (e.g., vision requires OpenAI).
 */
export async function getPlatformAIModelForProvider(
  providerName: AIProviderName,
  model?: string,
) {
  const config = await getDecryptedConfig(providerName);
  if (!config) return null;

  const baseUrl = providerBaseUrl(providerName);
  const provider = selectAIProvider({
    apiUrl: baseUrl,
    apiKey: config.apiKey,
    provider: providerName,
  });
  return provider(model ?? config.defaultModel);
}

/**
 * Get a decrypted platform API key for a specific provider.
 * Tries primary key first, falls back to fallback key.
 * Returns null if no key is configured.
 */
export async function getPlatformAPIKey(providerName: AIProviderName): Promise<string | null> {
  const config = await getDecryptedConfig(providerName);
  return config?.apiKey ?? null;
}

/**
 * Get all active platform AI configs (decrypted keys).
 * Used by the internal API endpoint for qa-loop-executor.
 * NEVER expose via public API.
 */
export async function getAllPlatformConfigs(): Promise<Array<{
  provider: string;
  apiKey: string;
  fallbackKey: string | null;
  defaultModel: string;
  models: string[];
}>> {
  const rows = await platformRepo.findActive();
  const results: Array<{
    provider: string;
    apiKey: string;
    fallbackKey: string | null;
    defaultModel: string;
    models: string[];
  }> = [];

  for (const row of rows) {
    let apiKey: string | null = null;
    try {
      apiKey = await platformRepo.getDecryptedKey(row.provider);
    } catch {
      continue;
    }

    let fallbackKey: string | null = null;
    try {
      fallbackKey = await platformRepo.getDecryptedFallbackKey(row.provider);
    } catch {
      // ignore
    }

    const effectiveKey = apiKey ?? fallbackKey;
    if (!effectiveKey) continue;

    results.push({
      provider: row.provider,
      apiKey: effectiveKey,
      fallbackKey: apiKey ? fallbackKey : null,
      defaultModel: row.default_model ?? '',
      models: row.models,
    });
  }

  return results;
}
