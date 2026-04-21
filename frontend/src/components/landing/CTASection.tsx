import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CheckCircle, CreditCard, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/Reveal'
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion'

const trustSignals = [
  { icon: CheckCircle, key: 'cta.trustSignals.freeTier' },
  { icon: CreditCard, key: 'cta.trustSignals.noCard' },
  { icon: Shield, key: 'cta.trustSignals.moneyBack' },
] as const

export function CTASection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  const content = (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {t('cta.heading')}
      </h2>
      <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-muted-foreground">{t('cta.subheading')}</p>
      <div className="mt-6 sm:mt-8">
        <Button size="lg" onClick={() => navigate('/signup')}>
          {t('cta.getStarted')}
          <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
        </Button>
      </div>
      <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
        {trustSignals.map(({ icon: Icon, key }) => (
          <span key={key} className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 text-primary" />
            {t(key)}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <section className="bg-muted py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {reduced ? content : <Reveal>{content}</Reveal>}
      </div>
    </section>
  )
}
