import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from '../DashboardPage'

vi.mock('../../services/api', () => ({
  getAdminOverviewStats: vi.fn(),
  getAdminUsers: vi.fn(),
}))

import { getAdminOverviewStats, getAdminUsers } from '../../services/api'

const mockStats = {
  stats: {
    total_users: 142,
    mrr_cents: 499900,
    subscriptions_by_plan: [
      { plan_id: 'pro', count: 30 },
      { plan_id: 'starter', count: 80 },
    ],
  },
}

const mockUsers = {
  users: [
    { id: '1', name: 'Alice', email: 'alice@test.com', plan_name: 'Pro', credits: 500, created_at: '2025-01-15T00:00:00Z' },
    { id: '2', name: 'Bob', email: 'bob@test.com', plan_name: 'Starter', credits: 100, created_at: '2025-02-10T00:00:00Z' },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeletons while data is fetching', () => {
    vi.mocked(getAdminOverviewStats).mockReturnValue(new Promise(() => {}))
    vi.mocked(getAdminUsers).mockReturnValue(new Promise(() => {}))

    renderPage()

    // Skeleton elements should be present (Skeleton renders divs with specific classes)
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders KPI cards after data loads', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('142')).toBeInTheDocument()
    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.getByText('Active Plans')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('ARR')).toBeInTheDocument()
  })

  it('renders recent users table with data', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('bob@test.com')).toBeInTheDocument()
  })

  it('shows empty state when no users exist', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue({ stats: {} })
    vi.mocked(getAdminUsers).mockResolvedValue({ users: [] })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No users yet')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(getAdminOverviewStats).mockRejectedValue(new Error('fail'))
    vi.mocked(getAdminUsers).mockRejectedValue(new Error('fail'))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Should still render with empty/default data
    expect(screen.getByText('Total Users')).toBeInTheDocument()
  })

  it('calls API functions on mount', () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    expect(getAdminOverviewStats).toHaveBeenCalledTimes(1)
    expect(getAdminUsers).toHaveBeenCalledWith({ limit: 5 })
  })
})
