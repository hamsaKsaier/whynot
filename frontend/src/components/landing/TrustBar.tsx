import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, Lock, RefreshCw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/useScrollReveal'

const TECH_LOGOS = [
  'Playwright',
  'Cypress',
  'Selenium',
  'React',
  'Next.js',
  'Vue',
  'Angular',
  'Svelte',
  'Node.js',
  'Django',
  'Rails',
  'Laravel',
  'WordPress',
  'Shopify',
  'Webflow',
]

function MarqueeRow() {
  const duplicated = [...TECH_LOGOS, ...TECH_LOGOS]

  return (
    <div className="relative overflow-hidden">
      <div className="flex gap-6 sm:gap-8 w-max motion-safe:animate-marquee">
        {duplicated.map((tech, index) => (
          <div
            key={`${tech}-${index}`}
            className="flex-shrink-0 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg border bg-card/30 grayscale hover:grayscale-0 transition-colors duration-150 select-none"
          >
            <span className="font-mono font-bold text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              {tech}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const TRUST_BADGES = [
  { icon: Shield, textKey: 'trustBar.badges.soc2' },
  { icon: Lock, textKey: 'trustBar.badges.dataPrivacy' },
  { icon: RefreshCw, textKey: 'trustBar.badges.moneyBack' },
  { icon: Clock, textKey: 'trustBar.badges.uptime' },
]

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const { ref, visible } = useScrollReveal(0.3)

  useEffect(() => {
    if (!visible) return
    let frame = 0
    const totalFrames = Math.round(duration / 16)
    const step = target / totalFrames

    const timer = setInterval(() => {
      frame++
      if (frame >= totalFrames) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.round(step * frame))
      }
    }, 16)

    return () => clearInterval(timer)
  }, [visible, target, duration])

  return { ref, count }
}

function StatItem({
  label,
  numericValue,
  suffix,
}: {
  label: string
  numericValue: number
  suffix: string
}) {
  const { ref, count } = useCountUp(numericValue)
  const display = Number.isInteger(numericValue)
    ? count.toString()
    : count.toFixed(1)

  return (
    <div ref={ref} className="text-center">
      <dd className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-1 tabular-nums">
        {display}
        {suffix}
      </dd>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
    </div>
  )
}

export function TrustBar() {
  const { t } = useTranslation('landing')
  const { ref: badgesRef, visible: badgesVisible } = useScrollReveal()

  const stats = [
    { label: t('trustBar.stats.bugsFound'), numericValue: 50000, suffix: '+' },
    { label: t('trustBar.stats.testsGenerated'), numericValue: 120000, suffix: '+' },
    { label: t('trustBar.stats.teams'), numericValue: 500, suffix: '+' },
    { label: t('trustBar.stats.accuracy'), numericValue: 99.2, suffix: '%' },
  ]

  return (
    <section
      className="py-16 sm:py-20 border-y border-border/50 bg-muted/10 overflow-hidden"
      aria-label={t('trustBar.ariaLabel')}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
        <p className="text-center text-sm text-muted-foreground font-medium tracking-wide uppercase mb-6">
          {t('trustBar.logoTitle')}
        </p>
      </div>
      <MarqueeRow />

      <div
        ref={badgesRef}
        className={cn(
          'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10 transition-opacity duration-200',
          badgesVisible ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {TRUST_BADGES.map((badge) => (
            <div
              key={badge.textKey}
              className="flex items-center gap-2 px-4 py-2"
            >
              <badge.icon
                className="h-5 w-5 text-green-500 shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap font-medium">
                {t(badge.textKey)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </dl>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee {
            animation-play-state: paused;
          }
        }
      `}</style>
    </section>
  )
}
