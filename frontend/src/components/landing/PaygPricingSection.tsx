import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { FadeIn } from '@/components/motion/FadeIn';
import { Stagger } from '@/components/motion/Stagger';
import { CountUp } from '@/components/motion/CountUp';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fadeInVariants } from '@/lib/motion/presets';
import {
  type PaygRate,
  CREDIT_PACKS,
  MAX_QUANTITY,
  clampQuantity,
  computeTotalCredits,
  recommendPack,
  formatCents,
} from '@/lib/pricing/payg-calculator';

const DEFAULT_RATES: PaygRate[] = [
  { event: 'test_generation', credits: 50 },
  { event: 'test_execution', credits: 10 },
  { event: 'qa_loop_iteration', credits: 30 },
  { event: 'auto_fix_attempt', credits: 100 },
  { event: 'visual_regression', credits: 15 },
  { event: 'qa_monitor_session', credits: 200 },
  { event: 'ci_scan', credits: 200 },
];

const WORKED_EXAMPLE_ITEMS = 3;

const PACK_KEYS = ['starter', 'growth', 'scale'] as const;

function CreditPackCards() {
  const { t } = useTranslation('landing');

  return (
    <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
      {PACK_KEYS.map((key, i) => {
        const isBestValue = i === PACK_KEYS.length - 1;
        return (
          <motion.div
            key={key}
            variants={fadeInVariants}
            className={cn(
              'rounded-lg border bg-card p-5 text-center transition-colors duration-150',
              isBestValue
                ? 'ring-1 ring-primary border-primary'
                : 'hover:ring-1 hover:ring-primary/50 hover:border-primary/30',
            )}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <h4 className="text-sm font-semibold">
                {t(`payg.packs.items.${key}.name`)}
              </h4>
              {isBestValue && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t('payg.packs.bestValue')}
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold tabular-nums mb-1">
              {t(`payg.packs.items.${key}.price`)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`payg.packs.items.${key}.size`)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ${CREDIT_PACKS[i].perCreditCents.toFixed(2)} {t('payg.packs.perCredit')}
            </p>
          </motion.div>
        );
      })}
    </Stagger>
  );
}

function CreditCalculator({ rates }: { rates: PaygRate[] }) {
  const { t, i18n } = useTranslation('landing');
  const reduced = useReducedMotion();
  const locale = i18n.language === 'ar' ? 'ar-SA' : i18n.language;

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const r of rates) initial[r.event] = 0;
    return initial;
  });

  const handleChange = useCallback((event: string, value: string) => {
    const parsed = parseInt(value, 10) || 0;
    const clamped = clampQuantity(parsed);
    setQuantities((prev) => ({ ...prev, [event]: clamped }));
  }, []);

  const totalCredits = useMemo(
    () => computeTotalCredits(rates, quantities),
    [rates, quantities],
  );

  const pack = useMemo(() => recommendPack(totalCredits), [totalCredits]);

  const estimatedCostCents = useMemo(() => {
    if (totalCredits === 0) return 0;
    const packsNeeded = Math.ceil(totalCredits / pack.size);
    return packsNeeded * pack.priceCents;
  }, [totalCredits, pack]);

  const packLabel = useMemo(() => {
    const idx = CREDIT_PACKS.indexOf(pack);
    if (idx >= 0 && idx < PACK_KEYS.length) {
      return t(`payg.packs.items.${PACK_KEYS[idx]}.name`);
    }
    return '';
  }, [pack, t]);

  return (
    <div className="mt-12 rounded-lg border bg-card p-6" data-testid="credit-calculator">
      <h3 className="text-base font-semibold mb-1">{t('payg.calculator.heading')}</h3>
      <p className="text-sm text-muted-foreground mb-6">
        {t('payg.calculator.description')}
      </p>

      <div className="space-y-3">
        {rates.map((rate) => (
          <div key={rate.event} className="flex items-center gap-3">
            <label htmlFor={`calc-${rate.event}`} className="flex-1 text-sm text-foreground">
              {t(`payg.events.${rate.event}.name`)}
              <span className="text-muted-foreground ms-1">
                ({rate.credits} {t('payg.creditsUnit')})
              </span>
            </label>
            <Input
              id={`calc-${rate.event}`}
              type="number"
              min={0}
              max={MAX_QUANTITY}
              value={quantities[rate.event] ?? 0}
              onChange={(e) => handleChange(rate.event, e.target.value)}
              className="w-24 text-end tabular-nums h-9"
              aria-label={t(`payg.calculator.inputLabel.${rate.event}`)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4 border-t border-border pt-4">
        <div>
          <span className="text-sm text-muted-foreground">
            {t('payg.calculator.totalCreditsLabel')}
          </span>
          <span className="ms-2 text-lg font-semibold tabular-nums" data-testid="total-credits">
            {reduced ? (
              totalCredits.toLocaleString(locale)
            ) : (
              <CountUp target={totalCredits} locale={locale} />
            )}
          </span>
        </div>
        <div className="text-end">
          <span className="text-sm text-muted-foreground">
            {t('payg.calculator.estimatedMonthlyCost')}
          </span>
          <span className="ms-2 text-lg font-semibold tabular-nums" data-testid="estimated-cost">
            {formatCents(estimatedCostCents, locale)}
          </span>
        </div>
      </div>

      {totalCredits > 0 && (
        <p className="text-sm text-muted-foreground mt-2" data-testid="recommended-pack">
          {t('payg.calculator.recommendedPack', { pack: packLabel })}
        </p>
      )}
    </div>
  );
}

function WorkedExample() {
  const { t } = useTranslation('landing');
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return (
    <div className="mt-8 rounded-lg border bg-muted/30 overflow-hidden">
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between p-4 h-auto rounded-none"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="worked-example-content"
      >
        <span className="text-base font-semibold">
          {t('payg.workedExample.heading')}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="worked-example-content"
            role="region"
            aria-label={t('payg.workedExample.heading')}
            initial={reduced ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={reduced ? undefined : { duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
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
              <p className="text-xs text-muted-foreground mt-1">
                {t('payg.workedExample.note')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PaygPricingSection() {
  const { t } = useTranslation('landing');
  const [rates, setRates] = useState(DEFAULT_RATES);

  useEffect(() => {
    fetch('/api/landing/pricing')
      .then((r) => r.json())
      .then((data: { paygRates?: PaygRate[] }) => {
        if (data.paygRates?.length) setRates(data.paygRates);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="py-24 sm:py-32 bg-background" aria-labelledby="payg-heading">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-16">
          <h2
            id="payg-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
          >
            {t('payg.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">{t('payg.subheading')}</p>
        </FadeIn>

        <FadeIn>
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
        </FadeIn>

        <p className="text-sm text-muted-foreground text-center mt-4">
          {t('payg.creditPack')}
        </p>

        <CreditPackCards />
        <CreditCalculator rates={rates} />
        <WorkedExample />
      </div>
    </section>
  );
}
