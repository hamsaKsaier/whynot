import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SystemSettingsPage } from '../SystemSettingsPage'

vi.mock('../../services/api', () => ({
  getSystemSettings: vi.fn(),
  updateSystemSetting: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'settings.title': 'System Settings',
        'settings.tabs.general': 'General',
        'settings.tabs.credits': 'Credit Costs',
        'settings.tabs.email': 'Email',
        'settings.tabs.webhooks': 'Webhooks',
        'settings.tabs.security': 'Security',
        'settings.noSettings': 'No settings in this category.',
        'settings.save': 'Save',
        'settings.saveFailed': 'Failed to save',
        'settings.saveSuccess': 'Settings saved',
      }
      return map[key] || key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

import { getSystemSettings, updateSystemSetting } from '../../services/api'

const mockSettings = {
  settings: [
    { key: 'app.name', value: 'WhyNot', description: 'Application name' },
    { key: 'app.url', value: 'https://whynot.app', description: 'Public URL' },
    { key: 'credit_cost.gpt4', value: '10', description: 'Credits per GPT-4 call' },
    { key: 'credit_cost.claude', value: '8', description: 'Credits per Claude call' },
    { key: 'email.from', value: 'noreply@whynot.app', description: 'From email address' },
    { key: 'security.max_login_attempts', value: '5', description: 'Max login attempts' },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SystemSettingsPage />
    </MemoryRouter>,
  )
}

describe('SystemSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSystemSettings).mockResolvedValue(mockSettings)
  })

  it('shows loading skeletons while fetching', () => {
    vi.mocked(getSystemSettings).mockReturnValue(new Promise(() => {}))
    renderPage()

    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders page title', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('System Settings')).toBeInTheDocument()
    })
  })

  it('renders tabs for setting categories', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('System Settings')).toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Credit Costs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Webhooks' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument()
  })

  it('shows general settings by default', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('app.name')).toBeInTheDocument()
    })

    expect(screen.getByText('Application name')).toBeInTheDocument()
    expect(screen.getByText('app.url')).toBeInTheDocument()
  })

  it('switches to Credit Costs tab', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('System Settings')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Credit Costs' }))

    await waitFor(() => {
      expect(screen.getByText('credit_cost.gpt4')).toBeInTheDocument()
    })

    expect(screen.getByText('credit_cost.claude')).toBeInTheDocument()
  })

  it('renders save buttons for each setting', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('app.name')).toBeInTheDocument()
    })

    const saveButtons = screen.getAllByTitle('Save')
    expect(saveButtons.length).toBeGreaterThan(0)
  })

  it('renders input fields with current values', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('app.name')).toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('textbox')
    const values = inputs.map((input) => (input as HTMLInputElement).value)
    expect(values).toContain('WhyNot')
    expect(values).toContain('https://whynot.app')
  })

  it('shows empty category message for webhooks (no webhook settings)', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('System Settings')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Webhooks' }))

    await waitFor(() => {
      expect(screen.getByText('No settings in this category.')).toBeInTheDocument()
    })
  })

  it('calls getSystemSettings on mount', () => {
    renderPage()

    expect(getSystemSettings).toHaveBeenCalledTimes(1)
  })
})
