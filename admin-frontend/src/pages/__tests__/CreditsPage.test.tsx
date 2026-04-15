import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CreditsPage } from '../CreditsPage'

vi.mock('../../services/api', () => ({
  getAdminUsers: vi.fn(),
  grantCredits: vi.fn(),
}))

import { getAdminUsers, grantCredits } from '../../services/api'

const mockUsersResponse = {
  users: [
    { id: '1', name: 'Alice', email: 'alice@test.com', workspace_name: 'Acme', workspace_id: 'ws-1', credits: 500, plan_name: 'Pro' },
    { id: '2', name: 'Bob', email: 'bob@test.com', workspace_name: 'Beta', workspace_id: 'ws-2', credits: 100, plan_name: 'Starter' },
  ],
  total: 2,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CreditsPage />
    </MemoryRouter>,
  )
}

describe('CreditsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsersResponse)
  })

  it('shows loading state initially', () => {
    vi.mocked(getAdminUsers).mockReturnValue(new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders credit table with user data', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders page title and description', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Credits' })).toBeInTheDocument()
    })

    expect(screen.getByText('Credit balances across all users')).toBeInTheDocument()
  })

  it('Grant Credits button opens the dialog', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const grantButton = screen.getByRole('button', { name: /grant credits/i })
    await user.click(grantButton)

    await waitFor(() => {
      expect(screen.getAllByText('Grant Credits').length).toBeGreaterThanOrEqual(2)
    })

    expect(screen.getByText('Grant credits to a specific workspace.')).toBeInTheDocument()
    expect(screen.getByLabelText('Workspace ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('grant dialog has cancel and grant buttons', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /grant credits/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Grant' })).toBeInTheDocument()
    })
  })

  it('shows empty state when no users', async () => {
    vi.mocked(getAdminUsers).mockResolvedValue({ users: [], total: 0 })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument()
    })
  })

  it('renders plan column in table', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument()
    })

    expect(screen.getByText('Starter')).toBeInTheDocument()
  })

  it('calls getAdminUsers on mount', () => {
    renderPage()

    expect(getAdminUsers).toHaveBeenCalledWith({ offset: 0, limit: 20 })
  })
})
