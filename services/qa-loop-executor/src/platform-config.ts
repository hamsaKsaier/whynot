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

// TTL'd in-memory cache. The executor caches the provider config to avoid
// hammering the gateway on every scan start, but a stale cache silently
// breaks the "save key in admin UI → next scan uses new key" flow because
// the gateway has no out-of-band signal to the executor when admin saves.
// 60s TTL is the compromise: admin changes propagate within a minute, and
// we still save ~95% of the per-scan fetches. Call
// `invalidatePlatformConfigCache()` to force immediate re-fetch.
const CACHE_TTL_MS = 60_000;
let cachedConfig: PlatformConfig | null = null;
let cacheExpiresAt = 0;

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
      // `gemini-flash-latest` is an alias that always resolves to Google's
      // current Flash model. Pinned IDs go stale: Google retires them for NEW
      // API keys while existing keys keep working, so a hardcoded default
      // silently breaks every fresh self-hosted install while working fine on
      // the maintainer's machine. (gemini-2.5-flash was rejected exactly this
      // way: "no longer available to new users".)
      defaultModel: process.env.GOOGLE_AI_MODEL || 'gemini-flash-latest',
      models: ['gemini-flash-latest'],
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
 * Results are cached in memory with a 60s TTL — call
 * `invalidatePlatformConfigCache()` to force immediate re-fetch.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig && Date.now() < cacheExpiresAt) return cachedConfig;

  const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3000';
  try {
    const res = await axios.get(`${gatewayUrl}/api/internal/ai-config`, {
      timeout: 3_000,
    });
    cachedConfig = res.data;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
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
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
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
  cacheExpiresAt = 0;
}
