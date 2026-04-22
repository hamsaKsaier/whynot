import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../LoginPage'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    login: mockLogin,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'auth.login.title': 'Admin Login',
        'auth.login.email': 'Email',
        'auth.login.password': 'Password',
        'auth.login.submit': 'Sign In',
        'auth.login.submitting': 'Signing in...',
        'auth.login.superadminOnly': 'Super admin access only.',
        'auth.login.accessDenied': 'Access denied. Super admin required.',
        'auth.login.failed': 'Login failed.',
        'auth.login.emailPlaceholder': 'admin@example.com',
        'auth.login.passwordPlaceholder': '••••••••',
      }
      return map[key] || key
    },
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() },
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogin.mockResolvedValue(undefined)
  })

  it('renders the login form', () => {
    renderPage()
    expect(screen.getByText('Admin Login')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('renders superadmin-only notice', () => {
    renderPage()
    expect(screen.getByText('Super admin access only.')).toBeInTheDocument()
  })

  it('submits form and calls login', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'secret123')
    })
  })

  it('navigates to / on successful login', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))
    const user = userEvent.setup()

    renderPage()

    await user.type(screen.getByLabelText('Email'), 'wrong@test.com')
    await user.type(screen.getByLabelText('Password'), 'bad')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('shows access denied when superadmin_required error', async () => {
    mockLogin.mockRejectedValue(new Error('superadmin_required'))
    const user = userEvent.setup()

    renderPage()

    await user.type(screen.getByLabelText('Email'), 'user@test.com')
    await user.type(screen.getByLabelText('Password'), 'pass123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Access denied. Super admin required.')).toBeInTheDocument()
    })
  })

  it('shows loading state while submitting', async () => {
    mockLogin.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()

    renderPage()

    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
    })
  })

  it('email and password inputs are required', () => {
    renderPage()
    expect(screen.getByLabelText('Email')).toBeRequired()
    expect(screen.getByLabelText('Password')).toBeRequired()
  })

  it('shows fallback error message when error has no message', async () => {
    mockLogin.mockRejectedValue(new Error())
    const user = userEvent.setup()

    renderPage()

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Password'), 'pass')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Login failed.')).toBeInTheDocument()
    })
  })

  it('has responsive padding on wrapper', () => {
    renderPage()
    const wrapper = document.querySelector('.min-h-screen')
    expect(wrapper?.className).toContain('p-4')
    expect(wrapper?.className).toContain('sm:p-6')
    expect(wrapper?.className).toContain('md:p-8')
  })

  it('card has max-width constraint for centered layout', () => {
    renderPage()
    const card = screen.getByText('Admin Login').closest('[class*="max-w-md"]')
    expect(card).toBeTruthy()
  })

  it('submit button is full-width on mobile, auto on larger', () => {
    renderPage()
    const btn = screen.getByRole('button', { name: 'Sign In' })
    expect(btn.className).toContain('w-full')
    expect(btn.className).toContain('sm:w-auto')
  })

  it('email input has mobile keyboard hints', () => {
    renderPage()
    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toHaveAttribute('inputMode', 'email')
    expect(emailInput).toHaveAttribute('enterKeyHint', 'next')
  })

  it('password input has done enter key hint', () => {
    renderPage()
    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveAttribute('enterKeyHint', 'done')
  })
})
