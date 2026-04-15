import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SubscriptionsPage } from '../SubscriptionsPage'

vi.mock('../../services/api', () => ({
  getAdminSubscriptions: vi.fn(),
}))

import { getAdminSubscriptions } from '../../services/api'

const mockSubscriptions = {
  subscriptions: [
    {
      id: 'sub-1',
      workspace_name: 'Acme Corp',
      workspace_id: 'ws-1',
      owner_name: 'Alice',
      plan_name: 'Pro',
      status: 'active',
      credits_remaining: 750,
      current_period_end: '2025-04-30T00:00:00Z',
    },
    {
      id: 'sub-2',
      workspace_name: 'Beta Inc',
      workspace_id: 'ws-2',
      owner_name: 'Bob',
      plan_name: 'Starter',
      status: 'trialing',
      credits_remaining: 100,
      current_period_end: '2025-03-15T00:00:00Z',
    },
    {
      id: 'sub-3',
      workspace_name: 'Gamma Ltd',
      workspace_id: 'ws-3',
      owner_name: 'Charlie',
      plan_name: 'Pro',
      status: 'canceled',
      credits_remaining: 0,
      current_period_end: '2025-02-28T00:00:00Z',
    },
  ],
  total: 3,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SubscriptionsPage />
    </MemoryRouter>,
  )
}

describe('SubscriptionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminSubscriptions).mockResolvedValue(mockSubscriptions)
  })

  it('shows loading state initially', () => {
    vi.mocked(getAdminSubscriptions).mockReturnValue(new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders subscription rows after loading', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    expect(screen.getByText('Beta Inc')).toBeInTheDocument()
    expect(screen.getByText('Gamma Ltd')).toBeInTheDocument()
  })

  it('renders page title and total count', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    })

    expect(screen.getByText('3 total')).toBeInTheDocument()
  })

  it('renders owner and plan info', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    expect(screen.getByText('Bob')).toBeInTheDocument()
    // Plan names rendered in table
    const proCells = screen.getAllByText('Pro')
    expect(proCells.length).toBeGreaterThanOrEqual(1)
  })

  it('renders credits remaining', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('750')).toBeInTheDocument()
    })

    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('calls API with default params on mount', () => {
    renderPage()

    expect(getAdminSubscriptions).toHaveBeenCalledWith({
      offset: 0,
      limit: 20,
      status: undefined,
    })
  })

  it('shows empty state when no subscriptions', async () => {
    vi.mocked(getAdminSubscriptions).mockResolvedValue({ subscriptions: [], total: 0 })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No subscriptions found')).toBeInTheDocument()
    })
  })

  it('renders pagination when there are many subscriptions', async () => {
    vi.mocked(getAdminSubscriptions).mockResolvedValue({
      subscriptions: mockSubscriptions.subscriptions,
      total: 50,
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })
})
