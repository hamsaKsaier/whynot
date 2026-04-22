import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditPage } from '../PlanEditPage';

vi.mock('../../services/api', () => ({
  getAdminPlan: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  setPlanFeatures: vi.fn(),
}));

vi.mock('../../lib/money', () => ({
  dollarsToCents: vi.fn((d: string) => Math.round(Number(d) * 100)),
  centsToDollars: vi.fn((c: number) => c / 100),
}));

import { getAdminPlan } from '../../services/api';

function renderNewPage() {
  return render(
    <MemoryRouter initialEntries={['/plans/new']}>
      <Routes>
        <Route path="/plans/new" element={<PlanEditPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEditPage(id = 'plan-1') {
  return render(
    <MemoryRouter initialEntries={[`/plans/${id}/edit`]}>
      <Routes>
        <Route path="/plans/:id/edit" element={<PlanEditPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlanEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create plan form for new plan', () => {
    renderNewPage();
    // "Create Plan" appears in both the header and the submit button
    expect(screen.getAllByText('Create Plan').length).toBeGreaterThanOrEqual(1);
  });

  it('renders form fields', () => {
    renderNewPage();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Price ($)')).toBeInTheDocument();
  });

  it('renders cancel and submit buttons', () => {
    renderNewPage();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // Submit button
    expect(screen.getByRole('button', { name: /Create Plan/ })).toBeInTheDocument();
  });

  it('renders feature flags section', () => {
    renderNewPage();
    expect(screen.getByText('Feature Flags')).toBeInTheDocument();
  });

  it('shows skeleton while loading existing plan', () => {
    vi.mocked(getAdminPlan).mockReturnValue(new Promise(() => {}));
    const { container } = renderEditPage();
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders edit form with plan data', async () => {
    vi.mocked(getAdminPlan).mockResolvedValue({
      plan: {
        id: 'plan-1',
        name: 'Pro Plan',
        slug: 'pro-plan',
        description: 'Professional tier',
        price_cents: 4999,
        billing_interval: 'monthly',
        credits_per_period: 1000,
        trial_days: 14,
        is_custom: false,
        is_public: true,
        sort_order: 1,
        features: [],
      },
    });

    renderEditPage();

    await waitFor(() => {
      expect(screen.getByText('Edit Plan')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Pro Plan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('pro-plan')).toBeInTheDocument();
  });

  it('shows breadcrumbs', () => {
    renderNewPage();
    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
