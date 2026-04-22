# 02 — Platform Key Resolution Service

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/spec-driven-development/`

## Dependencies
- `01-admin-ai-keys-db-migration.md` (requires `platform_ai_config` table and `PlatformAiConfigRepository`)

## Task

Build the centralized platform key resolution service that replaces all `process.env.*_API_KEY` reads for platform-level (managed) AI operations. This is the platform-side mirror of `gateway/src/utils/ai/get-user-ai-model.ts` (which resolves user-provided keys). Implements fallback: if the primary provider's key fails or is missing, try the next in the admin-configured fallback order.

### 1. New Service: `gateway/src/utils/ai/get-platform-ai-model.ts`

Create a function that reads from the `platform_ai_config` table (via the repository from prompt 01), decrypts the key, and returns a ready-to-use AI model instance via `selectAIProvider`.

```typescript
import { PlatformAiConfigRepository } from '../../../shared/database/repositories/platform-ai-config-repository';
import { BillingConfigRepository } from '../../../shared/database/repositories/billing-config-repository';
import { decrypt } from '../crypto/secret-cipher';
import { selectAIProvider } from './select-ai-provider';
import { platformKeyCache } from './platform-key-cache';
import type { AIProviderName } from './detect-provider';

/**
 * Get the platform's default AI model.
 * Reads the admin-configured default provider/model from billing_config,
 * fetches the encrypted key from platform_ai_config, decrypts it,
 * and returns a ready-to-use AI model instance.
 *
 * Falls back through the configured fallback order if the default
 * provider has no active key.
 */
export async function getPlatformAIModel(): Promise<ReturnType<ReturnType<typeof selectAIProvider>>>

/**
 * Get the platform's AI model for a specific provider.
 * Used when the caller needs a specific provider (e.g., vision requires OpenAI).
 */
export async function getPlatformAIModelForProvider(
  provider: AIProviderName,
  model?: string
): Promise<ReturnType<ReturnType<typeof selectAIProvider>> | null>

/**
 * Get a decrypted platform API key for a specific provider.
 * Tries primary key first, falls back to fallback key.
 * Returns null if no key is configured.
 * Used by services that need the raw key (e.g., qa-loop-executor internal API).
 */
export async function getPlatformAPIKey(provider: AIProviderName): Promise<string | null>

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
}>>
```

**Fallback logic in `getPlatformAIModel()`:**
1. Read `default_ai_provider` from `billing_config` (via `BillingConfigRepository.getDefaultAiProvider()`)
2. Try to get the key for that provider from cache (or DB if cache miss)
3. If key exists and is active, create and return the AI model instance
4. If not, read `ai_fallback_order` from `billing_config`
5. Iterate the fallback list, skip the default (already tried), try each in order
6. Return the first one that has an active key
7. If none have keys, throw a descriptive error

**Key decryption:** Use `decrypt()` from `gateway/src/utils/crypto/secret-cipher.ts` — same pattern as `get-user-ai-model.ts` lines 22-26.

**Fallback key logic:** When getting a key for a provider, try the primary `api_key_encrypted` first. If primary is null but `fallback_key_encrypted` exists, use the fallback. This handles the case where a primary key is revoked but the admin hasn't rotated yet.

### 2. New Module: `gateway/src/utils/ai/platform-key-cache.ts`

In-memory cache to avoid hitting the database on every AI request.

```typescript
interface CacheEntry {
  key: string;           // Decrypted primary key
  fallbackKey: string | null; // Decrypted fallback key
  model: string;
  models: string[];
  provider: string;
  isActive: boolean;
  expiresAt: number;     // Date.now() + TTL
}

class PlatformKeyCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL_MS = 60_000; // 60 seconds

  get(provider: string): CacheEntry | null     // Returns null if expired or missing
  set(provider: string, entry: Omit<CacheEntry, 'expiresAt'>): void
  invalidate(provider?: string): void          // Invalidate one or all
  invalidateAll(): void                        // Clear entire cache
}

export const platformKeyCache = new PlatformKeyCache();
```

**Design decisions:**
- 60-second TTL: short enough for admin changes to propagate quickly, long enough to avoid DB hammering under load
- Single global instance (module-level export)
- `invalidate()` called by admin API endpoints when keys are modified (prompt 03 will wire this)
- Thread-safe: Node.js is single-threaded, no mutex needed

### 3. Extend `gateway/src/utils/ai/get-user-ai-model.ts`

Add fallback-to-platform logic for `managed_payg` tier users who haven't configured their own key.

**Current behavior (line 19):** Returns `null` if user has no default config.

**New behavior:**
```typescript
export async function getUserAIModel(userId: string, workspaceId?: string) {
  const config = await repo.findDefault(userId);

  if (config) {
    // User has their own key — use it (existing logic)
    const apiKey = decrypt({ ... });
    const provider = selectAIProvider({ ... });
    return provider(config.model);
  }

  // No user config — check if managed_payg tier allows platform fallback
  if (workspaceId) {
    const subscription = await subscriptionRepo.findByWorkspaceId(workspaceId);
    const plan = subscription ? await planRepo.findById(subscription.plan_id) : null;
    if (plan && PLANS[plan.slug as keyof typeof PLANS]?.tier === 'managed_payg') {
      // Managed tier user without own key — use platform key
      return getPlatformAIModel();
    }
  }

  return null;
}
```

**Import additions:** `SubscriptionRepository`, `PlanRepository`, `PLANS` from `gateway/shared/constants/pricing.ts`, `getPlatformAIModel` from `./get-platform-ai-model`.

**IMPORTANT:** The `workspaceId` parameter is optional for backward compatibility. Callers that have workspace context should pass it.

### 4. Provider Base URL Mapping

Reuse the existing `providerBaseUrl()` function from `get-user-ai-model.ts` (lines 8-16). Extract it to a shared location if not already:

```typescript
// gateway/src/utils/ai/provider-base-url.ts (new, or inline if small)
export function providerBaseUrl(provider: AIProviderName): string {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com';
    case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'custom': return '';
  }
}
```

This avoids duplication between `get-user-ai-model.ts` and `get-platform-ai-model.ts`.

### Tests

**Unit tests for `getPlatformAIModel()`:**
1. Returns default provider model when default has active key
2. Falls back to next provider in fallback order when default has no key
3. Falls back through entire chain, returning first active
4. Throws descriptive error when no providers have active keys
5. Uses fallback key when primary is null but fallback exists
6. Respects `ai_fallback_order` from billing_config (custom ordering)
7. Skips providers not in `platform_ai_config` table

**Unit tests for `getPlatformAIModelForProvider()`:**
1. Returns specific provider model when key exists
2. Returns null when provider has no key
3. Uses custom model param when provided
4. Uses provider's default_model when model param omitted

**Unit tests for `getPlatformAPIKey()`:**
1. Returns decrypted primary key
2. Returns decrypted fallback key when primary is null
3. Returns null when neither key exists

**Unit tests for `getAllPlatformConfigs()`:**
1. Returns all active providers with decrypted keys
2. Includes fallback keys where present
3. Returns empty array when no providers configured

**Unit tests for `PlatformKeyCache`:**
1. Cache hit returns entry within TTL
2. Cache miss returns null for unknown provider
3. Cache expired returns null after TTL
4. `invalidate(provider)` removes single entry
5. `invalidateAll()` clears entire cache
6. `set()` overwrites existing entry

**Unit tests for extended `getUserAIModel()`:**
1. Returns user's own model when configured (existing behavior, no regression)
2. Returns null when no user config and no workspaceId
3. Returns null when no user config and workspace is `byo_keys` tier
4. Returns platform model when no user config and workspace is `managed_payg` tier
5. Returns user model even for `managed_payg` tier when user has own config (user preference wins)

**Integration test:**
- Seed platform_ai_config with keys, call `getPlatformAIModel()`, verify it returns a valid model instance (mock the actual AI call)

### i18n

Error messages (add to all 5 language files):

| Key | en |
|-----|-----|
| `errors:ai.noPlatformKey` | No platform AI key configured. Ask your administrator to add API keys in the admin dashboard. |
| `errors:ai.allProvidersFailed` | All configured AI providers failed. Check API key validity in admin settings. |
| `errors:ai.providerKeyMissing` | API key for provider "{{provider}}" is not configured. |

Translate to ar, fr, de, es.

### Documentation

Create `docs/{en,ar,fr,de,es}/ai/platform-keys.md`:
- Explain the platform key resolution flow
- Diagram: user request -> check user key -> check subscription tier -> platform key fallback
- Explain cache behavior (60s TTL, admin changes propagate within 60s)
- Explain fallback chain configuration
- Security: keys encrypted at rest, decrypted only in memory for API calls
