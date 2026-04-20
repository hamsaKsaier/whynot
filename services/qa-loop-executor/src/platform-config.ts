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

  // Gateway listens on 3000 inside the docker network (3010 is only the host-side
  // published port). Respect GATEWAY_URL if the env explicitly sets it.
  const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3000';
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

/**
 * Fire-and-forget: keep retrying `getPlatformConfig` with exponential backoff
 * until the cache hydrates. Called once at service startup so a transient
 * gateway DNS error (e.g. EAI_AGAIN during boot) doesn't leave the cache null
 * until the first real request. Safe to call multiple times.
 *
 * Delays: 1s, 3s, 9s, 27s, 30s (cap). Stops retrying after ~5 minutes.
 */
export function prefetchPlatformConfig(): void {
  if (cachedConfig) return;
  const DELAYS_MS = [1_000, 3_000, 9_000, 27_000];
  const MAX_DELAY_MS = 30_000;
  const DEADLINE_MS = Date.now() + 5 * 60_000;
  let attempt = 0;

  const tick = async (): Promise<void> => {
    if (cachedConfig) return;
    try {
      await getPlatformConfig();
      logger.info('Platform AI config hydrated');
      return;
    } catch {
      if (Date.now() >= DEADLINE_MS) {
        logger.warn('Platform AI config prefetch gave up; lazy refresh on first call will retry');
        return;
      }
      const delay = DELAYS_MS[attempt] ?? MAX_DELAY_MS;
      attempt++;
      setTimeout(() => { void tick(); }, delay);
    }
  };

  void tick();
}
