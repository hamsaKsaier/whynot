import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getBillingSubscription,
  getBillingCredits,
  getBillingCreditsHistory,
  getBillingUsage,
  getBillingInvoices,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  reactivateSubscription,
} from '../../../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Progress } from '../../../components/ui/progress';
import { Separator } from '../../../components/ui/separator';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  CreditCard,
  Zap,
  TrendingUp,
  Calendar,
  ExternalLink,
  Download,
  Loader2,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
} from 'lucide-react';

interface Subscription {
  id: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  tier: string;
}

interface Invoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  trialing: 'secondary',
  past_due: 'destructive',
  canceled: 'destructive',
  paused: 'outline',
  incomplete: 'outline',
};

export const BillingTab: React.FC = () => {
  const { t, i18n } = useTranslation('billing');
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [balance, setBalance] = useState<{ balance: number } | null>(null);
  const [usage, setUsage] = useState<{ credits_used: number; credits_remaining: number; credits_total: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subData, creditsData, usageData, historyData, invoicesData] = await Promise.all([
        getBillingSubscription().catch(() => ({ subscription: null, plan: null, features: {} })),
        getBillingCredits().catch(() => ({ balance: { balance: 0 } })),
        getBillingUsage().catch(() => ({ usage: { credits_used: 0, credits_remaining: 0, credits_total: 0 } })),
        getBillingCreditsHistory().catch(() => ({ transactions: [] })),
        getBillingInvoices().catch(() => ({ invoices: [] })),
      ]);

      setSubscription(subData.subscription);
      setPlan(subData.plan);
      setFeatures(subData.features || {});
      setBalance(creditsData.balance);
      setUsage(usageData.usage);
      setTransactions(historyData.transactions || []);
      setInvoices(invoicesData.invoices || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isTrialing = subscription?.status === 'trialing';
  const isManagedPayg = plan?.tier === 'managed_payg';

  const trialDaysRemaining = (() => {
    if (!isTrialing || !subscription?.trial_end) return 0;
    const diff = new Date(subscription.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const formatCurrency = (cents: number, currency = 'USD') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const result = await createPortalSession();
      if (result.url) window.location.href = result.url;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelSubscription();
      setCancelDialogOpen(false);
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

  const handleUpgrade = () => {
    navigate('/checkout');
  };

  const handleTopUp = async () => {
    setActionLoading(true);
    try {
      const result = await createPortalSession();
      if (result.url) window.location.href = result.url;
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    <div className="space-y-6">
      {/* Trial Banner */}
      {isTrialing && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('billingTab.trial.active', { days: trialDaysRemaining })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('billingTab.trial.expires', {
                    date: subscription?.trial_end ? formatDate(subscription.trial_end) : '',
                  })}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleUpgrade}>
              {t('billingTab.trial.upgrade')}
              <ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Plan */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('billing.currentPlan')}</p>
                <p className="text-base font-semibold text-foreground">{plan?.name || t('billingTab.noPlan')}</p>
              </div>
            </div>
            {subscription && (
              <Badge variant={STATUS_VARIANTS[subscription.status] || 'outline'}>
                {t(`billingTab.status.${subscription.status}`)}
              </Badge>
            )}
            {subscription?.cancel_at_period_end && (
              <p className="text-xs text-destructive mt-2">
                {t('billingTab.cancelsAtEnd')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
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
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('billingTab.period')}</p>
                <p className="text-sm font-medium text-foreground">
                  {subscription?.current_period_end
                    ? t('billingTab.renewsOn', { date: formatDate(subscription.current_period_end) })
                    : t('billingTab.noPeriod')}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              {subscription?.cancel_at_period_end ? (
                <Button size="sm" variant="outline" onClick={handleReactivate} disabled={actionLoading}>
                  {t('billingTab.reactivate')}
                </Button>
              ) : subscription?.stripe_subscription_id ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleManageBilling} disabled={actionLoading}>
                    <CreditCard className="h-4 w-4 me-1" />
                    {t('billingTab.manage')}
                  </Button>
                  <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        {t('billing.cancel')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('billing.cancel')}</DialogTitle>
                        <DialogDescription>{t('billing.cancelConfirm')}</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                          {t('billingTab.keepPlan')}
                        </Button>
                        <Button variant="destructive" onClick={handleCancel} disabled={actionLoading}>
                          {actionLoading && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
                          {t('billing.cancel')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <Button size="sm" onClick={handleUpgrade}>
                  {t('billing.plans.upgrade')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Top-Up (Managed+PAYG only) */}
      {isManagedPayg && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{t('billingTab.topUp.title')}</CardTitle>
              </div>
              <Button size="sm" variant="outline" onClick={handleTopUp} disabled={actionLoading}>
                <Plus className="h-4 w-4 me-1" />
                {t('billingTab.topUp.action')}
              </Button>
            </div>
            <CardDescription>{t('billingTab.topUp.description')}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('billing.invoices.title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">{t('billing.invoices.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('billing.invoices.date')}</TableHead>
                  <TableHead className="text-start">{t('billingTab.invoicePeriod')}</TableHead>
                  <TableHead className="text-end">{t('billing.invoices.amount')}</TableHead>
                  <TableHead className="text-start">{t('billing.invoices.status')}</TableHead>
                  <TableHead className="text-end">{t('billingTab.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-start">{formatDate(inv.created_at)}</TableCell>
                    <TableCell className="text-start text-muted-foreground">
                      {inv.period_start && inv.period_end
                        ? `${formatDate(inv.period_start)} – ${formatDate(inv.period_end)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatCurrency(inv.amount_cents, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'open' ? 'secondary' : 'outline'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        {inv.invoice_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {inv.invoice_pdf && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Credit Transaction History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('billingTab.creditHistory')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('billing.invoices.date')}</TableHead>
                  <TableHead className="text-start">{t('billingTab.type')}</TableHead>
                  <TableHead className="text-start">{t('billingTab.description')}</TableHead>
                  <TableHead className="text-end">{t('billing.invoices.amount')}</TableHead>
                  <TableHead className="text-end">{t('billingTab.balanceAfter')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-start">{formatDate(txn.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={txn.amount > 0 ? 'default' : 'secondary'}>
                        {t(`billingTab.txnType.${txn.type}`, txn.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {txn.description || '—'}
                    </TableCell>
                    <TableCell className={`text-end font-medium ${txn.amount > 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {txn.balance_after}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
