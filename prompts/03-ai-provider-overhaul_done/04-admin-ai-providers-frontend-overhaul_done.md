# 04 — Admin Frontend: AI Providers Page Overhaul

## Agent
`frontend-developer`

## Skills referenced
- `.claude/rules/uncodixify-ui.md`
- `.claude/rules/switch-component-styling.md`
- `.claude/rules/rtl-support-arabic.md`
- `.claude/rules/url-tab-state.md`

## Dependencies
- `03-admin-ai-providers-api-extension.md` (requires all new API endpoints to be implemented)

## Task

Overhaul `admin-frontend/src/pages/AIProvidersPage.tsx` (currently 179 lines with only enable/disable toggles and rate limit inputs) to add: API key management per provider, test connection buttons, fallback key support, default model picker, and fallback provider ordering.

### 1. Page Structure Redesign

**File:** `admin-frontend/src/pages/AIProvidersPage.tsx`

The page should have two main sections:

**Section A: Global Configuration (top)**
- Default model selector: provider dropdown + model dropdown (only providers with active keys are selectable)
- Fallback order: list with up/down arrow buttons to reorder (only providers with active keys included)

**Section B: Provider Cards (below)**
- One card per provider (openai, anthropic, google, openrouter)
- Each card contains:
  - Header: provider name + status badge (Active/Inactive) + enable/disable Switch
  - API key section: password input with show/hide toggle, Save/Update button
  - Key status: "Configured" badge (green) with masked key, or "Not configured" badge (gray)
  - Test connection button with result display (latency or error)
  - Fallback key section (collapsible): same as primary key but labeled "Fallback API Key (Optional)"
  - Rate limit input (existing)
  - Model configuration: default model dropdown, available models list

### 2. Component Design

Use Shadcn UI components from the existing design system:

```tsx
// Provider card structure:
<Card key={provider.provider}>
  <CardHeader className="pb-3">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <CardTitle className="text-base">{provider.displayName}</CardTitle>
        <Badge variant="outline" className={provider.enabled ? greenBadge : grayBadge}>
          {provider.enabled ? t('enabled') : t('disabled')}
        </Badge>
        {provider.hasKey && (
          <Badge variant="outline" className={greenBadge}>
            {t('admin.aiProviders.keyConfigured')}
          </Badge>
        )}
      </div>
      <Switch
        checked={provider.enabled}
        onCheckedChange={() => toggleProvider(provider.provider)}
        disabled={!provider.hasKey}  // Can't enable without a key
      />
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* API Key Section */}
    {/* Test Connection Button */}
    {/* Fallback Key Section (collapsible) */}
    {/* Model Configuration */}
    {/* Rate Limit */}
  </CardContent>
</Card>
```

### 3. API Key Input Section

Per provider card, add a key management section:

```tsx
// When no key configured:
<div className="space-y-2">
  <Label>{t('admin.aiProviders.apiKey')}</Label>
  <div className="flex gap-2">
    <div className="relative flex-1">
      <Input
        type={showKey[provider] ? 'text' : 'password'}
        value={keyInputs[provider] || ''}
        onChange={(e) => setKeyInput(provider, e.target.value)}
        placeholder="sk-..."
      />
      <button
        type="button"
        onClick={() => toggleShowKey(provider)}
        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {showKey[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    <Button onClick={() => saveKey(provider)} disabled={!keyInputs[provider]}>
      <Save className="h-4 w-4 me-1" />
      {t('admin.aiProviders.saveKey')}
    </Button>
  </div>
</div>

// When key is configured:
<div className="space-y-2">
  <Label>{t('admin.aiProviders.apiKey')}</Label>
  <div className="flex items-center gap-2">
    <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md flex-1">
      {provider.maskedKey}
    </code>
    <Button variant="outline" size="sm" onClick={() => startKeyRotation(provider)}>
      {t('admin.aiProviders.rotateKey')}
    </Button>
    <Button variant="outline" size="sm" onClick={() => removeKey(provider)} className="text-destructive hover:text-destructive">
      {t('admin.aiProviders.removeKey')}
    </Button>
  </div>
</div>
```

### 4. Test Connection Button

Per provider card, add a test button that calls `POST /api/admin/ai-providers/:provider/test`:

```tsx
<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => testKey(provider.provider)}
    disabled={!provider.hasKey || testingProvider === provider.provider}
  >
    {testingProvider === provider.provider ? (
      <Loader2 className="h-4 w-4 me-1 animate-spin" />
    ) : (
      <Zap className="h-4 w-4 me-1" />
    )}
    {t('admin.aiProviders.testConnection')}
  </Button>
  {/* Also show a test button for fallback key when configured */}
  {provider.hasFallbackKey && (
    <Button variant="outline" size="sm" onClick={() => testFallbackKey(provider.provider)}>
      {t('admin.aiProviders.testFallback')}
    </Button>
  )}
  {/* Test result display */}
  {testResults[provider.provider] && (
    <span className={`text-xs ${testResults[provider.provider].ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {testResults[provider.provider].ok
        ? t('admin.aiProviders.testSuccess', { ms: testResults[provider.provider].latencyMs })
        : t('admin.aiProviders.testFailure', { error: testResults[provider.provider].error })}
    </span>
  )}
</div>
```

### 5. Fallback Key Section

Collapsible section within each provider card:

```tsx
<div className="border-t pt-3 mt-3">
  <button
    onClick={() => toggleFallbackSection(provider.provider)}
    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
  >
    <ChevronRight className={cn(
      "h-4 w-4 transition-transform duration-150 rtl:scale-x-[-1]",
      showFallback[provider.provider] && "rotate-90"
    )} />
    {t('admin.aiProviders.fallbackKey')}
    <span className="text-xs">({t('admin.aiProviders.optional')})</span>
  </button>
  {showFallback[provider.provider] && (
    <div className="mt-2 space-y-2">
      {/* Same key input/display pattern as primary key */}
      <p className="text-xs text-muted-foreground">
        {t('admin.aiProviders.fallbackKeyHint')}
      </p>
    </div>
  )}
</div>
```

### 6. Default Model Picker (Global Section)

At the top of the page, before provider cards:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">{t('admin.aiProviders.defaultModel')}</CardTitle>
    <CardDescription>{t('admin.aiProviders.defaultModelDesc')}</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="w-full sm:w-48">
        <Label>{t('admin.aiProviders.provider')}</Label>
        <Select
          value={defaultProvider.provider}
          onValueChange={(v) => handleDefaultProviderChange(v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {activeProviders.map(p => (
              <SelectItem key={p.provider} value={p.provider}>{p.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full sm:w-64">
        <Label>{t('admin.aiProviders.model')}</Label>
        <Select
          value={defaultProvider.model}
          onValueChange={(v) => handleDefaultModelChange(v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {selectedProviderModels.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={saveDefaultModel}
        disabled={savingDefault}
        className="self-end"
      >
        {savingDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 me-1" />}
        {t('admin.aiProviders.save')}
      </Button>
    </div>
  </CardContent>
</Card>
```

### 7. Fallback Order Section (Global)

Below the default model picker:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">{t('admin.aiProviders.fallbackOrder')}</CardTitle>
    <CardDescription>{t('admin.aiProviders.fallbackOrderDesc')}</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      {fallbackOrder.map((provider, index) => (
        <div key={provider} className="flex items-center gap-2 rounded-md border p-2">
          <span className="text-sm font-mono text-muted-foreground w-6">{index + 1}.</span>
          <span className="text-sm font-medium flex-1">
            {PROVIDER_DISPLAY[provider]?.label || provider}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveDown(index)}
              disabled={index === fallbackOrder.length - 1}
              className="h-7 w-7 p-0"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
    <Button onClick={saveFallbackOrder} disabled={savingOrder} className="mt-3">
      {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 me-1" />}
      {t('admin.aiProviders.saveFallbackOrder')}
    </Button>
  </CardContent>
</Card>
```

### 8. State Management

The component needs these state variables:

```typescript
// Data from API
const [config, setConfig] = useState<AIProvidersConfig | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Key input states (per provider)
const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
const [fallbackKeyInputs, setFallbackKeyInputs] = useState<Record<string, string>>({});
const [showKey, setShowKey] = useState<Record<string, boolean>>({});
const [showFallbackKey, setShowFallbackKey] = useState<Record<string, boolean>>({});
const [showFallback, setShowFallback] = useState<Record<string, boolean>>({});
const [rotatingKey, setRotatingKey] = useState<Record<string, boolean>>({});

// Action states
const [savingKey, setSavingKey] = useState<string | null>(null);
const [testingProvider, setTestingProvider] = useState<string | null>(null);
const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs?: number; error?: string }>>({});
const [savingDefault, setSavingDefault] = useState(false);
const [savingOrder, setSavingOrder] = useState(false);

// Default model local state
const [defaultProvider, setDefaultProvider] = useState({ provider: '', model: '' });
const [fallbackOrder, setFallbackOrder] = useState<string[]>([]);
```

### 9. Design Rules Compliance

**Uncodixify UI (MANDATORY):**
- Cards: `rounded-lg border bg-card shadow-sm` — NO hover lift, NO shadow escalation
- Buttons: `rounded-md` — NO `rounded-full` pill shapes
- Transitions: `transition-colors duration-150` — NO `transition-all`, NO `duration-300`
- Badges: static colors — NO `animate-pulse`
- Loading: `Loader2` with `animate-spin` — NO `animate-bounce`

**Switch Component (MANDATORY):**
- Use `<Switch>` from `../components/ui/switch`
- NO `min-h-[44px]` or `min-w-[44px]` on Switch
- Touch target via parent container padding

**RTL Support (MANDATORY):**
- Use logical properties: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`
- Icon mirroring: `ChevronRight` with `rtl:scale-x-[-1]`
- NO `rtl:flex-row-reverse` (native `dir="rtl"` handles flex)
- Eye/show-hide button: use `end-2` not `right-2`

**URL Tab State:**
- This page doesn't have tabs, so no URL state management needed
- If tabs are added in the future, follow the `url-tab-state.md` rule

### 10. Imports

Use Lucide icons (already in admin-frontend deps), NOT react-icons:

```typescript
import {
  Loader2, Save, Check, Eye, EyeOff, Zap, Trash2,
  ChevronRight, ChevronUp, ChevronDown, AlertCircle, Key
} from 'lucide-react'
```

### Tests

**File:** `admin-frontend/src/pages/__tests__/AIProvidersPage.test.tsx` (extend existing)

1. **Loading state:** Shows spinner on mount
2. **Error state:** Shows error message when API fails
3. **Renders all providers:** 4 provider cards rendered
4. **Key not configured:** Shows "Not configured" badge, disabled Switch
5. **Key configured:** Shows masked key, "Configured" badge, enabled Switch
6. **Save key:** Submits API key, shows success, re-fetches config
7. **Remove key:** Confirmation dialog, calls API, re-fetches
8. **Rotate key:** Shows input field, saves new key
9. **Test connection success:** Shows latency result in green
10. **Test connection failure:** Shows error in red
11. **Test connection loading:** Shows spinner on test button
12. **Fallback key toggle:** Shows/hides collapsible section
13. **Fallback key save:** Same as primary key flow
14. **Default model picker:** Dropdown shows only active providers
15. **Default model save:** Calls API, shows success
16. **Fallback order up/down:** Reorders list correctly
17. **Fallback order save:** Calls API with new order
18. **Switch disabled without key:** Can't toggle when no key configured
19. **Auto-enable on key save:** Provider becomes enabled after key saved
20. **RTL layout:** Render in RTL wrapper, verify logical properties applied

### i18n

Add the following keys to `admin-frontend/public/locales/{en,ar,fr,de,es}/admin.json`:

| Key | en |
|-----|-----|
| `admin.aiProviders.apiKey` | API Key |
| `admin.aiProviders.apiKeyPlaceholder` | sk-... |
| `admin.aiProviders.saveKey` | Save Key |
| `admin.aiProviders.rotateKey` | Rotate |
| `admin.aiProviders.removeKey` | Remove Key |
| `admin.aiProviders.confirmRemoveKey` | Are you sure you want to remove the API key for {{provider}}? This will disable the provider. |
| `admin.aiProviders.keyConfigured` | Key configured |
| `admin.aiProviders.keyNotConfigured` | Not configured |
| `admin.aiProviders.testConnection` | Test |
| `admin.aiProviders.testFallback` | Test Fallback |
| `admin.aiProviders.testSuccess` | Connected ({{ms}}ms) |
| `admin.aiProviders.testFailure` | Failed: {{error}} |
| `admin.aiProviders.fallbackKey` | Fallback API Key |
| `admin.aiProviders.fallbackKeyHint` | Optional backup key used if the primary key fails or is rate-limited. |
| `admin.aiProviders.optional` | optional |
| `admin.aiProviders.defaultModel` | Default AI Model |
| `admin.aiProviders.defaultModelDesc` | The default provider and model used for platform AI operations. Only providers with configured keys can be selected. |
| `admin.aiProviders.provider` | Provider |
| `admin.aiProviders.model` | Model |
| `admin.aiProviders.fallbackOrder` | Fallback Order |
| `admin.aiProviders.fallbackOrderDesc` | When the default provider fails, the system tries providers in this order. |
| `admin.aiProviders.saveFallbackOrder` | Save Order |
| `admin.aiProviders.keySaved` | API key saved successfully |
| `admin.aiProviders.keyRemoved` | API key removed |
| `admin.aiProviders.noActiveProviders` | No active providers. Add an API key to enable a provider. |

Translate all keys to ar, fr, de, es.

### Documentation

Update `docs/{en,ar,fr,de,es}/admin/platform-controls.md`:
- Add screenshots/descriptions of the new AI Providers page layout
- Document the key management workflow
- Document the fallback order configuration
- Document the default model selection

### Verification

1. Navigate to `https://admin.whynot.skrum.io/ai-providers`
2. Add an API key for Anthropic -> verify "Key configured" badge appears, provider auto-enables
3. Click "Test" -> verify latency result or error displayed
4. Add a fallback key -> verify "Test Fallback" button appears
5. Set Anthropic as default model with claude-sonnet-4-6
6. Reorder fallback chain with up/down arrows, save
7. Remove the key -> verify provider disables, default model picker no longer shows it
8. Switch to Arabic -> verify all elements render correctly in RTL
9. Run tests: `make shell-admin npm test`
