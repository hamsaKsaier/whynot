import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { Input } from '@/components/ui/input'

interface PaygRate {
  event: string
  credits: number
}

const DEFAULT_RATES: PaygRate[] = [
  { event: 'test_generation', credits: 50 },
  { event: 'test_execution', credits: 10 },
  { event: 'qa_loop_iteration', credits: 30 },
  { event: 'auto_fix_attempt', credits: 100 },
  { event: 'visual_regression', credits: 15 },
  { event: 'qa_monitor_session', credits: 200 },
  { event: 'ci_scan', credits: 200 },
]

const WORKED_EXAMPLE_ITEMS = 3

const CREDIT_PACK_PRICE_CENTS = 1000
const CREDITS_PER_PACK = 1000

function CreditCalculator({ rates }: { rates: PaygRate[] }) {
  const { t } = useTranslation('landing')
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const r of rates) initial[r.event] = 0
    return initial
  })

  const handleChange = useCallback((event: string, value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0)
    setQuantities((prev) => ({ ...prev, [event]: num }))
  }, [])

  const totalCredits = useMemo(
    () => rates.reduce((sum, r) => sum + r.credits * (quantities[r.event] ?? 0), 0),
    [rates, quantities]
  )

  const estimatedCost = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format((totalCredits / CREDITS_PER_PACK) * (CREDIT_PACK_PRICE_CENTS / 100)),
    [totalCredits]
  )

  return (
    <div className="mt-12 rounded-lg border bg-card p-6">
      <h3 className="text-base font-semibold mb-1">{t('payg.calculator.heading')}</h3>
      <p className="text-sm text-muted-foreground mb-6">{t('payg.calculator.description')}</p>

      <div className="space-y-3">
        {rates.map((rate) => (
          <div key={rate.event} className="flex items-center gap-3">
            <label
              htmlFor={`calc-${rate.event}`}
              className="flex-1 text-sm text-foreground"
            >
              {t(`payg.events.${rate.event}.name`)}
              <span className="text-muted-foreground ms-1">
                ({rate.credits} {t('payg.creditsUnit')})
              </span>
            </label>
            <Input
              id={`calc-${rate.event}`}
              type="number"
              min={0}
              value={quantities[rate.event] ?? 0}
              onChange={(e) => handleChange(rate.event, e.target.value)}
              className="w-20 text-end tabular-nums h-9"
              aria-label={t(`payg.events.${rate.event}.name`)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-baseline justify-between border-t border-border pt-4">
        <div>
          <span className="text-sm text-muted-foreground">{t('payg.calculator.totalCredits')}</span>
          <span className="ms-2 text-lg font-semibold tabular-nums">{totalCredits.toLocaleString()}</span>
        </div>
        <div className="text-end">
          <span className="text-sm text-muted-foreground">{t('payg.calculator.estimatedCost')}</span>
          <span className="ms-2 text-lg font-semibold tabular-nums">{estimatedCost}</span>
        </div>
      </div>
    </div>
  )
}

export function PaygPricingSection() {
  const { t } = useTranslation('landing')
  const { ref, visible } = useScrollReveal()
  const [rates, setRates] = useState(DEFAULT_RATES)

  useEffect(() => {
    fetch('/api/landing/pricing')
      .then((r) => r.json())
      .then((data: { paygRates?: PaygRate[] }) => {
        if (data.paygRates?.length) setRates(data.paygRates)
      })
      .catch(() => {})
  }, [])

  return (
    <section className="py-24 sm:py-32 bg-background" aria-labelledby="payg-heading">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16 transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0'
          )}
        >
          <h2 id="payg-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {t('payg.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">{t('payg.subheading')}</p>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-start text-sm font-medium text-muted-foreground p-4">
                  {t('payg.event')}
                </th>
                <th className="text-end text-sm font-medium text-muted-foreground p-4">
                  {t('payg.credits')}
                </th>
                <th className="text-end text-sm font-medium text-muted-foreground p-4 hidden sm:table-cell">
                  {t('payg.example')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.event} className="border-b last:border-b-0">
                  <td className="text-start text-sm p-4 font-medium">
                    {t(`payg.events.${rate.event}.name`)}
                  </td>
                  <td className="text-end text-sm p-4 tabular-nums text-muted-foreground">
                    {rate.credits}
                  </td>
                  <td className="text-end text-sm p-4 text-muted-foreground hidden sm:table-cell">
                    {t(`payg.events.${rate.event}.example`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground text-center mt-4">{t('payg.creditPack')}</p>

        <CreditCalculator rates={rates} />

        <div className="mt-8 rounded-lg border bg-muted/30 p-6">
          <h3 className="text-base font-semibold mb-2">{t('payg.workedExample.heading')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('payg.workedExample.description')}
          </p>
          <ul className="space-y-2 mb-4" role="list">
            {Array.from({ length: WORKED_EXAMPLE_ITEMS }, (_, i) => (
              <li key={i} className="text-sm text-muted-foreground tabular-nums">
                {t(`payg.workedExample.items.${i}`)}
              </li>
            ))}
          </ul>
          <p className="text-sm font-semibold">{t('payg.workedExample.total')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('payg.workedExample.note')}</p>
        </div>
      </div>
    </section>
  )
}
