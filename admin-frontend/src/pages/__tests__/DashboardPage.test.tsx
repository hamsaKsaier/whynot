import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from '../DashboardPage'

vi.mock('../../services/api', () => ({
  getAdminOverviewStats: vi.fn(),
  getAdminUsers: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const map: Record<string, string> = {
        'admin.dashboard.title': 'Dashboard',
        'admin.dashboard.totalUsers': 'Total Users',
        'admin.dashboard.mrr': 'MRR',
        'admin.dashboard.arr': 'ARR',
        'admin.dashboard.activePlans': 'Active Plans',
        'admin.dashboard.recentSignups': 'Recent Signups',
        'admin.dashboard.subscriptionsByPlan': 'Subscriptions by Plan',
        'admin.dashboard.recentUsers': 'Recent Users',
        'admin.dashboard.noUsers': 'No users yet',
        'admin.dashboard.noSubscriptionData': 'No subscription data',
        'admin.dashboard.creditsLabel': 'credits',
        'admin.dashboard.quickActions.users': 'Users',
        'admin.dashboard.quickActions.plans': 'Plans',
        'admin.dashboard.quickActions.analytics': 'Analytics',
        'admin.dashboard.quickActions.settings': 'Settings',
        'admin.dashboard.columns.name': 'Name',
        'admin.dashboard.columns.email': 'Email',
        'admin.dashboard.columns.plan': 'Plan',
        'admin.dashboard.columns.credits': 'Credits',
        'admin.dashboard.columns.joined': 'Joined',
        'admin.dashboard.subscribers': `${opts?.count ?? 0} subscribers`,
      }
      return map[key] || key
    },
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() },
  }),
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

  it('renders desktop table wrapper (hidden on mobile in jsdom)', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('mobile-user-cards')).toBeInTheDocument()
    })

    const desktopWrapper = document.querySelector('.hidden.md\\:block')
    expect(desktopWrapper).toBeTruthy()
    expect(desktopWrapper?.querySelector('table')).toBeTruthy()
    expect(desktopWrapper?.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('renders mobile card view for recent users', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('mobile-user-cards')).toBeInTheDocument()
    })

    const mobileCards = screen.getByTestId('mobile-user-cards')
    expect(mobileCards.className).toContain('md:hidden')
    expect(within(mobileCards).getByText('Alice')).toBeInTheDocument()
    expect(within(mobileCards).getByText('Bob')).toBeInTheDocument()
  })

  it('renders quick actions bar with 4 links', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
    })

    const quickActions = screen.getByTestId('quick-actions')
    const links = within(quickActions).getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links[0]).toHaveAttribute('href', '/users')
    expect(links[1]).toHaveAttribute('href', '/plans')
    expect(links[2]).toHaveAttribute('href', '/analytics')
    expect(links[3]).toHaveAttribute('href', '/settings')
  })

  it('quick actions bar is sticky on mobile', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
    })

    const bar = screen.getByTestId('quick-actions')
    expect(bar.className).toContain('sticky')
    expect(bar.className).toContain('sm:static')
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

    expect(screen.getByText('Total Users')).toBeInTheDocument()
  })

  it('calls API functions on mount', () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    expect(getAdminOverviewStats).toHaveBeenCalledTimes(1)
    expect(getAdminUsers).toHaveBeenCalledWith({ limit: 5 })
  })

  it('KPI grid uses responsive column classes', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('142')).toBeInTheDocument()
    })

    const grid = screen.getByText('Total Users').closest('.grid')
    expect(grid?.className).toContain('grid-cols-1')
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-4')
  })

  it('KPI cards have responsive padding', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('142')).toBeInTheDocument()
    })

    const cardContent = screen.getByText('142').closest('[class*="p-4"]')
    expect(cardContent?.className).toContain('p-4')
    expect(cardContent?.className).toContain('sm:p-5')
  })
})
