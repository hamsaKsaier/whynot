# Platform Key Resolution

Platform key resolution provides centralized AI API key management for all managed-tier operations. Instead of storing keys in environment variables, administrators configure and rotate keys through the admin dashboard.

## Resolution Flow

```
User request
  -> Check user's own AI config (getUserAIModel)
  -> If no user config + managed_payg tier
       -> Platform key resolution (getPlatformAIModel)
            -> Read default provider from billing_config
            -> Decrypt key from platform_ai_config
            -> If default provider has no active key
                 -> Iterate ai_fallback_order
                 -> Return first provider with active key
            -> If no providers have keys
                 -> Throw errors:ai.noPlatformKey
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `getPlatformAIModel()` | Returns the default platform AI model instance with fallback chain |
| `getPlatformAIModelForProvider(provider, model?)` | Returns a model instance for a specific provider |
| `getPlatformAPIKey(provider)` | Returns the decrypted raw API key for a provider |
| `getAllPlatformConfigs()` | Returns all active providers with decrypted keys (internal use only) |

## Cache Behavior

Decrypted keys are cached in-memory for **60 seconds** to avoid hitting the database on every AI request.

- Cache is a global singleton (`platformKeyCache`)
- Entries expire automatically after 60s TTL
- Admin API endpoints call `platformKeyCache.invalidate(provider)` when keys are modified
- `platformKeyCache.invalidateAll()` clears the entire cache

**Propagation delay:** Admin changes to keys propagate within 60 seconds. In practice, most requests see the new key within a few seconds as cache entries expire naturally.

## Fallback Chain

The fallback chain is configured via two `billing_config` entries:

1. **`default_ai_provider`** - JSON object `{ provider, model }` specifying the primary provider
2. **`ai_fallback_order`** - JSON array of provider identifiers in priority order (e.g., `["openai", "anthropic", "google"]`)

When `getPlatformAIModel()` is called:

1. Try the default provider first
2. If default has no active key, iterate the fallback order
3. Skip the default provider in the fallback list (already tried)
4. Return the first provider with an active, decrypted key
5. If none have keys, throw `errors:ai.noPlatformKey`

### Fallback Key Support

Each provider can have both a **primary key** and a **fallback key**:

- Primary key (`api_key_encrypted`) is tried first
- If primary is null but fallback exists (`fallback_key_encrypted`), the fallback is used
- This handles key rotation: admin sets new primary, old key stays as fallback until fully rotated

## Security

- All API keys are **encrypted at rest** using AES-256-GCM
- Keys are stored as three columns: ciphertext, IV, and authentication tag
- Decryption happens **only in memory** when needed for API calls
- The encryption key is configured via `SECRETS_ENCRYPTION_KEY` environment variable
- `getAllPlatformConfigs()` is restricted to internal API endpoints — never exposed publicly
- Masked keys (format `sk-*****XXXX`) are used in all admin-facing responses

## Managed Tier Integration

The `getUserAIModel()` function handles the tier-based fallback:

1. If the user has their own AI config, use it (all tiers)
2. If no user config and workspace is on `managed_payg` tier, fall back to `getPlatformAIModel()`
3. If no user config and workspace is on `byo_keys` tier, return null (user must configure their own key)

This ensures managed-tier users get AI functionality out of the box without configuring their own keys.
