import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PlanData {
  slug: string
  monthlyCents: number
}

interface PricingResponse {
  plans: PlanData[]
  trialDays: number
}

const PLAN_SLUGS = ['free', 'pro_byo', 'pro_managed'] as const

function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

const DEFAULT_PRICES: Record<string, number> = {
  free: 0,
  pro_byo: 2900,
  pro_managed: 4900,
}

const FEATURE_COUNTS: Record<string, number> = {
  free: 5,
  pro_byo: 7,
  pro_managed: 7,
}

export function PricingSection() {
  const { t, i18n } = useTranslation('landing')
  const { ref, visible } = useScrollReveal()
  const [prices, setPrices] = useState(DEFAULT_PRICES)
  const [trialDays, setTrialDays] = useState(14)

  useEffect(() => {
    fetch('/api/landing/pricing')
      .then((r) => r.json())
      .then((data: PricingResponse) => {
        const map: Record<string, number> = {}
        for (const p of data.plans) map[p.slug] = p.monthlyCents
        setPrices((prev) => ({ ...prev, ...map }))
        if (data.trialDays) setTrialDays(data.trialDays)
      })
      .catch(() => {})
  }, [])

  const locale = i18n.language === 'ar' ? 'ar-SA' : i18n.language

  return (
    <section id="pricing" className="py-24 sm:py-32 bg-muted/30" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={cn(
            'text-center max-w-3xl mx-auto mb-16 transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0'
          )}
        >
          <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {t('pricing.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">{t('pricing.subheading')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLAN_SLUGS.map((slug, index) => {
            const isPopular = slug === 'pro_byo'
            const isFree = slug === 'free'
            const price = prices[slug] ?? DEFAULT_PRICES[slug]

            return (
              <div
                key={slug}
                className={cn(
                  'rounded-lg border bg-card p-6 flex flex-col transition-opacity duration-200',
                  isPopular && 'border-primary ring-1 ring-primary',
                  visible ? 'opacity-100' : 'opacity-0'
                )}
                style={{ transitionDelay: visible ? `${index * 80}ms` : '0ms' }}
              >
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{t(`pricing.plans.${slug}.name`)}</h3>
                    {isPopular && (
                      <Badge variant="secondary" className="text-xs">
                        {t('pricing.popular')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t(`pricing.plans.${slug}.description`)}
                  </p>
                  <div className="flex items-baseline gap-1">
                    {isFree ? (
                      <span className="text-3xl font-bold">{t('pricing.free')}</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">{formatPrice(price, locale)}</span>
                        <span className="text-muted-foreground">{t('pricing.monthly')}</span>
                      </>
                    )}
                  </div>
                  {!isFree && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('pricing.trialDays', { days: trialDays })}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1" role="list">
                  {Array.from({ length: FEATURE_COUNTS[slug] }, (_, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{t(`pricing.plans.${slug}.features.${i}`)}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isPopular ? 'default' : 'outline'}
                  className="w-full rounded-md"
                  asChild
                >
                  <a href="/signup">
                    {isFree ? t('pricing.startFree') : t('pricing.getStarted')}
                  </a>
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
