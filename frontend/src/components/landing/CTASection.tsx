import { useTranslation } from 'react-i18next'
import { EmailCapture } from './EmailCapture'

export function CTASection() {
  const { t } = useTranslation('landing')

  return (
    <section className="py-20 sm:py-28 bg-background border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            {t('cta.heading')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t('cta.subheading')}
          </p>
          <EmailCapture
            variant="inline"
            ctaText={t('cta.getStarted')}
            source="landing_cta"
          />
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm text-muted-foreground">
            <span>{t('cta.trustSignals.freeTier')}</span>
            <span>{t('cta.trustSignals.noCard')}</span>
            <span>{t('cta.trustSignals.moneyBack')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
