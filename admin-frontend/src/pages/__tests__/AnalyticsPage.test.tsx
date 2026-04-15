import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnalyticsPage } from '../AnalyticsPage'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Area: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

vi.mock('../../services/api', () => ({
  getAnalyticsOverview: vi.fn(),
  getAnalyticsSignups: vi.fn(),
  getAnalyticsRevenue: vi.fn(),
  getAnalyticsUsage: vi.fn(),
  getAnalyticsChurn: vi.fn(),
}))

import {
  getAnalyticsOverview,
  getAnalyticsSignups,
  getAnalyticsRevenue,
  getAnalyticsUsage,
  getAnalyticsChurn,
} from '../../services/api'

const mockOverview = {
  overview: {
    total_users: 250,
    active_subscriptions: 120,
    mrr_cents: 1200000,
    arr_cents: 14400000,
  },
}

const mockSignups = {
  signups: [
    { date: '2025-03-01', count: 5 },
    { date: '2025-03-02', count: 8 },
  ],
}

const mockRevenue = {
  revenue: [
    { plan_name: 'Pro', mrr_cents: 800000 },
    { plan_name: 'Starter', mrr_cents: 400000 },
  ],
}

const mockUsage = {
  usage: [
    { date: '2025-03-01', credits_used: 150 },
    { date: '2025-03-02', credits_used: 200 },
  ],
}

const mockChurn = {
  churn: [
    { date: '2025-01-01', cancellations: 2 },
    { date: '2025-02-01', cancellations: 1 },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  )
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAnalyticsOverview).mockResolvedValue(mockOverview)
    vi.mocked(getAnalyticsSignups).mockResolvedValue(mockSignups)
    vi.mocked(getAnalyticsRevenue).mockResolvedValue(mockRevenue)
    vi.mocked(getAnalyticsUsage).mockResolvedValue(mockUsage)
    vi.mocked(getAnalyticsChurn).mockResolvedValue(mockChurn)
  })

  it('shows loading skeletons while fetching', () => {
    vi.mocked(getAnalyticsOverview).mockReturnValue(new Promise(() => {}))
    vi.mocked(getAnalyticsSignups).mockReturnValue(new Promise(() => {}))
    vi.mocked(getAnalyticsRevenue).mockReturnValue(new Promise(() => {}))
    vi.mocked(getAnalyticsUsage).mockReturnValue(new Promise(() => {}))
    vi.mocked(getAnalyticsChurn).mockReturnValue(new Promise(() => {}))

    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders KPI cards after loading', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('Active Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.getByText('ARR')).toBeInTheDocument()
  })

  it('renders chart containers', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Signups (Last 30 days)')).toBeInTheDocument()
    })

    expect(screen.getByText('Revenue by Plan')).toBeInTheDocument()
    expect(screen.getByText('Credit Usage (Last 30 days)')).toBeInTheDocument()
    expect(screen.getByText('Cancellations (Last 90 days)')).toBeInTheDocument()

    // Chart components should be rendered (via mocks)
    const areaCharts = screen.getAllByTestId('area-chart')
    expect(areaCharts.length).toBeGreaterThanOrEqual(1)

    const barCharts = screen.getAllByTestId('bar-chart')
    expect(barCharts.length).toBeGreaterThanOrEqual(1)
  })

  it('calls all analytics API functions on mount', () => {
    renderPage()

    expect(getAnalyticsOverview).toHaveBeenCalledTimes(1)
    expect(getAnalyticsSignups).toHaveBeenCalledWith(30)
    expect(getAnalyticsRevenue).toHaveBeenCalledTimes(1)
    expect(getAnalyticsUsage).toHaveBeenCalledWith(30)
    expect(getAnalyticsChurn).toHaveBeenCalledWith(90)
  })

  it('shows no cancellations message when churn is empty', async () => {
    vi.mocked(getAnalyticsChurn).mockResolvedValue({ churn: [] })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No cancellations in this period')).toBeInTheDocument()
    })
  })
})
