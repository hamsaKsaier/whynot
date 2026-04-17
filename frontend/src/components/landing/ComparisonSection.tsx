import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/motion/Reveal'
import { Stagger } from '@/components/motion/Stagger'

type ComparisonValue = 'yes' | 'no' | 'partial'

interface ComparisonRow {
  key: string
  values: Record<string, ComparisonValue>
}

const COMPETITORS = [
  'whynot',
  'selenium',
  'cypress',
  'playwrightManual',
  'browserstack',
  'lambdatest',
] as const

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    key: 'aiAutonomous',
    values: { whynot: 'yes', selenium: 'no', cypress: 'no', playwrightManual: 'no', browserstack: 'partial', lambdatest: 'partial' },
  },
  {
    key: 'noCodeSetup',
    values: { whynot: 'yes', selenium: 'no', cypress: 'no', playwrightManual: 'no', browserstack: 'partial', lambdatest: 'partial' },
  },
  {
    key: 'bugDetection',
    values: { whynot: 'yes', selenium: 'no', cypress: 'no', playwrightManual: 'no', browserstack: 'no', lambdatest: 'no' },
  },
  {
    key: 'testGeneration',
    values: { whynot: 'yes', selenium: 'no', cypress: 'no', playwrightManual: 'no', browserstack: 'no', lambdatest: 'no' },
  },
  {
    key: 'visualRegression',
    values: { whynot: 'yes', selenium: 'no', cypress: 'partial', playwrightManual: 'partial', browserstack: 'yes', lambdatest: 'yes' },
  },
  {
    key: 'chaosTest',
    values: { whynot: 'yes', selenium: 'no', cypress: 'no', playwrightManual: 'no', browserstack: 'no', lambdatest: 'no' },
  },
  {
    key: 'ciIntegration',
    values: { whynot: 'yes', selenium: 'yes', cypress: 'yes', playwrightManual: 'yes', browserstack: 'yes', lambdatest: 'yes' },
  },
  {
    key: 'multiBrowser',
    values: { whynot: 'yes', selenium: 'yes', cypress: 'partial', playwrightManual: 'yes', browserstack: 'yes', lambdatest: 'yes' },
  },
  {
    key: 'selfHealing',
    values: { whynot: 'yes', selenium: 'no', cypress: 'no', playwrightManual: 'no', browserstack: 'partial', lambdatest: 'partial' },
  },
  {
    key: 'parallelExecution',
    values: { whynot: 'yes', selenium: 'partial', cypress: 'yes', playwrightManual: 'yes', browserstack: 'yes', lambdatest: 'yes' },
  },
]

function CellIcon({ value }: { value: ComparisonValue }) {
  const { t } = useTranslation('landing')

  if (value === 'yes') {
    return (
      <Check
        className="h-4 w-4 mx-auto text-green-600 dark:text-green-400"
        aria-label={t('comparison.values.yes')}
      />
    )
  }

  if (value === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('comparison.values.partial')}
      </span>
    )
  }

  return (
    <X
      className="h-4 w-4 mx-auto text-red-600 dark:text-red-400"
      aria-label={t('comparison.values.no')}
    />
  )
}

function useScrollShadows() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showStart, setShowStart] = useState(false)
  const [showEnd, setShowEnd] = useState(false)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const isRtl = document.documentElement.dir === 'rtl'
    const scrollPos = Math.abs(el.scrollLeft)
    const maxScroll = el.scrollWidth - el.clientWidth

    if (isRtl) {
      setShowEnd(scrollPos > 2)
      setShowStart(scrollPos < maxScroll - 2)
    } else {
      setShowStart(scrollPos > 2)
      setShowEnd(scrollPos < maxScroll - 2)
    }
  }, [])

  const initScroll = useCallback(
    (el: HTMLDivElement | null) => {
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      if (el) {
        handleScroll()
        el.addEventListener('scroll', handleScroll, { passive: true })
      }
    },
    [handleScroll],
  )

  return { initScroll, showStart, showEnd }
}

function MobileTable() {
  const { t } = useTranslation('landing')
  const { initScroll, showStart, showEnd } = useScrollShadows()

  return (
    <div className="md:hidden relative">
      <p className="text-xs text-muted-foreground text-center mb-3">
        {t('comparison.mobileHint')}
      </p>
      <div className="relative overflow-hidden rounded-lg border">
        <div
          className={cn(
            'absolute top-0 bottom-0 start-[140px] w-4 z-10 pointer-events-none bg-border/40 transition-opacity duration-150',
            showStart ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute top-0 bottom-0 end-0 w-4 z-10 pointer-events-none bg-border/40 transition-opacity duration-150',
            showEnd ? 'opacity-100' : 'opacity-0',
          )}
        />

        <div ref={initScroll} className="overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th
                  scope="col"
                  className="sticky start-0 z-20 bg-muted/50 p-3 text-start font-medium text-muted-foreground w-[140px] min-w-[140px]"
                >
                  {t('comparison.featureColumn')}
                </th>
                {COMPETITORS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      'p-3 text-center font-medium min-w-[100px]',
                      c === 'whynot' ? 'font-bold text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {t(`comparison.competitors.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.key}
                  className={cn(
                    i < COMPARISON_ROWS.length - 1 && 'border-b border-border/50',
                    i % 2 === 1 && 'bg-muted/20',
                  )}
                >
                  <th
                    scope="row"
                    className="sticky start-0 z-20 bg-card p-3 text-start font-medium w-[140px] min-w-[140px]"
                  >
                    {t(`comparison.features.${row.key}`)}
                  </th>
                  {COMPETITORS.map((c) => (
                    <td
                      key={c}
                      className={cn('p-3 text-center', c === 'whynot' && 'bg-primary/5')}
                    >
                      <CellIcon value={row.values[c]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DesktopTable() {
  const { t } = useTranslation('landing')

  return (
    <div className="hidden md:block max-w-6xl mx-auto">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th scope="col" className="p-4 text-start font-medium text-muted-foreground">
                {t('comparison.featureColumn')}
              </th>
              {COMPETITORS.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    'p-4 text-center font-medium',
                    c === 'whynot' ? 'font-bold text-primary' : 'text-muted-foreground',
                  )}
                >
                  {t(`comparison.competitors.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <Stagger as="tbody" stagger={0.04} delay={0.06}>
            {COMPARISON_ROWS.map((row, i) => (
              <Reveal
                as="tr"
                key={row.key}
                className={cn(
                  i < COMPARISON_ROWS.length - 1 && 'border-b border-border/50',
                  i % 2 === 1 && 'bg-muted/20',
                )}
              >
                <th scope="row" className="p-4 text-start font-medium">
                  {t(`comparison.features.${row.key}`)}
                </th>
                {COMPETITORS.map((c) => (
                  <td
                    key={c}
                    className={cn(
                      'p-4 text-center',
                      c === 'whynot' && 'bg-primary/5 ring-1 ring-primary/20',
                    )}
                  >
                    <CellIcon value={row.values[c]} />
                  </td>
                ))}
              </Reveal>
            ))}
          </Stagger>
        </table>
      </div>
    </div>
  )
}

export function ComparisonSection() {
  const { t } = useTranslation('landing')

  return (
    <section id="comparison" className="py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal as="div" className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {t('comparison.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('comparison.subtitle')}
          </p>
        </Reveal>

        <MobileTable />
        <DesktopTable />
      </div>
    </section>
  )
}
