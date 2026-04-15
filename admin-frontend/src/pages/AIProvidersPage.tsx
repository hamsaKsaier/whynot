import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Save, Check } from 'lucide-react'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { getAIProviders, updateAIProviders, type AIProviderEntry } from '../services/api'

const PROVIDER_DISPLAY: Record<string, { label: string; color: string }> = {
  openai: { label: 'OpenAI', color: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300' },
  anthropic: { label: 'Anthropic', color: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300' },
  google: { label: 'Google AI', color: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300' },
  openrouter: { label: 'OpenRouter', color: 'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300' },
}

export function AIProvidersPage() {
  const { t } = useTranslation('admin')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providers, setProviders] = useState<AIProviderEntry[]>([])

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAIProviders()
      setProviders(data.providers)
    } catch {
      setError(t('admin.aiProviders.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const toggleProvider = (index: number) => {
    setProviders((prev) =>
      prev.map((p, i) => (i === index ? { ...p, enabled: !p.enabled } : p))
    )
  }

  const updateRateLimit = (index: number, value: string) => {
    const num = parseInt(value, 10)
    setProviders((prev) =>
      prev.map((p, i) => (i === index ? { ...p, rateLimit: isNaN(num) ? 0 : Math.max(0, num) } : p))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const data = await updateAIProviders(providers)
      setProviders(data.providers)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.aiProviders.saveError'))
    } finally {
      setSaving(false)
    }
  }

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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 me-1 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4 me-1" />
            ) : (
              <Save className="h-4 w-4 me-1" />
            )}
            {saving ? t('admin.aiProviders.saving') : saved ? t('admin.aiProviders.saved') : t('admin.aiProviders.save')}
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('admin.aiProviders.enabledCount', { count: enabledCount, total: providers.length })}</span>
      </div>

      <div className="grid gap-4">
        {providers.map((provider, index) => {
          const display = PROVIDER_DISPLAY[provider.provider] || {
            label: provider.provider,
            color: 'bg-muted text-foreground border-border',
          }

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
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={provider.enabled}
                      onCheckedChange={() => toggleProvider(index)}
                    />
                  </div>
                </div>
                <CardDescription>
                  {t(`admin.aiProviders.providerDesc.${provider.provider}`, { defaultValue: '' })}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                      onChange={(e) => updateRateLimit(index, e.target.value)}
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
    </div>
  )
}
