import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutPage } from '../CheckoutPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      if (opts && 'days' in opts) return `${key}:${opts.days}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const mockPlans = [
  {
    id: 'plan_free',
    name: 'Free',
    slug: 'free',
    description: 'Basic plan',
    price_cents: 0,
    credits_per_period: 100,
    billing_interval: 'monthly',
    is_custom: false,
    features: { qa_loop: 'true', max_projects: '3' },
  },
  {
    id: 'plan_pro_byo',
    name: 'Pro BYO',
    slug: 'pro_byo',
    description: 'Pro with your own keys',
    price_cents: 2900,
    credits_per_period: 1000,
    billing_interval: 'monthly',
    is_custom: false,
    features: { qa_loop: 'true', visual_regression: 'true', api_access: 'true', max_projects: '-1' },
  },
  {
    id: 'plan_pro_managed',
    name: 'Pro Managed',
    slug: 'pro_managed',
    description: 'Managed with PAYG',
    price_cents: 4900,
    credits_per_period: 2000,
    billing_interval: 'monthly',
    is_custom: false,
    features: { qa_loop: 'true', visual_regression: 'true', api_access: 'true', priority_support: 'true', max_projects: '-1' },
  },
];

vi.mock('../../services/api', () => ({
  getPublicPlans: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

import { getPublicPlans, createCheckoutSession } from '../../services/api';
const mockGetPublicPlans = vi.mocked(getPublicPlans);
const mockCreateCheckoutSession = vi.mocked(createCheckoutSession);

function renderPage() {
  return render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>
  );
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicPlans.mockResolvedValue({ plans: mockPlans });
  });

  it('renders loading state initially', () => {
    mockGetPublicPlans.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders plan cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });
    expect(screen.getByText('Pro BYO')).toBeInTheDocument();
    expect(screen.getByText('Pro Managed')).toBeInTheDocument();
  });

  it('renders tier comparison section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('checkout.compare.title')).toBeInTheDocument();
    });
    expect(screen.getAllByText('checkout.tier.byo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('checkout.tier.managed').length).toBeGreaterThanOrEqual(1);
  });

  it('renders plan features', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('checkout.feature.qaLoop').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows recommended badge on managed plan', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('checkout.recommended')).toBeInTheDocument();
    });
  });

  it('calls createCheckoutSession on Start Trial click', async () => {
    mockCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Pro BYO')).toBeInTheDocument();
    });

    const trialButtons = screen.getAllByText('checkout.startTrial');
    await user.click(trialButtons[0]);

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith('plan_pro_byo');
  });

  it('handles empty plans gracefully', async () => {
    mockGetPublicPlans.mockResolvedValue({ plans: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('checkout.title')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockGetPublicPlans.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('checkout.title')).toBeInTheDocument();
    });
  });
});
