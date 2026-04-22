import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import {
  getBillingSubscription,
  getBillingCredits,
  getBillingCreditsHistory,
  getBillingUsage,
  getPublicPlans,
  createCheckoutSession,
  createPortalSession,
  getBillingInvoices,
  cancelSubscription,
  reactivateSubscription,
} from '../services/api';
import { PlanCard } from '../components/Billing/PlanCard';
import { TransactionHistory } from '../components/Billing/TransactionHistory';
import { InvoiceList } from '../components/Billing/InvoiceList';
import {
  CreditCard,
  Zap,
  TrendingUp,
  Calendar,
  Loader2,
} from 'lucide-react';

export const BillingContent: React.FC = () => <BillingPage embedded />;

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  trialing: 'secondary',
  past_due: 'destructive',
  canceled: 'destructive',
  paused: 'outline',
  incomplete: 'outline',
};

export const BillingPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { t, i18n } = useTranslation('billing');
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subData, creditsData, usageData, plansData, historyData, invoicesData] = await Promise.all([
        getBillingSubscription().catch(() => ({ subscription: null, plan: null, features: {} })),
        getBillingCredits().catch(() => ({ balance: { balance: 0 } })),
        getBillingUsage().catch(() => ({ usage: { credits_used: 0, credits_remaining: 0, credits_total: 0 } })),
        getPublicPlans().catch(() => ({ plans: [] })),
        getBillingCreditsHistory().catch(() => ({ transactions: [] })),
        getBillingInvoices().catch(() => ({ invoices: [] })),
      ]);

      setSubscription(subData.subscription);
      setPlan(subData.plan);
      setBalance(creditsData.balance);
      setUsage(usageData.usage);
      setPlans(plansData.plans || []);
      setTransactions(historyData.transactions || []);
      setInvoices(invoicesData.invoices || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  const handleUpgrade = async (planId: string) => {
    setCheckoutPlanId(planId);
    try {
      const result = await createCheckoutSession(planId);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckoutPlanId(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const result = await createPortalSession();
      if (result.url) {
        window.location.href = result.url;
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t('billing.cancelConfirm'))) return;
    setActionLoading(true);
    try {
      await cancelSubscription();
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await reactivateSubscription();
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={embedded ? 'space-y-6' : 'px-4 py-6 sm:px-6 max-w-6xl mx-auto space-y-6'}>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const usagePercent = usage && usage.credits_total > 0
    ? Math.min((usage.credits_used / usage.credits_total) * 100, 100)
    : 0;

  return (
    <div className={embedded ? 'space-y-8' : 'px-4 py-6 sm:px-6 max-w-6xl mx-auto space-y-8'}>
      {/* Header */}
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{t('billing.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('billing.subtitle')}</p>
          </div>
          {subscription?.stripe_subscription_id && (
            <Button onClick={handleManageBilling} disabled={actionLoading} variant="outline" className="w-full sm:w-auto">
              <CreditCard className="me-2 h-4 w-4" />
              {t('billingTab.manage')}
            </Button>
          )}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Current Plan */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('billing.currentPlan')}</p>
                <p className="text-base font-semibold text-foreground truncate">{plan?.name || t('billingTab.noPlan')}</p>
              </div>
            </div>
            {subscription && (
              <Badge variant={STATUS_VARIANTS[subscription.status] || 'outline'}>
                {t(`billingTab.status.${subscription.status}`)}
              </Badge>
            )}
            {subscription?.cancel_at_period_end && (
              <p className="text-xs text-destructive mt-2">{t('billingTab.cancelsAtEnd')}</p>
            )}
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('billing.credits.remaining')}</p>
                <p className="text-base font-semibold text-foreground">{balance?.balance ?? 0}</p>
              </div>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{t('billingTab.creditsUsed', { count: usage?.credits_used ?? 0 })}</span>
              <span>{t('billingTab.creditsOf', { count: usage?.credits_total ?? 0 })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Billing Period */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('billingTab.period')}</p>
                <p className="text-sm font-medium text-foreground">
                  {subscription?.current_period_end
                    ? t('billingTab.renewsOn', { date: formatDate(subscription.current_period_end) })
                    : t('billingTab.noPeriod')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {subscription?.cancel_at_period_end ? (
                <Button size="sm" variant="outline" onClick={handleReactivate} disabled={actionLoading}>
                  {t('billingTab.reactivate')}
                </Button>
              ) : subscription?.stripe_subscription_id ? (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={handleCancel} disabled={actionLoading}>
                  {t('billing.cancel')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => plans[0] && handleUpgrade(plans[0].id)}>
                  {t('billing.plans.upgrade')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">{t('billing.plans.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p: any) => (
            <PlanCard
              key={p.id}
              plan={p}
              isCurrentPlan={plan?.id === p.id}
              isPopular={p.slug === 'pro_managed'}
              onUpgrade={() => handleUpgrade(p.id)}
              disabled={actionLoading || checkoutPlanId !== null}
              loading={checkoutPlanId === p.id}
            />
          ))}
        </div>
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('billingTab.creditHistory')}</h2>
          <TransactionHistory transactions={transactions} />
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('billing.invoices.title')}</h2>
          <InvoiceList invoices={invoices} />
        </div>
      )}
    </div>
  );
};
