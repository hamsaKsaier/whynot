import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AnnouncementsPage } from '../AnnouncementsPage'

vi.mock('../../services/api', () => ({
  getAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
}))

import { getAnnouncements, createAnnouncement } from '../../services/api'

const mockAnnouncements = {
  announcements: [
    {
      id: 'ann-1',
      title: 'Scheduled Maintenance',
      body: 'We will perform maintenance on Saturday.',
      type: 'warning' as const,
      is_active: true,
      starts_at: '2025-04-01T00:00:00Z',
      ends_at: '2025-04-02T00:00:00Z',
      created_at: '2025-03-20T00:00:00Z',
    },
    {
      id: 'ann-2',
      title: 'New Feature Released',
      body: 'Check out our new analytics dashboard.',
      type: 'info' as const,
      is_active: true,
      starts_at: null,
      ends_at: null,
      created_at: '2025-03-18T00:00:00Z',
    },
    {
      id: 'ann-3',
      title: 'Deprecated API v1',
      body: 'API v1 will be removed next month.',
      type: 'error' as const,
      is_active: false,
      starts_at: null,
      ends_at: null,
      created_at: '2025-03-10T00:00:00Z',
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AnnouncementsPage />
    </MemoryRouter>,
  )
}

describe('AnnouncementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAnnouncements).mockResolvedValue(mockAnnouncements)
  })

  it('shows loading state initially', () => {
    vi.mocked(getAnnouncements).mockReturnValue(new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders announcements table with data', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Scheduled Maintenance')).toBeInTheDocument()
    })

    expect(screen.getByText('New Feature Released')).toBeInTheDocument()
    expect(screen.getByText('Deprecated API v1')).toBeInTheDocument()
  })

  it('renders page title', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Announcements')).toBeInTheDocument()
    })
  })

  it('renders type badges', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('warning')).toBeInTheDocument()
    })

    expect(screen.getByText('info')).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('New Announcement button opens dialog', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Scheduled Maintenance')).toBeInTheDocument()
    })

    const newButton = screen.getByRole('button', { name: /new announcement/i })
    await user.click(newButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/^Title/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Body/)).toBeInTheDocument()
  })

  it('edit button opens dialog with Edit title', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Scheduled Maintenance')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Announcement')).toBeInTheDocument()
    })
  })

  it('delete button opens confirm dialog', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Scheduled Maintenance')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Delete Announcement')).toBeInTheDocument()
    })

    expect(screen.getByText(/Are you sure you want to delete "Scheduled Maintenance"/)).toBeInTheDocument()
  })

  it('shows empty state when no announcements', async () => {
    vi.mocked(getAnnouncements).mockResolvedValue({ announcements: [] })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No announcements')).toBeInTheDocument()
    })
  })

  it('calls getAnnouncements on mount', () => {
    renderPage()

    expect(getAnnouncements).toHaveBeenCalledTimes(1)
  })
})
