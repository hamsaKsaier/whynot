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
 * Build a PlatformConfig from local env vars. Used as graceful fallback
 * when the gateway is unreachable at boot (Railway cold-start race) and
 * for v3-sandbox where the gateway's /api/internal/ai-config may be
 * hanging or not yet responsive. Mirrors the selectModel priority order
 * from base-agent.ts so agent model selection still works.
 */
function buildPlatformConfigFromEnv(): PlatformConfig {
  const providers: PlatformAIConfig[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      fallbackKey: null,
      defaultModel: 'claude-sonnet-4-6',
      models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    });
  }
  if (process.env.GOOGLE_AI_API_KEY) {
    providers.push({
      provider: 'google',
      apiKey: process.env.GOOGLE_AI_API_KEY,
      fallbackKey: null,
      defaultModel: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash',
      models: ['gemini-2.5-flash'],
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      fallbackKey: null,
      defaultModel: process.env.OPENROUTER_MODEL || 'z-ai/glm-5.1',
      models: [process.env.OPENROUTER_MODEL || 'z-ai/glm-5.1'],
    });
  }
  if (process.env.Z_AI_API_KEY) {
    providers.push({
      provider: 'z-ai',
      apiKey: process.env.Z_AI_API_KEY,
      fallbackKey: null,
      defaultModel: process.env.Z_AI_PREMIUM_MODEL || 'glm-5.1',
      models: ['glm-5.1', 'glm-5-turbo'],
    });
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      fallbackKey: null,
      defaultModel: 'gpt-4o',
      models: ['gpt-4o'],
    });
  }
  const defaultProvider = providers.length > 0
    ? { provider: providers[0].provider, model: providers[0].defaultModel }
    : null;
  return {
    providers,
    defaultProvider,
    fallbackOrder: providers.map(p => p.provider),
  };
}

/**
 * Fetch platform AI configuration from the gateway's internal API.
 *
 * Now non-blocking: if the gateway is unreachable (timeout, 4xx, network
 * error) we fall back to a config synthesized from local env vars.
 * Timeout shortened from 10s → 3s since we have a safe fallback — no
 * point stalling boot for 10s on a Railway cold-start race.
 *
 * Results are cached in memory — call `invalidatePlatformConfigCache()`
 * to force a re-fetch.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig;

  // Gateway listens on 3000 inside the docker network (3010 is only the host-side
  // published port). Respect GATEWAY_URL if the env explicitly sets it.
  const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3000';
  try {
    const res = await axios.get(`${gatewayUrl}/api/internal/ai-config`, {
      timeout: 3_000,
    });
    cachedConfig = res.data;
    return cachedConfig!;
  } catch (error: any) {
    // Fall back to env-var-derived config so startup never blocks.
    // The gateway may be cold-starting, on a different port, or the
    // endpoint may be gated. Either way, the env vars are the source
    // of truth for Railway deployments (Railway injects them at boot).
    const fallback = buildPlatformConfigFromEnv();
    logger.warn('Platform AI config fetch failed — using env-var fallback', {
      gatewayUrl,
      error: error.message,
      fallbackProviders: fallback.providers.map(p => p.provider),
    });
    cachedConfig = fallback;
    return fallback;
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
