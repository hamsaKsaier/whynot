import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Loader2, Save, Check, Eye, EyeOff, Zap, Trash2,
  ChevronRight, ChevronUp, ChevronDown, AlertCircle, Key,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog'
import {
  getAIProviders, updateAIProviders, setProviderKey, removeProviderKey,
  setProviderFallbackKey, removeProviderFallbackKey, testProviderKey,
  setDefaultModel, setFallbackOrder as saveFallbackOrderApi,
  type AIProviderEntry, type AIProvidersConfig,
} from '../services/api'

const PROVIDER_DISPLAY: Record<string, { label: string; color: string }> = {
  openai: { label: 'OpenAI', color: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300' },
  anthropic: { label: 'Anthropic', color: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300' },
  google: { label: 'Google AI', color: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300' },
  openrouter: { label: 'OpenRouter', color: 'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300' },
}

export function AIProvidersPage() {
  const { t } = useTranslation('admin')

  // Data from API
  const [config, setConfig] = useState<AIProvidersConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Key input states (per provider)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [fallbackKeyInputs, setFallbackKeyInputs] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [showFallbackKey, setShowFallbackKey] = useState<Record<string, boolean>>({})
  const [showFallback, setShowFallback] = useState<Record<string, boolean>>({})
  const [rotatingKey, setRotatingKey] = useState<Record<string, boolean>>({})
  const [rotatingFallbackKey, setRotatingFallbackKey] = useState<Record<string, boolean>>({})

  // Action states
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savingFallbackKey, setSavingFallbackKey] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testingFallback, setTestingFallback] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs?: number; error?: string }>>({})
  const [fallbackTestResults, setFallbackTestResults] = useState<Record<string, { ok: boolean; latencyMs?: number; error?: string }>>({})
  const [savingDefault, setSavingDefault] = useState(false)
  const [savedDefault, setSavedDefault] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [savedOrder, setSavedOrder] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savedConfig, setSavedConfig] = useState(false)

  // Default model local state
  const [defaultProvider, setDefaultProvider] = useState({ provider: '', model: '' })
  const [fallbackOrder, setFallbackOrder] = useState<string[]>([])

  // Remove key confirmation dialog
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; provider: string; isFallback: boolean }>({
    open: false, provider: '', isFallback: false,
  })
  const [removing, setRemoving] = useState(false)

  // Success message for key operations
  const [keySuccess, setKeySuccess] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAIProviders()
      setConfig(data)
      setDefaultProvider(data.defaultProvider || { provider: '', model: '' })
      setFallbackOrder(data.fallbackOrder || [])
    } catch {
      setError(t('admin.aiProviders.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  // Clear success message after 2s
  useEffect(() => {
    if (!keySuccess) return
    const timer = setTimeout(() => setKeySuccess(null), 2000)
    return () => clearTimeout(timer)
  }, [keySuccess])

  const providers = config?.providers ?? []
  const activeProviders = providers.filter((p) => p.hasKey && p.enabled)

  // --- Provider toggle & rate limit (bulk save) ---

  const updateProviderLocal = (provider: string, updates: Partial<AIProviderEntry>) => {
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        providers: prev.providers.map((p) =>
          p.provider === provider ? { ...p, ...updates } : p
        ),
      }
    })
  }

  const toggleProvider = async (provider: string, currentEnabled: boolean) => {
    updateProviderLocal(provider, { enabled: !currentEnabled })
  }

  const updateRateLimit = (provider: string, value: string) => {
    const num = parseInt(value, 10)
    updateProviderLocal(provider, { rateLimit: isNaN(num) ? 0 : Math.max(0, num) })
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    setError(null)
    setSavedConfig(false)
    try {
      const data = await updateAIProviders(providers)
      setConfig(data)
      setSavedConfig(true)
      setTimeout(() => setSavedConfig(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.aiProviders.saveError'))
    } finally {
      setSavingConfig(false)
    }
  }

  // --- API Key management ---

  const handleSaveKey = async (provider: string) => {
    const key = keyInputs[provider]?.trim()
    if (!key) return
    setSavingKey(provider)
    setError(null)
    try {
      await setProviderKey(provider, key)
      setKeyInputs((prev) => ({ ...prev, [provider]: '' }))
      setRotatingKey((prev) => ({ ...prev, [provider]: false }))
      setKeySuccess(t('admin.aiProviders.keySaved'))
      await fetchConfig()
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.aiProviders.saveError'))
    } finally {
      setSavingKey(null)
    }
  }

  const handleSaveFallbackKey = async (provider: string) => {
    const key = fallbackKeyInputs[provider]?.trim()
    if (!key) return
    setSavingFallbackKey(provider)
    setError(null)
    try {
      await setProviderFallbackKey(provider, key)
      setFallbackKeyInputs((prev) => ({ ...prev, [provider]: '' }))
      setRotatingFallbackKey((prev) => ({ ...prev, [provider]: false }))
      setKeySuccess(t('admin.aiProviders.keySaved'))
      await fetchConfig()
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.aiProviders.saveError'))
    } finally {
      setSavingFallbackKey(null)
    }
  }

  const handleRemoveKey = async () => {
    const { provider, isFallback } = removeDialog
    setRemoving(true)
    setError(null)
    try {
      if (isFallback) {
        await removeProviderFallbackKey(provider)
      } else {
        await removeProviderKey(provider)
      }
      setKeySuccess(t('admin.aiProviders.keyRemoved'))
      await fetchConfig()
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.aiProviders.saveError'))
    } finally {
      setRemoving(false)
      setRemoveDialog({ open: false, provider: '', isFallback: false })
    }
  }

  // --- Test connection ---

  const handleTestKey = async (provider: string) => {
    setTestingProvider(provider)
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[provider]
      return next
    })
    try {
      const result = await testProviderKey(provider)
      setTestResults((prev) => ({ ...prev, [provider]: result }))
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [provider]: { ok: false, error: err.message || 'Unknown error' } }))
    } finally {
      setTestingProvider(null)
    }
  }

  const handleTestFallbackKey = async (provider: string) => {
    setTestingFallback(provider)
    setFallbackTestResults((prev) => {
      const next = { ...prev }
      delete next[provider]
      return next
    })
    try {
      const result = await testProviderKey(provider, true)
      setFallbackTestResults((prev) => ({ ...prev, [provider]: result }))
    } catch (err: any) {
      setFallbackTestResults((prev) => ({ ...prev, [provider]: { ok: false, error: err.message || 'Unknown error' } }))
    } finally {
      setTestingFallback(null)
    }
  }

  // --- Default model ---

  const selectedProviderModels = providers.find((p) => p.provider === defaultProvider.provider)?.models ?? []

  const handleDefaultProviderChange = (provider: string) => {
    const models = providers.find((p) => p.provider === provider)?.models ?? []
    setDefaultProvider({ provider, model: models[0] || '' })
  }

  const handleSaveDefaultModel = async () => {
    setSavingDefault(true)
    setSavedDefault(false)
    setError(null)
    try {
      await setDefaultModel(defaultProvider.provider, defaultProvider.model)
      setSavedDefault(true)
      setTimeout(() => setSavedDefault(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.aiProviders.saveError'))
    } finally {
      setSavingDefault(false)
    }
  }

  // --- Fallback order ---

  const moveUp = (index: number) => {
    if (index === 0) return
    setFallbackOrder((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const moveDown = (index: number) => {
    setFallbackOrder((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const handleSaveFallbackOrder = async () => {
    setSavingOrder(true)
    setSavedOrder(false)
    setError(null)
    try {
      await saveFallbackOrderApi(fallbackOrder)
      setSavedOrder(true)
      setTimeout(() => setSavedOrder(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.aiProviders.saveError'))
    } finally {
      setSavingOrder(false)
    }
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const enabledCount = providers.filter((p) => p.enabled).length

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.aiProviders.title')}
        description={t('admin.aiProviders.description')}
        actions={
          <Button onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? (
              <Loader2 className="h-4 w-4 me-1 animate-spin" />
            ) : savedConfig ? (
              <Check className="h-4 w-4 me-1" />
            ) : (
              <Save className="h-4 w-4 me-1" />
            )}
            {savingConfig ? t('admin.aiProviders.saving') : savedConfig ? t('admin.aiProviders.saved') : t('admin.aiProviders.save')}
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {keySuccess && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <Check className="h-4 w-4 flex-shrink-0" />
          {keySuccess}
        </div>
      )}

      {/* Section A: Global Configuration */}

      {/* Default Model Picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.aiProviders.defaultModel')}</CardTitle>
          <CardDescription>{t('admin.aiProviders.defaultModelDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {activeProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.aiProviders.noActiveProviders')}</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-48 space-y-2">
                <Label>{t('admin.aiProviders.provider')}</Label>
                <Select
                  value={defaultProvider.provider}
                  onValueChange={handleDefaultProviderChange}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeProviders.map((p) => (
                      <SelectItem key={p.provider} value={p.provider}>
                        {PROVIDER_DISPLAY[p.provider]?.label || p.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-64 space-y-2">
                <Label>{t('admin.aiProviders.model')}</Label>
                <Select
                  value={defaultProvider.model}
                  onValueChange={(v) => setDefaultProvider((prev) => ({ ...prev, model: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {selectedProviderModels.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSaveDefaultModel}
                disabled={savingDefault || !defaultProvider.provider || !defaultProvider.model}
                className="self-end"
              >
                {savingDefault ? (
                  <Loader2 className="h-4 w-4 me-1 animate-spin" />
                ) : savedDefault ? (
                  <Check className="h-4 w-4 me-1" />
                ) : (
                  <Save className="h-4 w-4 me-1" />
                )}
                {savingDefault ? t('admin.aiProviders.saving') : savedDefault ? t('admin.aiProviders.saved') : t('admin.aiProviders.save')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallback Order */}
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
          {fallbackOrder.length > 0 && (
            <Button onClick={handleSaveFallbackOrder} disabled={savingOrder} className="mt-3">
              {savingOrder ? (
                <Loader2 className="h-4 w-4 me-1 animate-spin" />
              ) : savedOrder ? (
                <Check className="h-4 w-4 me-1" />
              ) : (
                <Save className="h-4 w-4 me-1" />
              )}
              {savingOrder ? t('admin.aiProviders.saving') : savedOrder ? t('admin.aiProviders.saved') : t('admin.aiProviders.saveFallbackOrder')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section B: Provider Cards */}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('admin.aiProviders.enabledCount', { count: enabledCount, total: providers.length })}</span>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => {
          const display = PROVIDER_DISPLAY[provider.provider] || {
            label: provider.provider,
            color: 'bg-muted text-foreground border-border',
          }
          const isRotating = rotatingKey[provider.provider]
          const isRotatingFallback = rotatingFallbackKey[provider.provider]

          return (
            <Card key={provider.provider}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{display.label}</CardTitle>
                    <Badge
                      variant="outline"
                      className={provider.enabled
                        ? 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                        : 'bg-muted text-muted-foreground border-border'
                      }
                    >
                      {provider.enabled ? t('admin.aiProviders.enabled') : t('admin.aiProviders.disabled')}
                    </Badge>
                    {provider.hasKey ? (
                      <Badge variant="outline" className="bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300">
                        <Key className="h-3 w-3 me-1" />
                        {t('admin.aiProviders.keyConfigured')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                        {t('admin.aiProviders.keyNotConfigured')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={provider.enabled}
                      onCheckedChange={() => toggleProvider(provider.provider, provider.enabled)}
                      disabled={!provider.hasKey}
                    />
                  </div>
                </div>
                <CardDescription>
                  {t(`admin.aiProviders.providerDesc.${provider.provider}`, { defaultValue: '' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* API Key Section */}
                <div className="space-y-2">
                  <Label>{t('admin.aiProviders.apiKey')}</Label>
                  {provider.hasKey && !isRotating ? (
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md flex-1 truncate">
                        {provider.maskedKey}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRotatingKey((prev) => ({ ...prev, [provider.provider]: true }))}
                      >
                        {t('admin.aiProviders.rotateKey')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRemoveDialog({ open: true, provider: provider.provider, isFallback: false })}
                        className="text-destructive hover:text-destructive"
                        aria-label={`${t('admin.aiProviders.removeKey')} ${PROVIDER_DISPLAY[provider.provider]?.label || provider.provider}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKey[provider.provider] ? 'text' : 'password'}
                          value={keyInputs[provider.provider] || ''}
                          onChange={(e) => setKeyInputs((prev) => ({ ...prev, [provider.provider]: e.target.value }))}
                          placeholder={t('admin.aiProviders.apiKeyPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((prev) => ({ ...prev, [provider.provider]: !prev[provider.provider] }))}
                          className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                        >
                          {showKey[provider.provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={() => handleSaveKey(provider.provider)}
                        disabled={!keyInputs[provider.provider]?.trim() || savingKey === provider.provider}
                      >
                        {savingKey === provider.provider ? (
                          <Loader2 className="h-4 w-4 me-1 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 me-1" />
                        )}
                        {t('admin.aiProviders.saveKey')}
                      </Button>
                      {isRotating && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRotatingKey((prev) => ({ ...prev, [provider.provider]: false }))}
                        >
                          {t('admin.aiProviders.cancel')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Test Connection */}
                {provider.hasKey && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestKey(provider.provider)}
                      disabled={testingProvider === provider.provider}
                    >
                      {testingProvider === provider.provider ? (
                        <Loader2 className="h-4 w-4 me-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 me-1" />
                      )}
                      {t('admin.aiProviders.testConnection')}
                    </Button>
                    {provider.hasFallbackKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestFallbackKey(provider.provider)}
                        disabled={testingFallback === provider.provider}
                      >
                        {testingFallback === provider.provider ? (
                          <Loader2 className="h-4 w-4 me-1 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 me-1" />
                        )}
                        {t('admin.aiProviders.testFallback')}
                      </Button>
                    )}
                    {testResults[provider.provider] && (
                      <span className={cn('text-xs', testResults[provider.provider].ok
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                      )}>
                        {testResults[provider.provider].ok
                          ? t('admin.aiProviders.testSuccess', { ms: testResults[provider.provider].latencyMs })
                          : t('admin.aiProviders.testFailure', { error: testResults[provider.provider].error })}
                      </span>
                    )}
                    {fallbackTestResults[provider.provider] && (
                      <span className={cn('text-xs', fallbackTestResults[provider.provider].ok
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                      )}>
                        {fallbackTestResults[provider.provider].ok
                          ? t('admin.aiProviders.testSuccess', { ms: fallbackTestResults[provider.provider].latencyMs })
                          : t('admin.aiProviders.testFailure', { error: fallbackTestResults[provider.provider].error })}
                      </span>
                    )}
                  </div>
                )}

                {/* Fallback Key Section (collapsible) */}
                <div className="border-t pt-3">
                  <button
                    type="button"
                    onClick={() => setShowFallback((prev) => ({ ...prev, [provider.provider]: !prev[provider.provider] }))}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    <ChevronRight className={cn(
                      'h-4 w-4 transition-transform duration-150 rtl:scale-x-[-1]',
                      showFallback[provider.provider] && 'rotate-90'
                    )} />
                    {t('admin.aiProviders.fallbackKey')}
                    <span className="text-xs">({t('admin.aiProviders.optional')})</span>
                  </button>
                  {showFallback[provider.provider] && (
                    <div className="mt-2 space-y-2">
                      {provider.hasFallbackKey && !isRotatingFallback ? (
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md flex-1 truncate">
                            {provider.maskedFallbackKey}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRotatingFallbackKey((prev) => ({ ...prev, [provider.provider]: true }))}
                          >
                            {t('admin.aiProviders.rotateKey')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRemoveDialog({ open: true, provider: provider.provider, isFallback: true })}
                            className="text-destructive hover:text-destructive"
                            aria-label={`${t('admin.aiProviders.removeKey')} ${PROVIDER_DISPLAY[provider.provider]?.label || provider.provider} fallback`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showFallbackKey[provider.provider] ? 'text' : 'password'}
                              value={fallbackKeyInputs[provider.provider] || ''}
                              onChange={(e) => setFallbackKeyInputs((prev) => ({ ...prev, [provider.provider]: e.target.value }))}
                              placeholder={t('admin.aiProviders.apiKeyPlaceholder')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowFallbackKey((prev) => ({ ...prev, [provider.provider]: !prev[provider.provider] }))}
                              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                            >
                              {showFallbackKey[provider.provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <Button
                            onClick={() => handleSaveFallbackKey(provider.provider)}
                            disabled={!fallbackKeyInputs[provider.provider]?.trim() || savingFallbackKey === provider.provider}
                          >
                            {savingFallbackKey === provider.provider ? (
                              <Loader2 className="h-4 w-4 me-1 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 me-1" />
                            )}
                            {t('admin.aiProviders.saveKey')}
                          </Button>
                          {isRotatingFallback && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRotatingFallbackKey((prev) => ({ ...prev, [provider.provider]: false }))}
                            >
                              {t('admin.aiProviders.cancel')}
                            </Button>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t('admin.aiProviders.fallbackKeyHint')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Rate Limit */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                  <div className="w-full sm:w-48 space-y-2">
                    <Label htmlFor={`rate-${provider.provider}`}>
                      {t('admin.aiProviders.rateLimit')}
                    </Label>
                    <Input
                      id={`rate-${provider.provider}`}
                      type="number"
                      min={0}
                      step={1}
                      value={provider.rateLimit || ''}
                      onChange={(e) => updateRateLimit(provider.provider, e.target.value)}
                      placeholder="0"
                      disabled={!provider.enabled}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:pb-2">
                    {t('admin.aiProviders.rateLimitHint')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {providers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {t('admin.aiProviders.noProviders')}
        </div>
      )}

      {/* Remove Key Confirmation Dialog */}
      <Dialog open={removeDialog.open} onOpenChange={(open) => setRemoveDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.aiProviders.removeKey')}</DialogTitle>
            <DialogDescription>
              {t('admin.aiProviders.confirmRemoveKey', {
                provider: PROVIDER_DISPLAY[removeDialog.provider]?.label || removeDialog.provider,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialog({ open: false, provider: '', isFallback: false })}
              disabled={removing}
            >
              {t('admin.aiProviders.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveKey}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="h-4 w-4 me-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 me-1" />
              )}
              {t('admin.aiProviders.removeKey')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
