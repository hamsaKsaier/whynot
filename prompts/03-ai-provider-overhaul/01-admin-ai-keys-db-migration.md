# 01 — Database Migration: Platform AI Config

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/spec-driven-development/`

## Dependencies
None (first in chain)

## Task

Create the database migration and repository for storing platform-level (admin-managed) AI API keys with AES-256-GCM encryption, default model configuration, and fallback provider ordering. This replaces the current `.env`-based key storage approach.

### 1. New Migration: `services/database/migrations/048_platform_ai_config.sql`

Create a new table `platform_ai_config` to store encrypted API keys per AI provider at the platform level (managed by super-admins via the admin dashboard).

```sql
CREATE TABLE IF NOT EXISTS platform_ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,           -- 'openai' | 'anthropic' | 'google' | 'openrouter'
  display_name VARCHAR(100) NOT NULL,       -- Human-readable label, e.g. 'OpenAI'
  api_key_encrypted BYTEA,                  -- NULL if no key configured
  api_key_iv BYTEA,                         -- AES-256-GCM initialization vector
  api_key_tag BYTEA,                        -- AES-256-GCM authentication tag
  fallback_key_encrypted BYTEA,             -- Optional fallback key (same encryption)
  fallback_key_iv BYTEA,
  fallback_key_tag BYTEA,
  default_model VARCHAR(100),               -- Default model for this provider, e.g. 'gpt-4o'
  models JSONB DEFAULT '[]'::jsonb,         -- Available models list, e.g. ["gpt-4o", "gpt-4o-mini"]
  is_active BOOLEAN DEFAULT false,          -- Only active if a valid key is configured
  rate_limit INTEGER DEFAULT 0,             -- Requests/minute, 0 = unlimited
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider)
);

CREATE INDEX idx_platform_ai_config_provider ON platform_ai_config(provider);
CREATE INDEX idx_platform_ai_config_active ON platform_ai_config(is_active);
```

Also add two `billing_config` seed entries:

```sql
INSERT INTO billing_config (key, value) VALUES
  ('default_ai_provider', '{"provider": "anthropic", "model": "claude-sonnet-4-6"}'),
  ('ai_fallback_order', '["anthropic", "openai", "google", "openrouter"]')
ON CONFLICT (key) DO NOTHING;
```

Seed the 4 known providers (without keys, inactive by default):

```sql
INSERT INTO platform_ai_config (provider, display_name, default_model, models, is_active) VALUES
  ('openai', 'OpenAI', 'gpt-4o', '["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"]'::jsonb, false),
  ('anthropic', 'Anthropic', 'claude-sonnet-4-6', '["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022"]'::jsonb, false),
  ('google', 'Google AI', 'gemini-2.0-flash', '["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"]'::jsonb, false),
  ('openrouter', 'OpenRouter', 'anthropic/claude-sonnet-4', '["anthropic/claude-sonnet-4", "openai/gpt-4o", "google/gemini-2.0-flash-001", "meta-llama/llama-3.1-405b-instruct"]'::jsonb, false)
ON CONFLICT (provider) DO NOTHING;
```

### 2. New Repository: `shared/database/repositories/platform-ai-config-repository.ts`

Create a repository class following the existing pattern from `user-ai-config-repository.ts` (`gateway/shared/database/repositories/user-ai-config-repository.ts`).

**Methods required:**

| Method | Description |
|--------|-------------|
| `listAll()` | Returns all providers with key status (never return plaintext keys) |
| `findByProvider(provider: string)` | Returns single provider config |
| `findActive()` | Returns only providers with `is_active = true` |
| `upsertKey(provider, encryptedKey)` | Store/update encrypted API key; auto-set `is_active = true` |
| `upsertFallbackKey(provider, encryptedKey)` | Store/update encrypted fallback key |
| `removeKey(provider)` | Remove primary key; set `is_active = false` if no fallback |
| `removeFallbackKey(provider)` | Remove fallback key only |
| `getDecryptedKey(provider)` | Returns decrypted primary key (for internal use only, never expose via API) |
| `getDecryptedFallbackKey(provider)` | Returns decrypted fallback key |
| `updateModels(provider, models: string[])` | Update available models list |
| `updateDefaultModel(provider, model: string)` | Update default model |
| `setActive(provider, active: boolean)` | Toggle active state |
| `updateRateLimit(provider, rateLimit: number)` | Update rate limit |

**Encryption:** Reuse the existing `encrypt`/`decrypt` from `gateway/src/utils/crypto/secret-cipher.ts` (same AES-256-GCM used by `user_ai_config`).

**Return types:** Define a `PlatformAiConfigEntity` interface matching the table columns, and a `PlatformAiConfigSafe` interface that omits all encrypted key fields and adds `hasKey: boolean`, `hasFallbackKey: boolean`, `maskedKey: string | null`, `maskedFallbackKey: string | null`.

**Key masking:** Follow the pattern from `gateway/src/api/me/ai-config.ts` line 21: show only last 4 characters preceded by `sk-*****`.

### 3. Extend `billing-config-repository.ts`

Add convenience methods:

```typescript
async getDefaultAiProvider(): Promise<{ provider: string; model: string } | null>
async setDefaultAiProvider(provider: string, model: string): Promise<void>
async getAiFallbackOrder(): Promise<string[]>
async setAiFallbackOrder(order: string[]): Promise<void>
```

These read/write `default_ai_provider` and `ai_fallback_order` keys as JSON strings in the existing `billing_config` table.

### 4. Update Test Setup

In `gateway/src/__tests__/setup.ts`, add test seeding for `platform_ai_config` table with stub keys so existing tests don't break.

### Tests

**Unit tests for `PlatformAiConfigRepository`:**
- `listAll()` returns all 4 seeded providers
- `findByProvider('openai')` returns the openai row
- `findActive()` returns empty when no keys configured
- `upsertKey()` stores encrypted key, sets `is_active = true`, verify round-trip with `getDecryptedKey()`
- `upsertFallbackKey()` stores fallback, verify round-trip
- `removeKey()` clears primary, sets `is_active = false`
- `removeKey()` with fallback present: still mark inactive (primary is required for active)
- `removeFallbackKey()` clears fallback only
- `updateModels()` stores and retrieves JSONB array
- `updateDefaultModel()` stores and retrieves
- `setActive()` with no key configured should throw/fail (can't activate without key)
- `updateRateLimit()` with negative number should throw
- Unique constraint: `upsertKey` twice for same provider updates rather than duplicates
- Encryption round-trip: plaintext -> encrypt -> store -> retrieve -> decrypt -> plaintext matches

**Unit tests for `BillingConfigRepository` extensions:**
- `getDefaultAiProvider()` returns seeded default
- `setDefaultAiProvider()` updates, re-read matches
- `getAiFallbackOrder()` returns seeded order
- `setAiFallbackOrder()` updates, re-read matches
- `getDefaultAiProvider()` with missing key returns null

**Migration test:**
- Migration applies without errors on clean DB
- Migration is idempotent (re-run doesn't fail due to `IF NOT EXISTS` and `ON CONFLICT`)
- Seed data inserted correctly

### i18n

Backend-only migration — no UI strings. Error messages from the repository should use the following keys (add to all 5 language files under `errors` namespace in gateway):

| Key | en | ar | fr | de | es |
|-----|----|----|----|----|-----|
| `errors:ai.providerNotFound` | AI provider not found | ... | ... | ... | ... |
| `errors:ai.cannotActivateWithoutKey` | Cannot activate provider without an API key | ... | ... | ... | ... |
| `errors:ai.invalidRateLimit` | Rate limit must be a non-negative integer | ... | ... | ... | ... |

### Documentation

Update `docs/{en,ar,fr,de,es}/ai/providers.md`:
- Add section explaining platform AI config table schema
- Document that API keys are now stored encrypted in the database, managed by super-admins
- Remove references to `.env`-based API key configuration (but note this will be fully removed in prompt 05)
