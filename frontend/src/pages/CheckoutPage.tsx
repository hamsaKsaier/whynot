import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getPublicPlans,
  createCheckoutSession,
} from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Check,
  ArrowRight,
  Loader2,
  Zap,
  Key,
  Server,
  Shield,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  credits_per_period: number;
  billing_interval: string;
  is_custom: boolean;
  features: Record<string, string>;
}

const TIER_INFO = {
  byo_keys: {
    icon: Key,
    label: 'checkout.tier.byo',
    description: 'checkout.tier.byoDesc',
  },
  managed_payg: {
    icon: Server,
    label: 'checkout.tier.managed',
    description: 'checkout.tier.managedDesc',
  },
} as const;

const COMPARISON_ROWS = [
  { key: 'apiKeys', label: 'checkout.compare.apiKeys' },
  { key: 'aiProvider', label: 'checkout.compare.aiProvider' },
  { key: 'payg', label: 'checkout.compare.payg' },
  { key: 'credits', label: 'checkout.compare.credits' },
  { key: 'support', label: 'checkout.compare.support' },
] as const;

export const CheckoutPage: React.FC = () => {
  const { t, i18n } = useTranslation('billing');
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await getPublicPlans();
        setPlans(data.plans || []);
      } catch {
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleStartTrial = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const result = await createCheckoutSession(planId);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      // Error handled by API interceptor (upgrade-prompt event)
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const featureLabels: Record<string, string> = {
    qa_loop: t('checkout.feature.qaLoop'),
    visual_regression: t('checkout.feature.visualRegression'),
    webhooks: t('checkout.feature.webhooks'),
    api_access: t('checkout.feature.apiAccess'),
    priority_support: t('checkout.feature.prioritySupport'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const freePlan = plans.find(p => p.price_cents === 0);
  const paidPlans = plans.filter(p => p.price_cents > 0 && !p.is_custom);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {t('checkout.title')}
        </h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          {t('checkout.subtitle')}
        </p>
      </div>

      {/* Tier Explainer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['byo_keys', 'managed_payg'] as const).map((tier) => {
          const info = TIER_INFO[tier];
          const Icon = info.icon;
          return (
            <Card key={tier}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{t(info.label)}</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  {t(info.description)}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('checkout.compare.title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t('checkout.compare.feature')}
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                    {t('checkout.tier.byo')}
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                    {t('checkout.tier.managed')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="text-start px-4 py-3 text-foreground">
                      {t(row.label)}
                    </td>
                    <td className="text-center px-4 py-3 text-muted-foreground">
                      {t(`checkout.compare.${row.key}Byo`)}
                    </td>
                    <td className="text-center px-4 py-3 text-muted-foreground">
                      {t(`checkout.compare.${row.key}Managed`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Free Plan */}
        {freePlan && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">{freePlan.name}</CardTitle>
              <CardDescription>{freePlan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-4">
                <span className="text-2xl font-semibold text-foreground">
                  {t('checkout.free')}
                </span>
              </div>
              <ul className="space-y-2">
                {Object.entries(freePlan.features)
                  .filter(([key, val]) => val === 'true' && featureLabels[key])
                  .map(([key]) => (
                    <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      {featureLabels[key]}
                    </li>
                  ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/settings?tab=billing')}
              >
                {t('checkout.currentPlan')}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Paid Plans */}
        {paidPlans.map((plan) => {
          const isManaged = plan.slug === 'pro_managed';
          return (
            <Card
              key={plan.id}
              className={`flex flex-col ${isManaged ? 'ring-1 ring-primary' : ''}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isManaged && (
                    <Badge variant="secondary" className="text-xs">
                      {t('checkout.recommended')}
                    </Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-1">
                  <span className="text-2xl font-semibold text-foreground">
                    {formatPrice(plan.price_cents)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t('billing.plans.perMonth')}
                  </span>
                </div>
                {plan.credits_per_period > 0 && (
                  <p className="text-xs text-muted-foreground mb-4">
                    {t('checkout.creditsIncluded', { count: plan.credits_per_period, formattedCount: plan.credits_per_period.toLocaleString(i18n.language) })}
                  </p>
                )}
                <Separator className="my-3" />
                <ul className="space-y-2">
                  {Object.entries(plan.features)
                    .filter(([key, val]) => val === 'true' && featureLabels[key])
                    .map(([key]) => (
                      <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        {featureLabels[key]}
                      </li>
                    ))}
                  {plan.features.max_projects && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      {plan.features.max_projects === '-1'
                        ? t('checkout.unlimitedProjects')
                        : t('checkout.maxProjects', { count: parseInt(plan.features.max_projects, 10) })}
                    </li>
                  )}
                  {isManaged && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4 text-green-600 flex-shrink-0" />
                      {t('checkout.payAsYouGo')}
                    </li>
                  )}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={checkoutLoading !== null}
                  onClick={() => handleStartTrial(plan.id)}
                >
                  {checkoutLoading === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      {t('checkout.processing')}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 me-2" />
                      {t('checkout.startTrial')}
                      <ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
