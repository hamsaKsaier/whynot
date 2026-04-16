# 06 — User Settings AI Tab: Alignment with Admin Config

## Agent
`frontend-developer` (lead), `api-designer` (backend changes)

## Skills referenced
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/rtl-support-arabic.md`
- `.claude/rules/url-tab-state.md`

## Dependencies
- `03-admin-ai-providers-api-extension.md` (requires admin API to return provider/model lists)
- `05-remove-env-keys-migrate-consumers.md` (requires platform key service to be operational)

## Task

Update the user-facing AI settings tab (`frontend/src/pages/settings/tabs/AiTab.tsx`, currently 342 lines) to dynamically read available providers and models from the admin configuration instead of using hardcoded `PROVIDER_LABELS` and `PROVIDER_MODELS` constants. Enforce subscription tier logic: `byo_keys` tier users must provide their own keys; `managed_payg` tier users can optionally provide keys or rely on platform-managed keys.

### 1. Extend Backend Endpoint

**File:** `gateway/src/api/main.ts` — modify `GET /api/me/ai-providers` (line 3449)

**Current response:**
```json
{ "success": true, "providers": ["openai", "anthropic"] }
```

**New response:**
```json
{
  "success": true,
  "providers": [
    {
      "provider": "openai",
      "displayName": "OpenAI",
      "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"],
      "defaultModel": "gpt-4o"
    },
    {
      "provider": "anthropic",
      "displayName": "Anthropic",
      "models": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022"],
      "defaultModel": "claude-sonnet-4-6"
    }
  ],
  "tier": "byo_keys",
  "hasPlatformKeys": true,
  "platformDefault": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6"
  }
}
```

**Logic:**
1. Fetch active providers from `PlatformAiConfigRepository.findActive()`
2. For each active provider, return `provider`, `displayName`, `models`, `defaultModel`
3. Determine user's subscription tier:
   ```typescript
   const subscription = await subscriptionRepo.findByWorkspaceId(req.workspaceId);
   const plan = subscription ? await planRepo.findById(subscription.plan_id) : null;
   const tier = plan ? PLANS[plan.slug]?.tier || 'byo_keys' : 'byo_keys';
   ```
4. Check if platform has any keys configured: `hasPlatformKeys = providers.length > 0`
5. Get platform default from `BillingConfigRepository.getDefaultAiProvider()`
6. Always include `custom` provider option (OpenAI-compatible) if the user's plan supports it

**Also add:** `GET /api/me/ai-providers` should always include the `custom` provider option since users can bring any OpenAI-compatible API:
```json
{
  "provider": "custom",
  "displayName": "Custom (OpenAI-compatible)",
  "models": [],
  "defaultModel": ""
}
```

### 2. Update Frontend AiTab Component

**File:** `frontend/src/pages/settings/tabs/AiTab.tsx`

#### 2a. Remove Hardcoded Constants

**Delete** (lines 17-33):
```typescript
// DELETE:
type ProviderName = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';

const PROVIDER_LABELS: Record<ProviderName, string> = { ... };
const PROVIDER_MODELS: Record<ProviderName, string[]> = { ... };
```

**Replace with** data fetched from the API:
```typescript
interface AvailableProvider {
  provider: string;
  displayName: string;
  models: string[];
  defaultModel: string;
}

interface AIProvidersData {
  providers: AvailableProvider[];
  tier: 'byo_keys' | 'managed_payg';
  hasPlatformKeys: boolean;
  platformDefault: { provider: string; model: string } | null;
}
```

#### 2b. Fetch Available Providers

Add a new API call to load available providers on mount:

```typescript
const [availableProviders, setAvailableProviders] = useState<AIProvidersData | null>(null);

useEffect(() => {
  async function fetchProviders() {
    const res = await apiClient.get('/me/ai-providers');
    setAvailableProviders(res.data);
  }
  fetchProviders();
}, []);
```

#### 2c. Update Provider Dropdown

The provider dropdown in the "Add provider" form should use `availableProviders` instead of hardcoded constants:

```tsx
<select
  value={formProvider}
  onChange={(e) => handleProviderChange(e.target.value)}
  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
>
  {availableProviders?.providers.map((p) => (
    <option key={p.provider} value={p.provider}>{p.displayName}</option>
  ))}
</select>
```

#### 2d. Update Model Dropdown

The model dropdown should use models from the selected provider's config:

```tsx
const selectedProviderData = availableProviders?.providers.find(p => p.provider === formProvider);
const models = selectedProviderData?.models || [];

{models.length > 0 ? (
  <select value={formModel} onChange={(e) => setFormModel(e.target.value)} ...>
    {models.map((m) => (
      <option key={m} value={m}>{m}</option>
    ))}
  </select>
) : (
  <input type="text" value={formModel} onChange={(e) => setFormModel(e.target.value)}
    placeholder={t('settings.ai.modelPlaceholder', 'e.g. my-model-v1')} ... />
)}
```

#### 2e. Add Tier-Aware UI

Show different messaging based on subscription tier:

```tsx
{/* Tier information banner */}
{availableProviders && (
  <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
    {availableProviders.tier === 'managed_payg' ? (
      <div>
        <p className="font-medium text-foreground">
          {t('settings.ai.tierInfo.managed')}
        </p>
        <p className="text-muted-foreground mt-0.5">
          {t('settings.ai.tierInfo.managedDesc')}
        </p>
        {availableProviders.hasPlatformKeys && configs.length === 0 && (
          <p className="text-muted-foreground mt-1">
            {t('settings.ai.usingPlatformKey')}
          </p>
        )}
      </div>
    ) : (
      <div>
        <p className="font-medium text-foreground">
          {t('settings.ai.tierInfo.byo')}
        </p>
        <p className="text-muted-foreground mt-0.5">
          {t('settings.ai.tierInfo.byoDesc')}
        </p>
      </div>
    )}
  </div>
)}
```

**For `managed_payg` users without their own keys:**
- Show an info box: "You're using the platform's managed AI keys. Add your own keys for custom provider access."
- Show which platform provider/model is active: "Currently using: Anthropic / claude-sonnet-4-6 (platform default)"

**For `byo_keys` users without any keys:**
- Show a prominent prompt: "You need to add an API key to use AI features. Add a provider below."
- NO access to platform keys (enforce this on the backend too)

**For users with their own keys (either tier):**
- Show their configured keys as currently implemented
- Show "Default" badge on the default provider
- User's own keys always take precedence over platform keys

### 3. Migrate to Shadcn UI Components

The current `AiTab.tsx` uses raw HTML elements (`<button>`, `<select>`, `<input>`) styled with Tailwind. Migrate to Shadcn UI components for consistency with the rest of the app:

- `<button>` -> `<Button>` from `../../components/ui/button`
- `<select>` -> `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>`
- `<input>` -> `<Input>` from `../../components/ui/input`
- `<label>` -> `<Label>` from `../../components/ui/label`
- Status badges -> `<Badge>` from `../../components/ui/badge`

Also replace `react-icons/fi` icons with Lucide icons (project standard):
- `FiPlus` -> `Plus`
- `FiTrash2` -> `Trash2`
- `FiCheck` -> `Check`
- `FiZap` -> `Zap`
- `FiEye` / `FiEyeOff` -> `Eye` / `EyeOff`
- `FiLoader` -> `Loader2`

### 4. Hardcoded Strings Audit

The current `AiTab.tsx` has several hardcoded English strings that need i18n:

- Line 154: `'Add provider'` — already has i18n key
- Line 251: `'Cancel'` — needs i18n
- Line 260: `'Saving...' : 'Save'` — needs i18n
- Line 269: `'No AI providers configured yet...'` — needs i18n
- Line 287: `'Default'` — needs i18n
- Lines 293: model/key display — already dynamic

Ensure ALL visible text uses `t()` with proper keys.

### 5. Design Rules Compliance

**Uncodixify UI:**
- Use `rounded-md` on buttons, `rounded-lg` on cards
- `transition-colors duration-150` only
- No hover lift, no shadow escalation
- `Loader2` with `animate-spin` for loading

**RTL Support:**
- All existing RTL compliance in AiTab is already good (uses `me-*`, `end-*`, etc.)
- Verify new elements also use logical properties
- Eye/EyeOff button: `end-2` positioning (already correct at line 240)

**URL Tab State:**
- The Settings page already uses `?tab=ai` — no changes needed
- Verify the tab still persists on refresh after changes

### Tests

**Vitest component tests (`frontend/src/pages/settings/tabs/__tests__/AiTab.test.tsx`):**

1. **Loading state:** Shows spinner while fetching providers
2. **Renders dynamic providers:** Shows only admin-enabled providers in dropdown (not hardcoded)
3. **Model dropdown updates:** Changing provider updates model list from API data
4. **Custom provider:** Shows text input for model when 'custom' selected
5. **byo_keys tier UI:** Shows "Bring Your Own Keys" info banner
6. **managed_payg tier UI:** Shows "Managed Keys" info banner
7. **managed_payg with no user keys:** Shows "Using platform key" message
8. **managed_payg with user keys:** Shows user's keys, no platform key message
9. **byo_keys with no keys:** Shows prominent "Add a key" prompt
10. **Admin disables provider:** Provider not shown in dropdown (mock API returns filtered list)
11. **Add key flow:** Fill form -> submit -> key appears in list (existing test, verify no regression)
12. **Test connection:** Click test -> shows result (existing test, verify no regression)
13. **Set default:** Click set default -> badge appears (existing test, verify no regression)
14. **Delete key:** Click delete -> key removed (existing test, verify no regression)
15. **RTL render:** Wrap in `dir="rtl"` -> verify layout
16. **No hardcoded strings:** All visible text comes from i18n (check `t()` coverage)

**Supertest API tests:**

17. **GET /api/me/ai-providers:** Returns correct shape with providers, tier, platformDefault
18. **GET /api/me/ai-providers with byo_keys subscription:** Returns `tier: 'byo_keys'`
19. **GET /api/me/ai-providers with managed_payg subscription:** Returns `tier: 'managed_payg'`
20. **GET /api/me/ai-providers with no subscription:** Returns `tier: 'byo_keys'` (default)
21. **GET /api/me/ai-providers:** Only returns active providers (disabled ones excluded)
22. **GET /api/me/ai-providers:** Always includes 'custom' option
23. **GET /api/me/ai-providers:** Returns correct models per provider from platform config

### i18n

Add the following keys to `frontend/public/locales/{en,ar,fr,de,es}/settings.json`:

| Key | en |
|-----|-----|
| `settings.ai.tierInfo.byo` | Bring Your Own Keys |
| `settings.ai.tierInfo.byoDesc` | Add your own AI provider API keys to use AI features. Your keys are encrypted and stored securely. |
| `settings.ai.tierInfo.managed` | Managed AI Keys |
| `settings.ai.tierInfo.managedDesc` | Your plan includes managed AI access. You can optionally add your own keys for custom provider access. |
| `settings.ai.usingPlatformKey` | You're currently using the platform's managed AI keys. No configuration needed. |
| `settings.ai.usingPlatformKeyProvider` | Currently using: {{provider}} / {{model}} (platform default) |
| `settings.ai.keyRequired` | You need to add an API key to use AI features. |
| `settings.ai.cancel` | Cancel |
| `settings.ai.saving` | Saving... |
| `settings.ai.save` | Save |
| `settings.ai.noConfigs` | No AI providers configured yet. Add one to use your own API keys. |
| `settings.ai.default` | Default |
| `settings.ai.modelPlaceholder` | e.g. my-model-v1 |

Translate all keys to ar, fr, de, es.

Also update existing keys if their hardcoded defaults have drifted from the translation files.

### Documentation

Update `docs/{en,ar,fr,de,es}/ai/user-config.md` (create if not exists):
- Explain the two subscription tiers and their AI key behavior
- Explain how admin-configured providers determine user options
- Explain platform key fallback for managed_payg users
- Add screenshots showing the settings tab for each tier

### Verification

1. **As admin:** Disable Google AI at `/ai-providers` -> save
2. **As byo_keys user:** Go to `/settings?tab=ai` -> verify Google AI not in provider dropdown
3. **As managed_payg user with no keys:** Go to `/settings?tab=ai` -> verify "Using platform key" message
4. **As managed_payg user:** Add own Anthropic key -> verify it shows as configured, "Default" badge
5. **Re-enable Google AI as admin** -> verify it appears in user's provider dropdown on refresh
6. **Arabic language:** Switch to Arabic -> verify all new text is translated, RTL layout correct
7. **Refresh page:** Verify `?tab=ai` persists (URL tab state)
8. Run tests: `make shell-client npm test`
