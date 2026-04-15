import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/useScrollReveal'

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

        <div className="mt-12 rounded-lg border bg-muted/30 p-6">
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
