import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BillingTab } from '../settings/tabs/BillingTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'days' in opts) return `${key}:${opts.days}`;
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      if (opts && 'date' in opts) return `${key}:${opts.date}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const mockSubscription = {
  id: 'sub_1',
  status: 'active',
  trial_start: null,
  trial_end: null,
  current_period_start: '2026-04-01T00:00:00Z',
  current_period_end: '2026-05-01T00:00:00Z',
  cancel_at_period_end: false,
  canceled_at: null,
  stripe_subscription_id: 'stripe_sub_1',
  stripe_customer_id: 'cus_1',
};

const mockPlan = {
  id: 'plan_pro_byo',
  name: 'Pro BYO',
  slug: 'pro_byo',
  price_cents: 2900,
  tier: 'byo_keys',
};

vi.mock('../../services/api', () => ({
  getBillingSubscription: vi.fn(),
  getBillingCredits: vi.fn(),
  getBillingCreditsHistory: vi.fn(),
  getBillingUsage: vi.fn(),
  getBillingInvoices: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
}));

import {
  getBillingSubscription,
  getBillingCredits,
  getBillingUsage,
  getBillingCreditsHistory,
  getBillingInvoices,
  cancelSubscription,
  reactivateSubscription,
} from '../../services/api';

const mockGetSub = vi.mocked(getBillingSubscription);
const mockGetCredits = vi.mocked(getBillingCredits);
const mockGetUsage = vi.mocked(getBillingUsage);
const mockGetHistory = vi.mocked(getBillingCreditsHistory);
const mockGetInvoices = vi.mocked(getBillingInvoices);

function setupMocks(overrides: { subscription?: any; plan?: any; features?: any } = {}) {
  mockGetSub.mockResolvedValue({
    subscription: overrides.subscription ?? mockSubscription,
    plan: overrides.plan ?? mockPlan,
    features: overrides.features ?? {},
  });
  mockGetCredits.mockResolvedValue({ balance: { balance: 750 } });
  mockGetUsage.mockResolvedValue({ usage: { credits_used: 250, credits_remaining: 750, credits_total: 1000 } });
  mockGetHistory.mockResolvedValue({ transactions: [] });
  mockGetInvoices.mockResolvedValue({ invoices: [] });
}

function renderTab() {
  return render(
    <MemoryRouter>
      <BillingTab />
    </MemoryRouter>
  );
}

describe('BillingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton initially', () => {
    mockGetSub.mockReturnValue(new Promise(() => {}));
    mockGetCredits.mockReturnValue(new Promise(() => {}));
    mockGetUsage.mockReturnValue(new Promise(() => {}));
    mockGetHistory.mockReturnValue(new Promise(() => {}));
    mockGetInvoices.mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders current plan name', async () => {
    setupMocks();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('Pro BYO')).toBeInTheDocument();
    });
  });

  it('renders active status badge', async () => {
    setupMocks();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('billingTab.status.active')).toBeInTheDocument();
    });
  });

  it('renders credit balance', async () => {
    setupMocks();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('750')).toBeInTheDocument();
    });
  });

  it('shows trial banner when trialing', async () => {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    setupMocks({
      subscription: { ...mockSubscription, status: 'trialing', trial_end: trialEnd },
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/billingTab\.trial\.active/)).toBeInTheDocument();
    });
  });

  it('does not show trial banner when active', async () => {
    setupMocks();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('Pro BYO')).toBeInTheDocument();
    });
    expect(screen.queryByText(/billingTab\.trial\.active/)).not.toBeInTheDocument();
  });

  it('shows top-up card for managed_payg tier', async () => {
    setupMocks({
      plan: { ...mockPlan, tier: 'managed_payg', name: 'Pro Managed' },
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('billingTab.topUp.title')).toBeInTheDocument();
    });
  });

  it('hides top-up card for byo_keys tier', async () => {
    setupMocks();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('Pro BYO')).toBeInTheDocument();
    });
    expect(screen.queryByText('billingTab.topUp.title')).not.toBeInTheDocument();
  });

  it('shows cancel button for active subscriptions', async () => {
    setupMocks();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('billing.cancel')).toBeInTheDocument();
    });
  });

  it('shows reactivate button when cancel_at_period_end', async () => {
    setupMocks({
      subscription: { ...mockSubscription, cancel_at_period_end: true },
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('billingTab.reactivate')).toBeInTheDocument();
    });
  });

  it('renders invoice table with data', async () => {
    mockGetSub.mockResolvedValue({ subscription: mockSubscription, plan: mockPlan, features: {} });
    mockGetCredits.mockResolvedValue({ balance: { balance: 750 } });
    mockGetUsage.mockResolvedValue({ usage: { credits_used: 250, credits_remaining: 750, credits_total: 1000 } });
    mockGetHistory.mockResolvedValue({ transactions: [] });
    mockGetInvoices.mockResolvedValue({
      invoices: [{
        id: 'inv_1',
        amount_cents: 2900,
        currency: 'usd',
        status: 'paid',
        period_start: '2026-03-01T00:00:00Z',
        period_end: '2026-04-01T00:00:00Z',
        paid_at: '2026-03-01T00:00:00Z',
        invoice_url: 'https://stripe.com/inv/1',
        invoice_pdf: 'https://stripe.com/inv/1.pdf',
        created_at: '2026-03-01T00:00:00Z',
      }],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('paid')).toBeInTheDocument();
    });
  });

  it('shows empty invoices message', async () => {
    setupMocks();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('billing.invoices.empty')).toBeInTheDocument();
    });
  });

  it('handles all API failures gracefully', async () => {
    mockGetSub.mockRejectedValue(new Error('fail'));
    mockGetCredits.mockRejectedValue(new Error('fail'));
    mockGetUsage.mockRejectedValue(new Error('fail'));
    mockGetHistory.mockRejectedValue(new Error('fail'));
    mockGetInvoices.mockRejectedValue(new Error('fail'));
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('billingTab.noPlan')).toBeInTheDocument();
    });
  });
});
