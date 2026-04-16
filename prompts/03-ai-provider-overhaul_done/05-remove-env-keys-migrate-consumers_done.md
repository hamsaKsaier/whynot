# 05 — Remove .env AI Keys & Migrate All Consumers

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/spec-driven-development/`

## Dependencies
- `02-platform-key-service.md` (requires `getPlatformAIModel()`, `getPlatformAPIKey()`, `getAllPlatformConfigs()`)

## Task

Remove all AI-related environment variables from the gateway config and `.env.example`, then migrate every consumer file to use the platform key resolution service instead of reading `process.env` directly. Also add an internal API endpoint for cross-container key access by the qa-loop-executor service.

**CRITICAL CONSTRAINT:** Do NOT modify any file under `services/qa-loop-executor/src/v2/`. The v2 agent path retains its own `process.env`-based key resolution.

### 1. Remove AI Env Vars from Config

**File:** `gateway/src/config/env.ts` (lines 85-91)

Remove these 6 entries from the `envSchema`:

```typescript
// DELETE these lines:
LLM_PROVIDER: z.string().default('anthropic'),
ANTHROPIC_API_KEY: z.string().default(''),
ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
OPENAI_API_KEY: z.string().default(''),
OPENAI_MODEL: z.string().default('gpt-4'),
OPENAI_VISION_MODEL: z.string().default('gpt-4o'),
```

Remove the `// -- AI Providers` comment section header as well.

**Note:** This changes the `Env` type — any code referencing `env.ANTHROPIC_API_KEY`, `env.OPENAI_API_KEY`, etc. will fail TypeScript compilation, which is the intended forcing function to migrate all consumers.

### 2. Update `.env.example`

**File:** `.env.example` (lines ~71-91, the AI Providers section)

Replace the AI Providers section with a note pointing to the admin UI:

```bash
# ── AI Providers ────────────────────────────────────────────────────────
# AI provider API keys are now managed via the admin dashboard:
#   https://admin.whynot.skrum.io/ai-providers
#
# The platform reads keys from the database (platform_ai_config table).
# See docs/en/ai/providers.md for details.
#
# NOTE: services/qa-loop-executor/src/v2/ still reads from env vars.
# Set these ONLY if you use the v2 agent path:
# OPENROUTER_API_KEY=
# GOOGLE_AI_API_KEY=
# Z_AI_API_KEY=
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
```

### 3. Add Internal API Endpoint

**File:** `gateway/src/api/main.ts` — add a new internal endpoint section

Create `GET /api/internal/ai-config` — an internal-only endpoint that returns decrypted platform AI keys. This is consumed by the qa-loop-executor service running in a separate Docker container.

```typescript
// ── Internal: AI Config (Docker-network only, no auth) ──────────────────
// This endpoint is NOT exposed to the public internet.
// It is accessed only by internal services on the Docker network.
// Restricted by Docker network configuration + IP allowlist middleware.

app.get('/api/internal/ai-config',
  requireInternalNetwork,  // Middleware that checks req.ip is from Docker network
  asyncHandler(async (_req, res) => {
    const configs = await getAllPlatformConfigs();
    const billingConfigRepo = new BillingConfigRepository();
    const defaultProvider = await billingConfigRepo.getDefaultAiProvider();
    const fallbackOrder = await billingConfigRepo.getAiFallbackOrder();

    res.json({
      success: true,
      providers: configs,
      defaultProvider,
      fallbackOrder,
    });
  })
);
```

**New middleware:** `gateway/src/middleware/internal-network.ts`

```typescript
export function requireInternalNetwork(req, res, next) {
  const allowedPrefixes = ['172.', '10.', '192.168.', '127.0.0.1', '::1'];
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const isInternal = allowedPrefixes.some(prefix => clientIp.startsWith(prefix));

  if (!isInternal) {
    return res.status(403).json({
      error: 'This endpoint is only accessible from internal network',
      code: 'INTERNAL_ONLY',
    });
  }
  next();
}
```

### 4. Migrate Gateway Consumers

#### 4a. `gateway/src/services/auto-fix-service.ts` (line 52)

**Current:**
```typescript
const apiKey = env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY is required for auto-fix service');
}
this.aiProvider = selectAIProvider({
  apiUrl: 'https://api.anthropic.com',
  apiKey,
});
```

**New:**
```typescript
// Move to async initialization
private aiModel: Awaited<ReturnType<typeof getPlatformAIModel>> | null = null;

async initialize() {
  this.aiModel = await getPlatformAIModel();
}

// Or lazily initialize on first use:
private async getAIModel() {
  if (!this.aiModel) {
    this.aiModel = await getPlatformAIModel();
  }
  return this.aiModel;
}
```

Import `getPlatformAIModel` from `../utils/ai/get-platform-ai-model`.

**Important:** The constructor currently throws synchronously if no key. The new approach is async, so either:
- Add an `initialize()` method called at service startup, or
- Make it lazy (preferred — initialized on first use)

### 5. Migrate qa-loop-executor Consumers (non-v2 only)

These files run in a separate container and need to fetch platform config via the internal API.

**Create helper:** `services/qa-loop-executor/src/platform-config.ts`

```typescript
import axios from 'axios';

interface PlatformAIConfig {
  provider: string;
  apiKey: string;
  fallbackKey: string | null;
  defaultModel: string;
  models: string[];
}

interface PlatformConfig {
  providers: PlatformAIConfig[];
  defaultProvider: { provider: string; model: string };
  fallbackOrder: string[];
}

let cachedConfig: PlatformConfig | null = null;

export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig;

  const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3010';
  const res = await axios.get(`${gatewayUrl}/api/internal/ai-config`);
  cachedConfig = res.data;
  return cachedConfig!;
}

export async function getPlatformKey(provider: string): Promise<string | null> {
  const config = await getPlatformConfig();
  const entry = config.providers.find(p => p.provider === provider);
  return entry?.apiKey || null;
}

export function invalidatePlatformConfigCache(): void {
  cachedConfig = null;
}
```

#### 5a. `services/qa-loop-executor/src/claude-session.ts` (line 70)

**Current:**
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY;
```

**New:**
```typescript
const apiKey = await getPlatformKey('anthropic');
if (!apiKey) throw new Error('No Anthropic API key configured on platform');
```

Import `getPlatformKey` from `./platform-config`.

Note: If the function containing this line is synchronous, it must be converted to async. Trace the call chain and update callers accordingly.

#### 5b. `services/qa-loop-executor/src/loop-orchestrator.ts` (line 1151)

**Current:**
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY;
```

**New:**
```typescript
const apiKey = await getPlatformKey('anthropic');
```

Same pattern. Update surrounding function to async if needed.

#### 5c. `services/qa-loop-executor/src/agents/detective-agent.ts` (line 96)

**Current:**
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY;
```

**New:**
```typescript
const apiKey = await getPlatformKey('anthropic');
if (!apiKey) throw new Error('No Anthropic API key configured on platform');
```

#### 5d. `services/qa-loop-executor/src/gemma-session.ts` (line 45)

**Current:**
```typescript
const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
}
```

**New:**
```typescript
const apiKey = await getPlatformKey('google');
if (!apiKey) {
  throw new Error('No Google AI API key configured on platform. Add one at the admin dashboard.');
}
```

#### 5e. `services/qa-loop-executor/src/model-selector.ts` (line 91)

**Current:**
```typescript
const defaultExploreModel: ClaudeModel = process.env.GOOGLE_AI_API_KEY
  ? 'gemma-4' : 'claude-sonnet';
```

**New:**
```typescript
// This needs to be async now, or use a pre-loaded config
let platformConfig: PlatformConfig | null = null;

export async function initModelSelector() {
  platformConfig = await getPlatformConfig();
}

function getDefaultExploreModel(): ClaudeModel {
  const hasGoogle = platformConfig?.providers.some(p => p.provider === 'google' && p.apiKey);
  return hasGoogle ? 'gemma-4' : 'claude-sonnet';
}
```

#### 5f. `services/qa-loop-executor/src/index.ts` (line 117)

**Current:**
```typescript
anthropicConfigured: !!process.env.ANTHROPIC_API_KEY
```

**New:**
```typescript
// At startup, fetch platform config
const platformConfig = await getPlatformConfig();
// ...
anthropicConfigured: platformConfig.providers.some(p => p.provider === 'anthropic' && p.apiKey)
```

### 6. Update Test Setup

**File:** `gateway/src/__tests__/setup.ts` (lines 6-7)

**Current:**
```typescript
process.env.ANTHROPIC_API_KEY = 'test-stub';
process.env.OPENAI_API_KEY = 'test-stub';
```

**Remove** these lines. Instead, seed the `platform_ai_config` table with test keys in the test setup:

```typescript
import { encrypt } from '../utils/crypto/secret-cipher';

// In beforeAll or test setup:
const testKey = encrypt('test-stub-key');
await query(
  `INSERT INTO platform_ai_config (provider, display_name, api_key_encrypted, api_key_iv, api_key_tag, is_active, default_model, models)
   VALUES ($1, $2, $3, $4, $5, true, $6, $7::jsonb)
   ON CONFLICT (provider) DO UPDATE SET api_key_encrypted = $3, api_key_iv = $4, api_key_tag = $5, is_active = true`,
  ['anthropic', 'Anthropic', testKey.ciphertext, testKey.iv, testKey.tag, 'claude-sonnet-4-6', JSON.stringify(['claude-sonnet-4-6'])]
);
```

### 7. Update Documentation Examples

**Files:** `docs/{en,ar,fr,de,es}/ai/providers.md`

Replace `process.env.ANTHROPIC_API_KEY!` examples (line 23 in all 5 files) with:

```typescript
import { getPlatformAIModel } from '../utils/ai/get-platform-ai-model';

const model = await getPlatformAIModel();
// model is ready to use for AI calls
```

### 8. Files NOT to modify

**CRITICAL — DO NOT TOUCH:**
- `services/qa-loop-executor/src/v2/agents/base-agent.ts` — v2 retains env-based reads
- Any file under `services/qa-loop-executor/src/v2/` — entire v2 directory is untouchable
- `services/qa-loop-executor/scripts/test-zai.ts` — standalone test script, keep env-based

### Tests

**Gateway tests:**
1. Gateway boots without AI env vars when `platform_ai_config` has active keys
2. Gateway boot: `auto-fix-service` initializes correctly from platform config
3. `getPlatformAIModel()` works end-to-end (DB seed -> decrypt -> model instance)
4. Internal API endpoint returns decrypted keys for internal network
5. Internal API endpoint returns 403 for external network
6. Env schema validates without AI fields (no startup crash)

**qa-loop-executor tests:**
7. `getPlatformConfig()` fetches from internal API, caches result
8. `getPlatformKey('anthropic')` returns correct key
9. `getPlatformKey('nonexistent')` returns null
10. `invalidatePlatformConfigCache()` forces re-fetch
11. `claude-session` initializes with platform key
12. `detective-agent` initializes with platform key
13. `gemma-session` initializes with platform key
14. `model-selector` uses platform config for explore model selection
15. `index.ts` health check reports correct `anthropicConfigured` status

**Regression tests:**
16. All existing tests that were using `process.env.ANTHROPIC_API_KEY = 'test-stub'` still pass with DB-seeded keys
17. TypeScript compilation succeeds (no references to removed env vars)

### i18n

Update error messages that reference env var names:

| Key | en (old) | en (new) |
|-----|----------|----------|
| (in auto-fix-service) | ANTHROPIC_API_KEY is required for auto-fix service | No AI provider configured. Add API keys in the admin dashboard. |
| (in gemma-session) | GOOGLE_AI_API_KEY environment variable is not set | No Google AI API key configured on platform. Add one at the admin dashboard. |
| (in detective-agent) | (inline error) | No Anthropic API key configured on platform |

Add to all 5 language files:

| Key | en |
|-----|-----|
| `errors:ai.noPlatformConfig` | Platform AI configuration is not available. Contact your administrator. |
| `errors:ai.internalApiUnreachable` | Unable to reach platform AI configuration service. |

Translate to ar, fr, de, es.

### Documentation

**Update:** `docs/{en,ar,fr,de,es}/ai/providers.md`
- Replace all `.env`-based setup instructions with admin dashboard instructions
- Document the internal API endpoint for service-to-service communication
- Add migration guide: "If upgrading from a version that used .env for AI keys, you must now configure keys via the admin dashboard"

**Update:** `docs/{en,ar,fr,de,es}/deployment/environment-variables.md` (create if not exists)
- Remove AI-related env vars from the required list
- Note that AI keys are now in the database

### Verification

1. Remove all AI env vars from `.env` file
2. Start the gateway: `make start`
3. Verify gateway boots without errors (if platform_ai_config has keys in DB)
4. Run auto-fix: should use platform key
5. Run qa-loop (non-v2): should fetch key via internal API
6. TypeScript compilation: `make shell-gateway npx tsc --noEmit` — zero errors
7. All tests pass: `make test`
