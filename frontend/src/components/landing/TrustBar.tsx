import { useTranslation } from 'react-i18next'
import { Shield, Lock, RefreshCw, Clock } from 'lucide-react'
import { Marquee } from '@/components/motion/Marquee'
import { CountUp } from '@/components/motion/CountUp'
import { Reveal } from '@/components/motion/Reveal'
import { Stagger } from '@/components/motion/Stagger'

const TRUST_BADGES = [
  { icon: Shield, textKey: 'trustBar.badges.soc2' },
  { icon: Lock, textKey: 'trustBar.badges.dataPrivacy' },
  { icon: RefreshCw, textKey: 'trustBar.badges.moneyBack' },
  { icon: Clock, textKey: 'trustBar.badges.uptime' },
] as const

interface Stat {
  labelKey: string
  suffixKey: string
  value: number
  formatOptions?: Intl.NumberFormatOptions
}

const STATS: Stat[] = [
  { labelKey: 'trustBar.stats.bugsFound', suffixKey: 'trustBar.stats.bugsFoundSuffix', value: 50000 },
  { labelKey: 'trustBar.stats.testsGenerated', suffixKey: 'trustBar.stats.testsGeneratedSuffix', value: 120000 },
  { labelKey: 'trustBar.stats.teams', suffixKey: 'trustBar.stats.teamsSuffix', value: 500 },
  {
    labelKey: 'trustBar.stats.accuracy',
    suffixKey: 'trustBar.stats.accuracySuffix',
    value: 99.2,
    formatOptions: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  },
]

function BadgeItem({ icon: Icon, textKey }: (typeof TRUST_BADGES)[number]) {
  const { t } = useTranslation('landing')
  return (
    <div className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg border bg-card/30">
      <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap font-medium">
        {t(textKey)}
      </span>
    </div>
  )
}

function StatCell({ stat }: { stat: Stat }) {
  const { t, i18n } = useTranslation('landing')
  const locale = i18n.language

  return (
    <Reveal as="div" className="text-center">
      <dd className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-1 tabular-nums min-w-[5ch]">
        <CountUp
          target={stat.value}
          locale={locale}
          formatOptions={stat.formatOptions}
          duration={0.4}
        />
        {t(stat.suffixKey)}
      </dd>
      <dt className="text-sm font-medium text-muted-foreground">{t(stat.labelKey)}</dt>
    </Reveal>
  )
}

export function TrustBar() {
  const { t } = useTranslation('landing')

  return (
    <section
      className="py-12 sm:py-16 md:py-20 border-y border-border/50 bg-muted/10 overflow-hidden"
      aria-label={t('trustBar.ariaLabel')}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
        <p className="text-center text-xs sm:text-sm text-muted-foreground font-medium tracking-wide uppercase mb-4 sm:mb-6">
          {t('trustBar.logoTitle')}
        </p>
      </div>

      <Marquee speed={30} className="mb-6 sm:mb-10" aria-label={t('trustBar.ariaLabel')}>
        <div className="flex gap-4 sm:gap-6 px-2">
          {TRUST_BADGES.map((badge) => (
            <BadgeItem key={badge.textKey} {...badge} />
          ))}
        </div>
      </Marquee>

      <Stagger as="div" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {STATS.map((stat) => (
            <StatCell key={stat.labelKey} stat={stat} />
          ))}
        </dl>
      </Stagger>
    </section>
  )
}
