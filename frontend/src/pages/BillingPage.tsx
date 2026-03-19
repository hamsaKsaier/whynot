import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
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
import { CreditUsageBar } from '../components/Billing/CreditUsageBar';
import { PlanCard } from '../components/Billing/PlanCard';
import { TransactionHistory } from '../components/Billing/TransactionHistory';
import { InvoiceList } from '../components/Billing/InvoiceList';
import {
  FiCreditCard,
  FiZap,
  FiTrendingUp,
  FiCalendar,
} from 'react-icons/fi';

export const BillingContent: React.FC = () => <BillingPage embedded />;

export const BillingPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [balance, setBalance] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
      setFeatures(subData.features || {});
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

  const handleUpgrade = async (planId: string) => {
    setActionLoading(true);
    try {
      const result = await createCheckoutSession(planId);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const result = await createPortalSession();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of your billing period.')) return;
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
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-700 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  const statusMap: Record<string, 'success' | 'error' | 'running' | 'pending'> = {
    active: 'success',
    trialing: 'running',
    past_due: 'error',
    canceled: 'error',
    paused: 'pending',
    incomplete: 'pending',
  };

  return (
    <div className={embedded ? 'space-y-8' : 'p-6 max-w-6xl mx-auto space-y-8'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Billing & Usage</h1>
            <p className="text-sm text-slate-400 mt-1">Manage your subscription, credits, and invoices</p>
          </div>
          {subscription?.stripe_subscription_id && (
            <Button onClick={handleManageBilling} disabled={actionLoading} variant="secondary">
              <FiCreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
          )}
        </div>
      )}

      {/* Prominent Credits Card */}
      <Card className="p-6 bg-slate-800 border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <FiTrendingUp className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Credits Remaining</p>
              <p className="text-4xl font-bold text-white">{balance?.balance ?? 0}</p>
            </div>
          </div>
          <div className="text-right">
            <CreditUsageBar
              used={usage?.credits_used || 0}
              total={usage?.credits_total || 0}
              remaining={balance?.balance ?? 0}
            />
            <p className="text-xs text-slate-500 mt-2">
              {usage?.credits_used || 0} used of {usage?.credits_total || 0} total this period
            </p>
          </div>
        </div>
      </Card>

      {/* Current Plan + Billing Period */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary-900/20 rounded-lg">
              <FiZap className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Current Plan</p>
              <p className="text-lg font-semibold text-white">{plan?.name || 'No Plan'}</p>
            </div>
          </div>
          {subscription && (
            <StatusBadge status={statusMap[subscription.status] || 'pending'} label={subscription.status} />
          )}
          {subscription?.cancel_at_period_end && (
            <p className="text-xs text-orange-600 mt-2">Cancels at end of period</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-900/20 rounded-lg">
              <FiCalendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Billing Period</p>
              <p className="text-sm font-medium text-white">
                {subscription?.current_period_end
                  ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : 'No active period'
                }
              </p>
            </div>
          </div>
          <div className="mt-2 space-x-2">
            {subscription?.cancel_at_period_end ? (
              <Button size="sm" onClick={handleReactivate} disabled={actionLoading}>Reactivate</Button>
            ) : subscription?.stripe_subscription_id ? (
              <Button size="sm" variant="danger" onClick={handleCancel} disabled={actionLoading}>Cancel</Button>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p: any) => (
            <PlanCard
              key={p.id}
              plan={p}
              isCurrentPlan={plan?.id === p.id}
              onUpgrade={() => handleUpgrade(p.id)}
              disabled={actionLoading}
            />
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Credit History</h2>
        <TransactionHistory transactions={transactions} />
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Invoices</h2>
          <InvoiceList invoices={invoices} />
        </div>
      )}
    </div>
  );
};
