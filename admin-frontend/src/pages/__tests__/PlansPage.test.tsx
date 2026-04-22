import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PlansPage } from '../PlansPage'

vi.mock('../../services/api', () => ({
  getAdminPlans: vi.fn(),
  archivePlan: vi.fn(),
  restorePlan: vi.fn(),
  syncPlanToStripe: vi.fn(),
}))

import { getAdminPlans, archivePlan } from '../../services/api'

const mockPlans = {
  plans: [
    {
      id: 'plan-1',
      name: 'Starter',
      price_cents: 999,
      billing_interval: 'month',
      credits_per_period: 100,
      trial_days: 14,
      subscriber_count: 42,
      is_archived: false,
      is_public: true,
      is_custom: false,
      features: [{ feature_key: 'max_projects', feature_value: '5' }],
    },
    {
      id: 'plan-2',
      name: 'Pro',
      price_cents: 4999,
      billing_interval: 'month',
      credits_per_period: 1000,
      trial_days: 0,
      subscriber_count: 15,
      is_archived: false,
      is_public: true,
      is_custom: false,
      features: [],
    },
    {
      id: 'plan-3',
      name: 'Legacy',
      price_cents: 1999,
      billing_interval: 'month',
      credits_per_period: 500,
      trial_days: 0,
      subscriber_count: 5,
      is_archived: true,
      is_public: false,
      is_custom: false,
      features: [],
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PlansPage />
    </MemoryRouter>,
  )
}

describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminPlans).mockResolvedValue(mockPlans)
  })

  it('shows loading skeletons while fetching', () => {
    vi.mocked(getAdminPlans).mockReturnValue(new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders plan cards after loading', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument()
    })

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Legacy')).toBeInTheDocument()
  })

  it('shows Archived badge on archived plans', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Legacy')).toBeInTheDocument()
    })

    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('renders feature badges on plan cards', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('max_projects: 5')).toBeInTheDocument()
    })
  })

  it('has a New Plan link', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument()
    })

    const newPlanLink = screen.getByRole('link', { name: /new plan/i })
    expect(newPlanLink).toBeInTheDocument()
    expect(newPlanLink).toHaveAttribute('href', '/plans/new')
  })

  it('archive button opens confirm dialog', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument()
    })

    // Click the archive button (first non-archived plan's archive icon button)
    const archiveButtons = screen.getAllByTitle('Archive')
    await user.click(archiveButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Archive Plan')).toBeInTheDocument()
    })

    expect(screen.getByText(/Are you sure you want to archive "Starter"/)).toBeInTheDocument()
  })

  it('shows empty state when no plans exist', async () => {
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [] })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No plans created yet.')).toBeInTheDocument()
    })
  })

  it('renders page title', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Plans')).toBeInTheDocument()
    })
  })
})
