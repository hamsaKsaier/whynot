import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UsersPage } from '../UsersPage'

vi.mock('../../services/api', () => ({
  getAdminUsers: vi.fn(),
}))

import { getAdminUsers } from '../../services/api'

const mockUsersResponse = {
  users: [
    { id: '1', name: 'Alice Admin', email: 'alice@test.com', role: 'admin', plan_name: 'Pro', credits: 500, created_at: '2025-01-15T00:00:00Z' },
    { id: '2', name: 'Bob User', email: 'bob@test.com', role: 'user', plan_name: 'Starter', credits: 100, created_at: '2025-02-10T00:00:00Z' },
    { id: '3', name: 'Charlie Super', email: 'charlie@test.com', role: 'super_admin', plan_name: 'Enterprise', credits: 9999, created_at: '2025-03-01T00:00:00Z' },
  ],
  total: 3,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <UsersPage />
    </MemoryRouter>,
  )
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsersResponse)
  })

  it('shows loading state initially', () => {
    vi.mocked(getAdminUsers).mockReturnValue(new Promise(() => {}))
    renderPage()

    // PaginatedTable renders skeleton rows when loading
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders user rows after loading', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    })

    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('Bob User')).toBeInTheDocument()
    expect(screen.getByText('bob@test.com')).toBeInTheDocument()
    expect(screen.getByText('Charlie Super')).toBeInTheDocument()
  })

  it('renders the page title and user count', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument()
    })

    expect(screen.getByText('3 total users')).toBeInTheDocument()
  })

  it('search input triggers API call with search parameter', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search by name or email...')
    expect(searchInput).toBeInTheDocument()

    await user.type(searchInput, 'alice')

    await waitFor(() => {
      expect(getAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice', offset: 0 }),
      )
    })
  })

  it('renders pagination buttons', async () => {
    vi.mocked(getAdminUsers).mockResolvedValue({ users: mockUsersResponse.users, total: 50 })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
  })

  it('shows empty state when no users match', async () => {
    vi.mocked(getAdminUsers).mockResolvedValue({ users: [], total: 0 })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument()
    })
  })

  it('calls getAdminUsers on mount with default params', () => {
    renderPage()

    expect(getAdminUsers).toHaveBeenCalledWith({
      offset: 0,
      limit: 20,
      search: undefined,
      role: undefined,
    })
  })
})
