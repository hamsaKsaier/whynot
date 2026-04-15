import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Check, Loader2 } from 'lucide-react';

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number;
    credits_per_period: number;
    billing_interval: string;
    is_custom: boolean;
    features: Record<string, string>;
  };
  isCurrentPlan: boolean;
  isPopular?: boolean;
  onUpgrade: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan,
  isPopular,
  onUpgrade,
  disabled,
  loading,
}) => {
  const { t, i18n } = useTranslation('billing');

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const interval = plan.billing_interval === 'yearly'
    ? t('billing.plans.perYear')
    : t('billing.plans.perMonth');

  const featureLabels: Record<string, string> = {
    qa_loop: t('checkout.feature.qaLoop'),
    visual_regression: t('checkout.feature.visualRegression'),
    webhooks: t('checkout.feature.webhooks'),
    api_access: t('checkout.feature.apiAccess'),
    priority_support: t('checkout.feature.prioritySupport'),
  };

  const enabledFeatures = Object.entries(plan.features)
    .filter(([key, val]) => val === 'true' && featureLabels[key])
    .map(([key]) => featureLabels[key]);

  return (
    <Card className={`flex flex-col ${isPopular ? 'ring-1 ring-primary' : ''} ${isCurrentPlan ? 'ring-1 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          {isPopular && !isCurrentPlan && (
            <Badge variant="secondary" className="text-xs">
              {t('checkout.recommended')}
            </Badge>
          )}
          {isCurrentPlan && (
            <Badge variant="outline" className="text-xs">
              {t('billing.plans.current')}
            </Badge>
          )}
        </div>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="mb-2">
          {plan.is_custom ? (
            <span className="text-2xl md:text-3xl font-semibold text-foreground">
              {t('billing.plans.custom')}
            </span>
          ) : plan.price_cents === 0 ? (
            <span className="text-2xl md:text-3xl font-semibold text-foreground">
              {t('checkout.free')}
            </span>
          ) : (
            <div>
              <span className="text-2xl md:text-3xl font-semibold text-foreground">
                {formatPrice(plan.price_cents)}
              </span>
              <span className="text-sm text-muted-foreground">{interval}</span>
            </div>
          )}
        </div>

        {plan.credits_per_period > 0 && (
          <p className="text-xs text-muted-foreground mb-4">
            {t('billing.plans.creditsPerPeriod', {
              credits: plan.credits_per_period.toLocaleString(i18n.language),
              interval,
            })}
          </p>
        )}

        <ul className="space-y-2">
          {enabledFeatures.map((f) => (
            <li key={f} className="flex items-center text-sm text-foreground">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400 me-2 flex-shrink-0" />
              {f}
            </li>
          ))}
          {plan.features.max_projects && (
            <li className="flex items-center text-sm text-foreground">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400 me-2 flex-shrink-0" />
              {plan.features.max_projects === '-1'
                ? t('checkout.unlimitedProjects')
                : t('checkout.maxProjects', { count: Number(plan.features.max_projects) })}
            </li>
          )}
        </ul>
      </CardContent>

      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" disabled className="w-full">
            {t('billing.plans.current')}
          </Button>
        ) : plan.is_custom ? (
          <Button variant="outline" className="w-full" onClick={() => window.open('mailto:sales@whynot.dev')}>
            {t('billing.plans.contactSales')}
          </Button>
        ) : plan.price_cents === 0 ? (
          <Button variant="outline" disabled className="w-full">
            {t('billing.plans.freeTrial')}
          </Button>
        ) : (
          <Button onClick={onUpgrade} disabled={disabled || loading} className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : null}
            {t('billing.plans.upgrade')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
