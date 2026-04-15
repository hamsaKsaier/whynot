import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Save, Check } from 'lucide-react'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Separator } from '../components/ui/separator'
import { getBillingConfig, updateBillingConfig } from '../services/api'

interface PaygRate {
  eventType: string
  costCents: string
}

export function BillingConfigPage() {
  const { t } = useTranslation('admin')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [trialDays, setTrialDays] = useState('')
  const [gracePeriodDays, setGracePeriodDays] = useState('')
  const [currency, setCurrency] = useState('')
  const [creditsLowThreshold, setCreditsLowThreshold] = useState('')
  const [paygChargeBuffer, setPaygChargeBuffer] = useState('')
  const [paygRates, setPaygRates] = useState<PaygRate[]>([])

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const { config } = await getBillingConfig()
      setTrialDays(config.trial_days ?? '')
      setGracePeriodDays(config.grace_period_days ?? '')
      setCurrency(config.currency ?? 'usd')
      setCreditsLowThreshold(config.credits_low_threshold_cents ?? '')
      setPaygChargeBuffer(config.payg_charge_buffer_cents ?? '')

      if (config.payg_rates) {
        try {
          const parsed = JSON.parse(config.payg_rates)
          setPaygRates(
            Object.entries(parsed).map(([eventType, costCents]) => ({
              eventType,
              costCents: String(costCents),
            }))
          )
        } catch {
          setPaygRates([])
        }
      }
    } catch {
      setError(t('admin.billingConfig.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const validateForm = (): string | null => {
    if (trialDays !== '') {
      const n = parseInt(trialDays, 10)
      if (isNaN(n) || n < 0 || !Number.isInteger(n)) return t('admin.billingConfig.errors.trialDays')
    }
    if (gracePeriodDays !== '') {
      const n = parseInt(gracePeriodDays, 10)
      if (isNaN(n) || n < 0 || !Number.isInteger(n)) return t('admin.billingConfig.errors.gracePeriod')
    }
    if (currency !== '' && !/^[a-z]{3}$/.test(currency)) return t('admin.billingConfig.errors.currency')
    if (creditsLowThreshold !== '') {
      try { if (BigInt(creditsLowThreshold) < 0n) throw new Error() } catch { return t('admin.billingConfig.errors.bigint') }
    }
    if (paygChargeBuffer !== '') {
      try { if (BigInt(paygChargeBuffer) < 0n) throw new Error() } catch { return t('admin.billingConfig.errors.bigint') }
    }
    for (const rate of paygRates) {
      if (!rate.eventType.trim()) return t('admin.billingConfig.errors.emptyEventType')
      try { if (BigInt(rate.costCents) < 0n) throw new Error() } catch { return t('admin.billingConfig.errors.rateBigint') }
    }
    return null
  }

  const handleSave = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const updates: Record<string, string> = {}
      if (trialDays !== '') updates.trial_days = trialDays
      if (gracePeriodDays !== '') updates.grace_period_days = gracePeriodDays
      if (currency !== '') updates.currency = currency
      if (creditsLowThreshold !== '') updates.credits_low_threshold_cents = creditsLowThreshold
      if (paygChargeBuffer !== '') updates.payg_charge_buffer_cents = paygChargeBuffer

      if (paygRates.length > 0) {
        const ratesObj: Record<string, string> = {}
        for (const rate of paygRates) {
          ratesObj[rate.eventType.trim()] = rate.costCents
        }
        updates.payg_rates = JSON.stringify(ratesObj)
      }

      if (Object.keys(updates).length > 0) {
        await updateBillingConfig(updates)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || t('admin.billingConfig.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const addPaygRate = () => {
    setPaygRates((prev) => [...prev, { eventType: '', costCents: '0' }])
  }

  const removePaygRate = (index: number) => {
    setPaygRates((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePaygRate = (index: number, field: keyof PaygRate, value: string) => {
    setPaygRates((prev) =>
      prev.map((rate, i) => (i === index ? { ...rate, [field]: value } : rate))
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.billingConfig.title')}
        description={t('admin.billingConfig.description')}
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 me-1 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4 me-1" />
            ) : (
              <Save className="h-4 w-4 me-1" />
            )}
            {saving ? t('admin.billingConfig.saving') : saved ? t('admin.billingConfig.saved') : t('admin.billingConfig.save')}
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('admin.billingConfig.generalTitle')}</CardTitle>
            <CardDescription>{t('admin.billingConfig.generalDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trial-days">{t('admin.billingConfig.trialDays')}</Label>
              <Input
                id="trial-days"
                type="number"
                min={0}
                step={1}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                placeholder="14"
              />
              <p className="text-xs text-muted-foreground">{t('admin.billingConfig.trialDaysHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grace-period">{t('admin.billingConfig.gracePeriod')}</Label>
              <Input
                id="grace-period"
                type="number"
                min={0}
                step={1}
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(e.target.value)}
                placeholder="7"
              />
              <p className="text-xs text-muted-foreground">{t('admin.billingConfig.gracePeriodHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">{t('admin.billingConfig.currency')}</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toLowerCase())}
                placeholder="usd"
                maxLength={3}
              />
              <p className="text-xs text-muted-foreground">{t('admin.billingConfig.currencyHint')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('admin.billingConfig.thresholdsTitle')}</CardTitle>
            <CardDescription>{t('admin.billingConfig.thresholdsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="low-threshold">{t('admin.billingConfig.creditsLowThreshold')}</Label>
              <Input
                id="low-threshold"
                value={creditsLowThreshold}
                onChange={(e) => setCreditsLowThreshold(e.target.value)}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">{t('admin.billingConfig.creditsLowThresholdHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-buffer">{t('admin.billingConfig.paygChargeBuffer')}</Label>
              <Input
                id="charge-buffer"
                value={paygChargeBuffer}
                onChange={(e) => setPaygChargeBuffer(e.target.value)}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">{t('admin.billingConfig.paygChargeBufferHint')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('admin.billingConfig.paygRatesTitle')}</CardTitle>
          <CardDescription>{t('admin.billingConfig.paygRatesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {paygRates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('admin.billingConfig.noPaygRates')}</p>
          ) : (
            <div className="space-y-3">
              {paygRates.map((rate, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1 space-y-1">
                    {i === 0 && <Label>{t('admin.billingConfig.eventType')}</Label>}
                    <Input
                      value={rate.eventType}
                      onChange={(e) => updatePaygRate(i, 'eventType', e.target.value)}
                      placeholder="test_execution"
                    />
                  </div>
                  <div className="w-full sm:w-40 space-y-1">
                    {i === 0 && <Label>{t('admin.billingConfig.costCents')}</Label>}
                    <Input
                      value={rate.costCents}
                      onChange={(e) => updatePaygRate(i, 'costCents', e.target.value)}
                      placeholder="100"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePaygRate(i)}
                    className="text-destructive hover:text-destructive self-end"
                  >
                    {t('admin.billingConfig.remove')}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Separator className="my-4" />
          <Button variant="outline" size="sm" onClick={addPaygRate}>
            {t('admin.billingConfig.addRate')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
