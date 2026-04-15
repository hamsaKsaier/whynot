import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { dollarsToCents, centsToDollars } from '../lib/money'
import { getAdminPlan, createPlan, updatePlan, setPlanFeatures } from '../services/api'

export function PlanEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    price_cents: 0,
    billing_interval: 'monthly' as 'monthly' | 'yearly' | 'one_time',
    credits_per_period: 0,
    trial_days: 0,
    is_custom: false,
    is_public: true,
    sort_order: 0,
  })

  const [priceDollars, setPriceDollars] = useState('0.00')
  const [features, setFeatures] = useState<Array<{ key: string; value: string }>>([])
  const [newFeatureKey, setNewFeatureKey] = useState('')
  const [newFeatureValue, setNewFeatureValue] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id) {
      getAdminPlan(id).then((data) => {
        const p = data.plan
        setForm({
          name: p.name,
          slug: p.slug,
          description: p.description || '',
          price_cents: p.price_cents,
          billing_interval: p.billing_interval,
          credits_per_period: p.credits_per_period,
          trial_days: p.trial_days || 0,
          is_custom: p.is_custom,
          is_public: p.is_public,
          sort_order: p.sort_order || 0,
        })
        setPriceDollars(centsToDollars(p.price_cents).toFixed(2))
        setFeatures(
          (p.features || []).map((f: any) => ({ key: f.feature_key, value: f.feature_value }))
        )
        setLoading(false)
      })
    }
  }, [id])

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      ...(isNew
        ? { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
        : {}),
    }))
  }

  const addFeature = () => {
    if (!newFeatureKey) return
    setFeatures((prev) => [...prev, { key: newFeatureKey, value: newFeatureValue || 'true' }])
    setNewFeatureKey('')
    setNewFeatureValue('')
  }

  const removeFeature = (index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, price_cents: dollarsToCents(priceDollars) }
      let planId = id
      if (isNew) {
        const result = await createPlan(payload)
        planId = result.plan.id
      } else {
        await updatePlan(id!, payload)
      }

      if (planId && features.length > 0) {
        const featureMap: Record<string, string> = {}
        features.forEach((f) => { featureMap[f.key] = f.value })
        await setPlanFeatures(planId, featureMap)
      }

      navigate('/plans')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <AdminPageHeader
        title={isNew ? 'Create Plan' : 'Edit Plan'}
        breadcrumbs={[
          { label: 'Plans', to: '/plans' },
          { label: isNew ? 'New' : form.name },
        ]}
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                  required
                  pattern="[a-z0-9-]+"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Interval</Label>
                <Select
                  value={form.billing_interval}
                  onValueChange={(v) => setForm((p) => ({ ...p, billing_interval: v as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one_time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credits">Credits / Period</Label>
                <Input
                  id="credits"
                  type="number"
                  value={form.credits_per_period}
                  onChange={(e) => setForm((p) => ({ ...p, credits_per_period: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="trial">Trial Days</Label>
                <Input
                  id="trial"
                  type="number"
                  value={form.trial_days}
                  onChange={(e) => setForm((p) => ({ ...p, trial_days: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sort">Sort Order</Label>
                <Input
                  id="sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex flex-col justify-end gap-3 pb-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="public" className="cursor-pointer">Public</Label>
                  <Switch
                    id="public"
                    checked={form.is_public}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, is_public: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom" className="cursor-pointer">Enterprise</Label>
                  <Switch
                    id="custom"
                    checked={form.is_custom}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, is_custom: v }))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Flags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.length > 0 && (
              <div className="space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted px-3 py-1.5 rounded-md">{f.key}</code>
                    <code className="text-sm bg-muted px-3 py-1.5 rounded-md w-32">{f.value}</code>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFeature(i)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Key</Label>
                <Input
                  value={newFeatureKey}
                  onChange={(e) => setNewFeatureKey(e.target.value)}
                  placeholder="max_projects"
                />
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  value={newFeatureValue}
                  onChange={(e) => setNewFeatureValue(e.target.value)}
                  placeholder="true"
                />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={addFeature}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/plans')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 me-1.5 animate-spin" />}
            {isNew ? 'Create Plan' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { PlanEditPage as default }
