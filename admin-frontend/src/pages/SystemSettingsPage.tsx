import { useState, useEffect } from 'react'
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
  const [settings, setSettings] = useState<any[]>([])
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('general')

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
      alert(`Failed to save: ${err.response?.data?.error || err.message}`)
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
      <div className="space-y-6 max-w-3xl">
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
            No settings in this category.
          </div>
        ) : (
          items.map((setting: any) => (
            <div key={setting.key} className="px-6 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono">{setting.key}</p>
                {setting.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                )}
              </div>
              <Input
                value={editValues[setting.key] || ''}
                onChange={(e) => setEditValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                className="w-48"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSave(setting.key)}
                disabled={saving === setting.key || editValues[setting.key] === setting.value}
                title="Save"
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
          ))
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <AdminPageHeader title="System Settings" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="credits">Credit Costs</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
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
