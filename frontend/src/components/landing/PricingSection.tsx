import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { FadeIn } from '@/components/motion/FadeIn';
import { Stagger } from '@/components/motion/Stagger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCents } from '@/lib/pricing/payg-calculator';
import { fadeInVariants } from '@/lib/motion/presets';

interface PlanData {
  slug: string;
  monthlyCents: number;
}

interface PricingResponse {
  plans: PlanData[];
  trialDays: number;
}

type BillingInterval = 'monthly' | 'annual';

const PLAN_SLUGS = ['free', 'pro_byo', 'pro_managed'] as const;
const ANNUAL_DISCOUNT = 0.2;

const DEFAULT_PRICES: Record<string, number> = {
  free: 0,
  pro_byo: 2900,
  pro_managed: 4900,
};

const FEATURE_COUNTS: Record<string, number> = {
  free: 5,
  pro_byo: 7,
  pro_managed: 7,
};

function getAnnualMonthlyCents(monthlyCents: number): number {
  return Math.round(monthlyCents * (1 - ANNUAL_DISCOUNT));
}

function getAnnualSavePercent(): number {
  return Math.round(ANNUAL_DISCOUNT * 100);
}

export function PricingSection() {
  const { t, i18n } = useTranslation('landing');
  const reduced = useReducedMotion();
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [trialDays, setTrialDays] = useState(14);
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  useEffect(() => {
    fetch('/api/landing/pricing')
      .then((r) => r.json())
      .then((data: PricingResponse) => {
        const map: Record<string, number> = {};
        for (const p of data.plans) map[p.slug] = p.monthlyCents;
        setPrices((prev) => ({ ...prev, ...map }));
        if (data.trialDays) setTrialDays(data.trialDays);
      })
      .catch(() => {});
  }, []);

  const locale = i18n.language === 'ar' ? 'ar-SA' : i18n.language;

  const handleIntervalChange = useCallback((value: string) => {
    setInterval(value as BillingInterval);
  }, []);

  return (
    <section id="pricing" className="py-16 sm:py-24 md:py-32 bg-muted/30" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <h2
            id="pricing-heading"
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4"
          >
            {t('pricing.heading')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground">{t('pricing.subheading')}</p>
        </FadeIn>

        <div className="flex justify-center mb-8 sm:mb-12">
          <Tabs value={interval} onValueChange={handleIntervalChange}>
            <TabsList aria-label={t('pricing.monthly')}>
              <TabsTrigger value="monthly">{t('pricing.monthly')}</TabsTrigger>
              <TabsTrigger value="annual">
                {t('pricing.annual')}
                <Badge variant="secondary" className="ms-2 text-[10px] px-1.5 py-0">
                  {t('pricing.saveBadge', { percent: getAnnualSavePercent() })}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {PLAN_SLUGS.map((slug) => {
            const isPopular = slug === 'pro_byo';
            const isFree = slug === 'free';
            const isManaged = slug === 'pro_managed';
            const baseCents = prices[slug] ?? DEFAULT_PRICES[slug];
            const displayCents =
              interval === 'annual' && !isFree
                ? getAnnualMonthlyCents(baseCents)
                : baseCents;

            const ctaText = isFree
              ? t('pricing.startFree')
              : isManaged
                ? t('pricing.contactSales')
                : t('pricing.getStarted');

            const ctaHref = isManaged ? '/contact' : `/signup${!isFree ? `?plan=${slug}` : ''}`;

            return (
              <motion.div
                key={slug}
                variants={fadeInVariants}
                className={cn(
                  'rounded-lg border bg-card p-6 flex flex-col transition-colors duration-150',
                  isPopular
                    ? 'ring-1 ring-primary border-primary'
                    : 'hover:ring-1 hover:ring-primary/50 hover:border-primary/30',
                )}
              >
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">
                      {t(`pricing.plans.${slug}.name`)}
                    </h3>
                    {isPopular && (
                      <FadeIn as="span">
                        <Badge>{t('pricing.popular')}</Badge>
                      </FadeIn>
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
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={`${slug}-${interval}`}
                            className="text-3xl font-bold tabular-nums"
                            initial={reduced ? false : { opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduced ? undefined : { opacity: 0, y: 8 }}
                            transition={reduced ? undefined : { duration: 0.15 }}
                          >
                            {formatCents(displayCents, locale)}
                          </motion.span>
                        </AnimatePresence>
                        <span className="text-muted-foreground">
                          {t('pricing.perMonth')}
                        </span>
                      </>
                    )}
                  </div>
                  {!isFree && interval === 'annual' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('pricing.monthlyEquivalent', {
                        price: formatCents(displayCents, locale),
                      })}
                    </p>
                  )}
                  {!isFree && interval === 'monthly' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('pricing.trialDays', { days: trialDays })}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-4 flex-1" role="list">
                  {Array.from({ length: FEATURE_COUNTS[slug] }, (_, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check
                        className="h-4 w-4 text-primary mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{t(`pricing.plans.${slug}.features.${i}`)}</span>
                    </li>
                  ))}
                </ul>

                <div
                  className="mb-6 border-t border-border pt-4 flex items-start justify-between gap-2"
                  data-testid={`recon-row-${slug}`}
                >
                  <span className="text-sm text-muted-foreground">
                    {t('pricing.recon.label')}
                  </span>
                  <a
                    href="/docs/recon/quotas"
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-150 text-end"
                  >
                    {t(
                      `pricing.recon.${
                        slug === 'free'
                          ? 'free'
                          : slug === 'pro_byo'
                            ? 'proByo'
                            : 'proManaged'
                      }`,
                    )}
                  </a>
                </div>

                <Button
                  variant={isPopular ? 'default' : 'outline'}
                  className="w-full rounded-md"
                  asChild
                >
                  <a href={ctaHref}>{ctaText}</a>
                </Button>
              </motion.div>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
