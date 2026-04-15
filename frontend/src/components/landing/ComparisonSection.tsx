import { useTranslation } from 'react-i18next'
import { Check, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/useScrollReveal'

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
]

function ComparisonCellValue({ value }: { value: ComparisonValue }) {
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
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('comparison.values.partial')}
      </span>
    )
  }

  return (
    <X
      className="h-4 w-4 mx-auto text-muted-foreground/40"
      aria-label={t('comparison.values.no')}
    />
  )
}

export function ComparisonSection() {
  const { t } = useTranslation('landing')
  const { ref, visible } = useScrollReveal()

  return (
    <section id="comparison" className="py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={cn(
            'text-center max-w-3xl mx-auto mb-10 sm:mb-14 transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {t('comparison.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('comparison.subtitle')}
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[700px] px-4 sm:px-0">
              <div className="rounded-lg border overflow-hidden">
                <div
                  className={cn(
                    'grid gap-0 bg-muted/50 border-b border-border',
                    'grid-cols-[minmax(160px,1.5fr)_repeat(6,1fr)]'
                  )}
                >
                  <div className="p-3 sm:p-4 text-sm font-medium text-muted-foreground text-start">
                    {t('comparison.featureColumn')}
                  </div>
                  {COMPETITORS.map((competitor) => (
                    <div
                      key={competitor}
                      className={cn(
                        'p-3 sm:p-4 text-sm font-medium text-center',
                        competitor === 'whynot'
                          ? 'font-bold text-primary'
                          : 'text-muted-foreground'
                      )}
                    >
                      {t(`comparison.competitors.${competitor}`)}
                    </div>
                  ))}
                </div>

                {COMPARISON_ROWS.map((row, i) => (
                  <div
                    key={row.key}
                    className={cn(
                      'grid gap-0',
                      'grid-cols-[minmax(160px,1.5fr)_repeat(6,1fr)]',
                      i < COMPARISON_ROWS.length - 1 && 'border-b border-border/50',
                      i % 2 === 1 && 'bg-muted/20'
                    )}
                  >
                    <div className="p-3 sm:p-4 text-sm font-medium text-start">
                      {t(`comparison.features.${row.key}`)}
                    </div>
                    {COMPETITORS.map((competitor) => (
                      <div
                        key={competitor}
                        className={cn(
                          'p-3 sm:p-4 text-center',
                          competitor === 'whynot' && 'bg-primary/5'
                        )}
                      >
                        <ComparisonCellValue value={row.values[competitor]} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
