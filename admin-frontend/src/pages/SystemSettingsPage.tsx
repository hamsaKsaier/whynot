import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Save, Check, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { getSystemSettings, updateSystemSetting } from '../services/api'

export function SystemSettingsPage() {
  const { t } = useTranslation('settings')
  const [searchParams, setSearchParams] = useSearchParams()
  const [settings, setSettings] = useState<any[]>([])
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initialTab = searchParams.get('tab') || 'general'
  const [tab, setTab] = useState(initialTab)

  const handleTabChange = useCallback((newTab: string) => {
    setTab(newTab)
    setSearchParams({ tab: newTab }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    getSystemSettings()
      .then((data) => {
        setSettings(data.settings || [])
        const vals: Record<string, string> = {}
        ;(data.settings || []).forEach((s: any) => {
          vals[s.key] = s.value
        })
        setEditValues(vals)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (key: string) => {
    setSaving(key)
    try {
      await updateSystemSetting(key, editValues[key])
      setSaved(key)
      const s = settings.find((s) => s.key === key)
      if (s) s.value = editValues[key]
      setTimeout(() => setSaved(null), 2000)
    } catch (err: any) {
      alert(`${t('settings.saveFailed')}: ${err.response?.data?.error || err.message}`)
    } finally {
      setSaving(null)
    }
  }

  const groups: Record<string, any[]> = {}
  settings.forEach((s) => {
    let category = 'general'
    if (s.key.startsWith('credit_cost.')) category = 'credits'
    else if (s.key.startsWith('email.') || s.key.startsWith('smtp.')) category = 'email'
    else if (s.key.startsWith('webhook.')) category = 'webhooks'
    else if (s.key.startsWith('security.') || s.key.startsWith('auth.')) category = 'security'
    if (!groups[category]) groups[category] = []
    groups[category].push(s)
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const renderSettings = (items: any[]) => (
    <Card>
      <CardContent className="p-0 divide-y">
        {(!items || items.length === 0) ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {t('settings.noSettings')}
          </div>
        ) : (
          items.map((setting: any) => (
            <div key={setting.key} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono break-all">{setting.key}</p>
                {setting.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={editValues[setting.key] || ''}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                  className="w-full sm:w-48"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => handleSave(setting.key)}
                  disabled={saving === setting.key || editValues[setting.key] === setting.value}
                  title={t('settings.save')}
                >
                  {saving === setting.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved === setting.key ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t('settings.title')} />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">{t('settings.tabs.general')}</TabsTrigger>
          <TabsTrigger value="credits">{t('settings.tabs.credits')}</TabsTrigger>
          <TabsTrigger value="email">{t('settings.tabs.email')}</TabsTrigger>
          <TabsTrigger value="webhooks">{t('settings.tabs.webhooks')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.tabs.security')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          {renderSettings(groups['general'] || [])}
        </TabsContent>
        <TabsContent value="credits" className="mt-4">
          {renderSettings(groups['credits'] || [])}
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          {renderSettings(groups['email'] || [])}
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          {renderSettings(groups['webhooks'] || [])}
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          {renderSettings(groups['security'] || [])}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { SystemSettingsPage as default }
