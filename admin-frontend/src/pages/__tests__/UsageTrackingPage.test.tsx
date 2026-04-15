import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UsageTrackingPage } from '../UsageTrackingPage'

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
  getUsageSummary: vi.fn(),
  getUsageEvents: vi.fn(),
}))

import { getUsageSummary, getUsageEvents } from '../../services/api'

const mockSummary = {
  byOrg: [
    { workspaceId: 'ws-001', eventCount: 42, totalCredits: 128 },
    { workspaceId: 'ws-002', eventCount: 15, totalCredits: 45 },
  ],
  byType: [
    { eventType: 'test_generation', eventCount: 30, totalCredits: 90 },
    { eventType: 'test_execution', eventCount: 27, totalCredits: 83 },
  ],
  daily: [
    { date: '2025-03-14', eventCount: 20, totalCredits: 60 },
    { date: '2025-03-15', eventCount: 37, totalCredits: 113 },
  ],
}

const mockEvents = {
  entries: [
    {
      id: 'evt-1',
      workspace_id: 'ws-001',
      user_id: 'user-1',
      event_type: 'test_generation',
      credits_consumed: 3,
      metadata: {},
      created_at: '2025-03-15T10:00:00Z',
    },
    {
      id: 'evt-2',
      workspace_id: 'ws-002',
      user_id: null,
      event_type: 'test_execution',
      credits_consumed: 1,
      metadata: {},
      created_at: '2025-03-15T09:00:00Z',
    },
  ],
  nextCursor: null,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <UsageTrackingPage />
    </MemoryRouter>,
  )
}

describe('UsageTrackingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUsageSummary).mockResolvedValue(mockSummary)
    vi.mocked(getUsageEvents).mockResolvedValue(mockEvents)
  })

  it('shows loading skeletons initially', () => {
    vi.mocked(getUsageSummary).mockReturnValue(new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders page title', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Usage Tracking')).toBeInTheDocument()
    })
  })

  it('renders KPI cards after loading', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Total Events')).toBeInTheDocument()
    })

    expect(screen.getByText('57')).toBeInTheDocument()
    expect(screen.getByText('173')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders chart containers on overview tab', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Daily Usage (Last 30 days)')).toBeInTheDocument()
    })

    expect(screen.getByText('Usage by Event Type')).toBeInTheDocument()
  })

  it('renders tabs for overview, organizations, and events', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    expect(screen.getByText('By Organization')).toBeInTheDocument()
    expect(screen.getByText('Events')).toBeInTheDocument()
  })

  it('shows empty state when no usage data', async () => {
    vi.mocked(getUsageSummary).mockResolvedValue({ byOrg: [], byType: [], daily: [] })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Usage tracking data will appear here/)).toBeInTheDocument()
    })
  })

  it('calls getUsageSummary on mount', () => {
    renderPage()

    expect(getUsageSummary).toHaveBeenCalledTimes(1)
  })

  it('switches to events tab and fetches events', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Usage Tracking')).toBeInTheDocument()
    })

    const eventsTab = screen.getByText('Events')
    await user.click(eventsTab)

    await waitFor(() => {
      expect(getUsageEvents).toHaveBeenCalled()
    })
  })

  it('switches to orgs tab and shows org table', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Total Events')).toBeInTheDocument()
    })

    const orgsTab = screen.getByText('By Organization')
    await user.click(orgsTab)

    await waitFor(() => {
      expect(screen.getByText('ws-001')).toBeInTheDocument()
    })
  })
})
