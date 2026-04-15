import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuditLogPage } from '../AuditLogPage'

vi.mock('../../services/api', () => ({
  getAuditLog: vi.fn(),
}))

import { getAuditLog } from '../../services/api'

const mockAuditLog = {
  entries: [
    {
      id: 'log-1',
      created_at: '2025-03-15T10:30:00Z',
      actor_email: 'admin@test.com',
      actor_id: 'user-1',
      action: 'user.role_change',
      target_type: 'user',
      target_id: 'user-99',
      details: { old_role: 'user', new_role: 'admin' },
    },
    {
      id: 'log-2',
      created_at: '2025-03-14T08:00:00Z',
      actor_email: 'admin@test.com',
      actor_id: 'user-1',
      action: 'credits.grant',
      target_type: 'workspace',
      target_id: 'ws-42',
      details: { amount: 500 },
    },
    {
      id: 'log-3',
      created_at: '2025-03-13T16:45:00Z',
      actor_email: null,
      actor_id: null,
      action: 'settings.update',
      target_type: null,
      target_id: null,
      details: {},
    },
  ],
  nextCursor: null,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuditLogPage />
    </MemoryRouter>,
  )
}

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuditLog).mockResolvedValue(mockAuditLog)
  })

  it('shows loading state initially', () => {
    vi.mocked(getAuditLog).mockReturnValue(new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders audit log table with entries', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getAllByText('admin@test.com').length).toBe(2)
    })

    expect(screen.getByText('user.role_change')).toBeInTheDocument()
    expect(screen.getByText('credits.grant')).toBeInTheDocument()
    expect(screen.getByText('settings.update')).toBeInTheDocument()
  })

  it('renders page title', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Audit Log')).toBeInTheDocument()
    })
  })

  it('renders target type and id for entries that have them', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getAllByText('admin@test.com').length).toBe(2)
    })

    expect(screen.getByText('user:user-99')).toBeInTheDocument()
    expect(screen.getByText('workspace:ws-42')).toBeInTheDocument()
  })

  it('shows System for entries without an actor', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument()
    })
  })

  it('shows empty state when no entries', async () => {
    vi.mocked(getAuditLog).mockResolvedValue({ entries: [], nextCursor: null })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No audit entries found')).toBeInTheDocument()
    })
  })

  it('calls getAuditLog with cursor-based params on mount', () => {
    renderPage()

    expect(getAuditLog).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 30,
      action: undefined,
      from: undefined,
      to: undefined,
    })
  })

  it('renders pagination controls', async () => {
    vi.mocked(getAuditLog).mockResolvedValue({
      entries: mockAuditLog.entries,
      nextCursor: 'abc123',
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getAllByText('admin@test.com').length).toBe(2)
    })

    expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
  })
})
