import axios from 'axios';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('platform-config');

interface PlatformAIConfig {
  provider: string;
  apiKey: string;
  fallbackKey: string | null;
  defaultModel: string;
  models: string[];
}

interface PlatformConfig {
  providers: PlatformAIConfig[];
  defaultProvider: { provider: string; model: string } | null;
  fallbackOrder: string[];
}

let cachedConfig: PlatformConfig | null = null;

/**
 * Fetch platform AI configuration from the gateway's internal API.
 * Results are cached in memory — call `invalidatePlatformConfigCache()` to force a re-fetch.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig;

  const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3010';
  try {
    const res = await axios.get(`${gatewayUrl}/api/internal/ai-config`, {
      timeout: 10_000,
    });
    cachedConfig = res.data;
    return cachedConfig!;
  } catch (error: any) {
    logger.error('Failed to fetch platform AI config from gateway', {
      gatewayUrl,
      error: error.message,
    });
    throw new Error('Unable to reach platform AI configuration service.');
  }
}

/**
 * Get the decrypted API key for a specific provider from the platform config.
 * Returns null if the provider is not configured.
 */
export async function getPlatformKey(provider: string): Promise<string | null> {
  const config = await getPlatformConfig();
  const entry = config.providers.find(p => p.provider === provider);
  return entry?.apiKey || null;
}

/**
 * Clear the cached platform config so the next call re-fetches from the gateway.
 */
export function invalidatePlatformConfigCache(): void {
  cachedConfig = null;
}
