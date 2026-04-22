# 03 — Admin Backend API Extension: AI Provider Key Management

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/spec-driven-development/`

## Dependencies
- `01-admin-ai-keys-db-migration.md` (requires `platform_ai_config` table and `PlatformAiConfigRepository`)
- `02-platform-key-service.md` (requires `platformKeyCache` for cache invalidation on mutations)

## Task

Extend the existing admin AI providers backend API section in `gateway/src/api/main.ts` (lines 3383-3453) to support API key CRUD with encryption, test connection, fallback key management, default model configuration, and fallback order management. All endpoints are superadmin-gated and audit-logged. API keys are NEVER returned in plaintext.

### 1. Extend Existing Endpoints

**Modify `GET /api/admin/ai-providers`** (currently line 3402):

Change the response shape to include key status, default model, and fallback order:

```typescript
// Response shape:
{
  success: true,
  providers: Array<{
    provider: string;        // 'openai' | 'anthropic' | 'google' | 'openrouter'
    displayName: string;     // 'OpenAI', 'Anthropic', etc.
    enabled: boolean;        // is_active
    rateLimit: number;
    hasKey: boolean;         // true if api_key_encrypted is not null
    hasFallbackKey: boolean; // true if fallback_key_encrypted is not null
    maskedKey: string | null;   // 'sk-*****XXXX' or null
    maskedFallbackKey: string | null;
    defaultModel: string;    // e.g. 'gpt-4o'
    models: string[];        // e.g. ['gpt-4o', 'gpt-4o-mini', ...]
  }>,
  defaultProvider: {         // Global default
    provider: string;
    model: string;
  },
  fallbackOrder: string[]    // e.g. ['anthropic', 'openai', 'google', 'openrouter']
}
```

Read from `PlatformAiConfigRepository.listAll()` and `BillingConfigRepository.getDefaultAiProvider()` / `.getAiFallbackOrder()`.

**Modify `PATCH /api/admin/ai-providers`** (currently line 3407):

Keep backward compatibility for the enable/disable and rate limit updates, but also accept optional key-related fields per provider:

```typescript
// Request body (each field optional per provider):
{
  providers: Array<{
    provider: string;
    enabled?: boolean;
    rateLimit?: number;
    defaultModel?: string;
    models?: string[];
  }>
}
```

Note: API key updates have dedicated endpoints (below) for security — keys should not be sent in bulk updates.

### 2. New Endpoints

All new endpoints require `requireAuth` + `requireSuperAdmin` middleware.

#### `POST /api/admin/ai-providers/:provider/key`

Store or update the primary API key for a provider.

```typescript
// Request body:
{ apiKey: string }

// Validation:
// - provider must be one of KNOWN_AI_PROVIDERS
// - apiKey must be non-empty string, max 500 chars
// - Encrypt apiKey using encrypt() from secret-cipher.ts

// Logic:
// 1. Validate provider exists in platform_ai_config
// 2. Encrypt the API key
// 3. Call PlatformAiConfigRepository.upsertKey(provider, encryptedPayload)
// 4. Auto-enable the provider (is_active = true)
// 5. Invalidate platformKeyCache for this provider
// 6. Audit log: { action: 'ai-provider.key-set', provider, admin: req.user.id }
//    NEVER log the key itself

// Response:
{ success: true, provider: string, hasKey: true, maskedKey: 'sk-*****XXXX' }
```

#### `DELETE /api/admin/ai-providers/:provider/key`

Remove the primary API key for a provider.

```typescript
// Logic:
// 1. Call PlatformAiConfigRepository.removeKey(provider)
// 2. Auto-disable provider (is_active = false) unless fallback key exists
// 3. Invalidate platformKeyCache for this provider
// 4. Audit log: { action: 'ai-provider.key-removed', provider }

// Response:
{ success: true, provider: string, hasKey: false }
```

#### `POST /api/admin/ai-providers/:provider/fallback-key`

Store or update the fallback API key for a provider.

```typescript
// Request body:
{ apiKey: string }

// Same validation and encryption as primary key endpoint
// Audit log: { action: 'ai-provider.fallback-key-set', provider }

// Response:
{ success: true, provider: string, hasFallbackKey: true, maskedFallbackKey: 'sk-*****XXXX' }
```

#### `DELETE /api/admin/ai-providers/:provider/fallback-key`

Remove the fallback API key for a provider.

```typescript
// Response:
{ success: true, provider: string, hasFallbackKey: false }
```

#### `POST /api/admin/ai-providers/:provider/test`

Test the API connection for a provider's configured key.

```typescript
// Query params (optional):
// ?useFallback=true  — test the fallback key instead of primary

// Logic:
// 1. Decrypt the appropriate key (primary or fallback)
// 2. Create provider instance via selectAIProvider
// 3. Send minimal test prompt: "Say 'ok'" with max_tokens=5
// 4. Measure latency
// 5. Return result

// Response (success):
{ success: true, ok: true, latencyMs: number, provider: string }

// Response (failure):
{ success: true, ok: false, error: string, provider: string }

// Response (no key):
{ success: false, error: 'No API key configured for this provider' }
```

Follow the same pattern as the existing user-level test in `gateway/src/api/me/ai-config.ts` (lines 262-308).

#### `PATCH /api/admin/ai-providers/default-model`

Set the global default AI provider and model.

```typescript
// Request body:
{
  provider: string,  // Must be an active provider with a key
  model: string      // Must be in the provider's models list
}

// Validation:
// - Provider must exist in platform_ai_config and be active
// - Model must be in the provider's configured models array

// Logic:
// 1. Validate provider is active
// 2. Validate model is in provider's models list
// 3. Call BillingConfigRepository.setDefaultAiProvider(provider, model)
// 4. Invalidate platformKeyCache
// 5. Audit log: { action: 'ai-provider.default-changed', provider, model }

// Response:
{ success: true, defaultProvider: { provider, model } }
```

#### `PATCH /api/admin/ai-providers/fallback-order`

Set the fallback provider order.

```typescript
// Request body:
{ order: string[] }  // e.g. ['anthropic', 'openai', 'google', 'openrouter']

// Validation:
// - All entries must be known providers
// - No duplicates
// - Array must contain all known providers (complete ordering)

// Logic:
// 1. Validate all providers
// 2. Call BillingConfigRepository.setAiFallbackOrder(order)
// 3. Invalidate platformKeyCache
// 4. Audit log: { action: 'ai-provider.fallback-order-changed', order }

// Response:
{ success: true, fallbackOrder: string[] }
```

### 3. Update Admin Frontend API Service

**File:** `admin-frontend/src/services/api.ts` (extend from line 322)

Update the `AIProviderEntry` interface and add new API functions:

```typescript
export interface AIProviderEntry {
  provider: string;
  displayName: string;
  enabled: boolean;
  rateLimit: number;
  hasKey: boolean;
  hasFallbackKey: boolean;
  maskedKey: string | null;
  maskedFallbackKey: string | null;
  defaultModel: string;
  models: string[];
}

export interface AIProvidersConfig {
  providers: AIProviderEntry[];
  defaultProvider: { provider: string; model: string };
  fallbackOrder: string[];
}

// Existing (modified return type):
export async function getAIProviders(): Promise<AIProvidersConfig>
export async function updateAIProviders(providers: Partial<AIProviderEntry>[]): Promise<AIProvidersConfig>

// New:
export async function setProviderKey(provider: string, apiKey: string): Promise<{ hasKey: boolean; maskedKey: string }>
export async function removeProviderKey(provider: string): Promise<void>
export async function setProviderFallbackKey(provider: string, apiKey: string): Promise<{ hasFallbackKey: boolean; maskedFallbackKey: string }>
export async function removeProviderFallbackKey(provider: string): Promise<void>
export async function testProviderKey(provider: string, useFallback?: boolean): Promise<{ ok: boolean; latencyMs?: number; error?: string }>
export async function setDefaultModel(provider: string, model: string): Promise<void>
export async function setFallbackOrder(order: string[]): Promise<void>
```

### 4. Audit Logging

All mutations must create audit log entries. Follow the existing pattern in `gateway/src/api/main.ts` lines 3441-3444:

```typescript
await auditRepository.create({
  user_id: req.user!.id,
  action: 'ai-provider.key-set',  // or key-removed, fallback-key-set, etc.
  resource_type: 'platform_ai_config',
  resource_id: provider,
  metadata: { provider },  // NEVER include key material
  ip_address: req.ip,
});
```

### 5. Security Requirements

- **Keys NEVER in responses:** Only `maskedKey` format (`sk-*****XXXX`, last 4 chars)
- **Keys NEVER in audit logs:** Log the action and provider, never the key
- **Keys NEVER in error messages:** If decryption fails, say "key decryption failed" not the key
- **Encryption at rest:** AES-256-GCM via `gateway/src/utils/crypto/secret-cipher.ts`
- **Superadmin only:** All endpoints require `requireSuperAdmin` middleware
- **Rate limiting:** Apply existing admin rate limiter

### Tests

**Supertest integration tests for each endpoint:**

1. **GET /api/admin/ai-providers**
   - Returns all 4 providers with correct shape
   - Returns `hasKey: false` for all initially (no keys seeded)
   - Returns correct defaultProvider and fallbackOrder from billing_config
   - Non-superadmin gets 403
   - Unauthenticated gets 401

2. **POST /api/admin/ai-providers/:provider/key**
   - Sets key, returns `maskedKey` with last 4 chars
   - Auto-enables provider (`enabled: true`)
   - Invalidates cache (mock `platformKeyCache.invalidate`)
   - Creates audit log entry
   - Invalid provider returns 400
   - Empty apiKey returns 400
   - Non-superadmin gets 403

3. **DELETE /api/admin/ai-providers/:provider/key**
   - Removes key, sets `hasKey: false`
   - Auto-disables provider
   - Creates audit log entry
   - Provider with no key returns 404 or 200 (idempotent)

4. **POST /api/admin/ai-providers/:provider/fallback-key**
   - Stores fallback key, returns masked
   - Creates audit log entry

5. **DELETE /api/admin/ai-providers/:provider/fallback-key**
   - Removes fallback key
   - Creates audit log entry

6. **POST /api/admin/ai-providers/:provider/test**
   - With valid key: returns `{ ok: true, latencyMs: ... }` (mock AI call)
   - With invalid/expired key: returns `{ ok: false, error: '...' }`
   - With no key: returns error
   - `?useFallback=true`: tests fallback key instead
   - Non-superadmin gets 403

7. **PATCH /api/admin/ai-providers/default-model**
   - Sets default, verify via GET
   - Rejects inactive provider
   - Rejects model not in provider's models list
   - Creates audit log entry

8. **PATCH /api/admin/ai-providers/fallback-order**
   - Sets order, verify via GET
   - Rejects unknown providers
   - Rejects duplicates
   - Rejects incomplete list (must include all known providers)
   - Creates audit log entry

9. **Key masking:**
   - Key `sk-proj-abc123XYZ` → `sk-*****3XYZ`
   - Key with < 4 chars → `sk-*****` (no reveal)
   - Null key → `null`

10. **Cache invalidation:**
    - Every mutation endpoint calls `platformKeyCache.invalidate()`

### i18n

Backend error messages (add to all 5 language files):

| Key | en |
|-----|-----|
| `errors:ai.keyRequired` | API key is required |
| `errors:ai.keyTooLong` | API key exceeds maximum length |
| `errors:ai.testFailed` | Connection test failed: {{error}} |
| `errors:ai.testNoKey` | No API key configured for {{provider}} |
| `errors:ai.invalidProvider` | Unknown AI provider: {{provider}} |
| `errors:ai.invalidFallbackOrder` | Fallback order must include all known providers without duplicates |
| `errors:ai.providerNotActive` | Provider {{provider}} is not active. Configure an API key first. |
| `errors:ai.modelNotAvailable` | Model {{model}} is not available for {{provider}} |

Translate to ar, fr, de, es.

### Documentation

Update `docs/{en,ar,fr,de,es}/admin/platform-controls.md`:
- Document all new API endpoints with request/response examples
- Document the key management workflow (add key -> test -> set default -> configure fallback)
- Security section: encryption, masking, audit logging
