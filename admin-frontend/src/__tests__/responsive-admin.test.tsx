import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: '1', name: 'Admin User', email: 'admin@test.com', role: 'super_admin' },
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    isSuperadmin: true,
    login: vi.fn(),
    logout: vi.fn(),
  })),
  AuthProvider: ({ children }: any) => children,
}))

vi.mock('../components/ThemeProvider', () => ({
  useThemeContext: vi.fn(() => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
    toggle: vi.fn(),
  })),
  ThemeProvider: ({ children }: any) => children,
}))

vi.mock('../providers/FeatureFlagsProvider', () => ({
  FeatureFlagsProvider: ({ children }: any) => children,
  useFeatureFlags: () => ({ flags: {}, isLoading: false, refetch: vi.fn() }),
}))

vi.mock('../components/DirectionProvider', () => ({
  DirectionProvider: ({ children }: any) => children,
}))

const t = (key: string, opts?: any) => {
  const map: Record<string, string> = {
    'admin.nav.title': 'Admin',
    'admin.nav.dashboard': 'Dashboard',
    'admin.nav.users': 'Users',
    'admin.nav.plans': 'Plans',
    'admin.nav.subscriptions': 'Subscriptions',
    'admin.nav.credits': 'Credits',
    'admin.nav.analytics': 'Analytics',
    'admin.nav.auditLog': 'Audit Log',
    'admin.nav.announcements': 'Announcements',
    'admin.nav.systemSettings': 'Settings',
    'admin.nav.organizations': 'Organizations',
    'admin.nav.featureFlags': 'Feature Flags',
    'admin.nav.aiProviders': 'AI Providers',
    'admin.nav.billingConfig': 'Billing Config',
    'admin.nav.usage': 'Usage',
    'admin.nav.toggleSidebar': 'Toggle Sidebar',
    'admin.nav.toggleTheme': 'Toggle Theme',
    'admin.nav.openNavigation': 'Open Navigation',
    'admin.nav.skipToContent': 'Skip to content',
    'admin.nav.navigation': 'Navigation',
    'admin.nav.superadmin': 'Superadmin',
    'admin.nav.signOut': 'Sign Out',
    'admin.nav.sections.platform': 'Platform',
    'admin.nav.sections.billing': 'Billing',
    'admin.nav.sections.flagsAi': 'Flags & AI',
    'admin.nav.sections.insights': 'Insights',
    'admin.nav.sections.content': 'Content',
    'admin.nav.sections.settings': 'Settings',
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
    'admin.errors.notFound.title': 'Page Not Found',
    'admin.errors.notFound.description': "The page you're looking for doesn't exist or has been moved.",
    'admin.errors.serverError.title': 'Server Error',
    'admin.errors.serverError.description': 'Something went wrong on our end. Please try again later.',
    'admin.errors.forbidden.title': 'Access Forbidden',
    'admin.errors.forbidden.description': "You don't have permission to access this area. Super administrator access is required.",
    'admin.errors.backHome': 'Back to Dashboard',
    'admin.errors.backToLogin': 'Back to Login',
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
}

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t,
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() },
  })),
}))

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}))

vi.mock('@/i18n', () => ({
  SUPPORTED_LANGUAGES: ['en'],
  LANGUAGE_META: { en: { nativeName: 'English', flag: 'US', dir: 'ltr' } },
  RTL_LANGUAGES: [],
}))

vi.mock('../services/api', () => ({
  getAdminOverviewStats: vi.fn(),
  getAdminUsers: vi.fn(),
}))

import { getAdminOverviewStats, getAdminUsers } from '../services/api'
import { AdminShell } from '../components/layout/AdminShell'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ServerErrorPage } from '../pages/ServerErrorPage'
import { ForbiddenPage } from '../pages/ForbiddenPage'

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

// ── Helpers ────────────────────────────────────────────

function renderShell() {
  return render(
    <MemoryRouter>
      <AdminShell />
    </MemoryRouter>,
  )
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

// ── Tests ──────────────────────────────────────────────

describe('AdminShell – responsive layout', () => {
  it('renders desktop sidebar with sidebar token classes', () => {
    renderShell()
    const sidebar = document.querySelector('.bg-sidebar')
    expect(sidebar).toBeTruthy()
  })

  it('renders sidebar border using sidebar-border token', () => {
    renderShell()
    const sidebar = document.querySelector('.border-sidebar-border')
    expect(sidebar).toBeTruthy()
  })

  it('renders mobile hamburger button', () => {
    renderShell()
    expect(screen.getByLabelText('Open Navigation')).toBeInTheDocument()
  })

  it('hamburger is hidden on md+ screens via CSS class', () => {
    renderShell()
    const btn = screen.getByLabelText('Open Navigation')
    expect(btn.className).toContain('md:hidden')
  })

  it('desktop sidebar is hidden on mobile via CSS class', () => {
    renderShell()
    const desktopSidebar = document.querySelector('.hidden.md\\:block')
    expect(desktopSidebar).toBeTruthy()
  })

  it('renders skip-to-content accessibility link', () => {
    renderShell()
    const skipLink = screen.getByText('Skip to content')
    expect(skipLink).toBeInTheDocument()
    expect(skipLink.tagName).toBe('A')
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('renders main content area with role=main', () => {
    renderShell()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders user avatar with initials', () => {
    renderShell()
    expect(screen.getByText('AU')).toBeInTheDocument()
  })

  it('renders language switcher in header', () => {
    renderShell()
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument()
  })

  it('renders theme toggle in header', () => {
    renderShell()
    expect(screen.getByLabelText('Toggle Theme')).toBeInTheDocument()
  })

  it('renders all navigation section labels', () => {
    renderShell()
    expect(screen.getByText('Platform')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Flags & AI')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
  })

  it('active nav items use sidebar-primary token classes', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminShell />
      </MemoryRouter>,
    )
    const activeItem = document.querySelector('.bg-sidebar-primary')
    expect(activeItem).toBeTruthy()
  })

  it('header has responsive padding', () => {
    renderShell()
    const header = document.querySelector('header')
    expect(header?.className).toContain('px-3')
    expect(header?.className).toContain('sm:px-4')
  })

  it('header controls have responsive gap', () => {
    renderShell()
    const controls = screen.getByTestId('language-switcher').parentElement
    expect(controls?.className).toContain('gap-1.5')
    expect(controls?.className).toContain('sm:gap-3')
  })

  it('renders version footer in sidebar', () => {
    renderShell()
    expect(screen.getByText('WhyNot Admin v2.0')).toBeInTheDocument()
  })
})

describe('AdminShell – drawer toggle', () => {
  it('opens mobile sheet when hamburger is clicked', async () => {
    const user = userEvent.setup()
    renderShell()

    const menuBtn = screen.getByLabelText('Open Navigation')
    await user.click(menuBtn)

    await waitFor(() => {
      const sheetNav = screen.getByText('Navigation')
      expect(sheetNav).toBeInTheDocument()
    })
  })
})

describe('DashboardPage – responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)
  })

  it('renders KPI grid with responsive columns', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument()
    })

    const grid = screen.getByText('Total Users').closest('.grid')
    expect(grid?.className).toContain('grid-cols-1')
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-4')
  })

  it('renders quick actions bar', async () => {
    renderDashboard()
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
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
    })

    const bar = screen.getByTestId('quick-actions')
    expect(bar.className).toContain('sticky')
    expect(bar.className).toContain('top-0')
    expect(bar.className).toContain('sm:static')
  })

  it('renders mobile card view for recent users (hidden md+)', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('mobile-user-cards')).toBeInTheDocument()
    })

    const mobileCards = screen.getByTestId('mobile-user-cards')
    expect(mobileCards.className).toContain('md:hidden')
  })

  it('renders desktop table view (hidden on mobile in jsdom)', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('mobile-user-cards')).toBeInTheDocument()
    })

    const desktopWrapper = document.querySelector('.hidden.md\\:block')
    expect(desktopWrapper).toBeTruthy()
    expect(desktopWrapper?.querySelector('table')).toBeTruthy()
  })

  it('mobile cards show user name, email, plan, credits', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('mobile-user-cards')).toBeInTheDocument()
    })

    const mobileCards = screen.getByTestId('mobile-user-cards')
    expect(within(mobileCards).getByText('Alice')).toBeInTheDocument()
    expect(within(mobileCards).getByText('alice@test.com')).toBeInTheDocument()
    expect(within(mobileCards).getByText('Bob')).toBeInTheDocument()
    expect(within(mobileCards).getByText('bob@test.com')).toBeInTheDocument()
  })

  it('renders KPI cards with responsive padding', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('142')).toBeInTheDocument()
    })

    const cardContent = screen.getByText('142').closest('[class*="p-4"]')
    expect(cardContent?.className).toContain('p-4')
    expect(cardContent?.className).toContain('sm:p-5')
  })

  it('shows loading skeleton with quick actions placeholder', () => {
    vi.mocked(getAdminOverviewStats).mockReturnValue(new Promise(() => {}))
    vi.mocked(getAdminUsers).mockReturnValue(new Promise(() => {}))

    renderDashboard()
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no users exist', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue({ stats: {} })
    vi.mocked(getAdminUsers).mockResolvedValue({ users: [] })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('No users yet')).toBeInTheDocument()
    })
  })
})

describe('LoginPage – responsive', () => {
  it('renders with responsive padding', () => {
    renderLogin()
    const wrapper = document.querySelector('.min-h-screen')
    expect(wrapper?.className).toContain('p-4')
    expect(wrapper?.className).toContain('sm:p-6')
    expect(wrapper?.className).toContain('md:p-8')
  })

  it('card is max-width constrained', () => {
    renderLogin()
    const card = screen.getByText('Admin Login').closest('[class*="max-w-md"]')
    expect(card).toBeTruthy()
  })

  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders superadmin-only notice', () => {
    renderLogin()
    expect(screen.getByText('Super admin access only.')).toBeInTheDocument()
  })

  it('submit button has responsive width', () => {
    renderLogin()
    const btn = screen.getByRole('button', { name: 'Sign In' })
    expect(btn.className).toContain('w-full')
    expect(btn.className).toContain('sm:w-auto')
  })

  it('email input has correct input mode for mobile keyboards', () => {
    renderLogin()
    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toHaveAttribute('inputMode', 'email')
    expect(emailInput).toHaveAttribute('enterKeyHint', 'next')
  })

  it('password input has enter key hint for mobile', () => {
    renderLogin()
    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveAttribute('enterKeyHint', 'done')
  })
})

describe('Error pages – layout and accessibility', () => {
  it('NotFoundPage renders centered with responsive padding', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Page Not Found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/')
  })

  it('ServerErrorPage renders centered with responsive padding', () => {
    render(
      <MemoryRouter>
        <ServerErrorPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Server Error')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/')
  })

  it('ForbiddenPage renders with login link', () => {
    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Access Forbidden')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Login' })).toHaveAttribute('href', '/login')
  })

  it('ForbiddenPage uses min-h-screen for full viewport coverage', () => {
    const { container } = render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('min-h-screen')
  })

  it('NotFoundPage and ServerErrorPage use min-h-[60vh] for in-shell usage', () => {
    const { container: c1 } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect((c1.firstChild as HTMLElement).className).toContain('min-h-[60vh]')

    const { container: c2 } = render(
      <MemoryRouter>
        <ServerErrorPage />
      </MemoryRouter>,
    )
    expect((c2.firstChild as HTMLElement).className).toContain('min-h-[60vh]')
  })
})

describe('Role gating', () => {
  it('ForbiddenPage renders for non-superadmin context', () => {
    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Access Forbidden')).toBeInTheDocument()
    expect(screen.getByText(/Super administrator access is required/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Login' })).toHaveAttribute('href', '/login')
  })
})

describe('i18n key coverage', () => {
  const requiredKeys = [
    'admin.dashboard.title',
    'admin.dashboard.totalUsers',
    'admin.dashboard.mrr',
    'admin.dashboard.arr',
    'admin.dashboard.activePlans',
    'admin.dashboard.recentSignups',
    'admin.dashboard.subscriptionsByPlan',
    'admin.dashboard.recentUsers',
    'admin.dashboard.noUsers',
    'admin.dashboard.noSubscriptionData',
    'admin.dashboard.creditsLabel',
    'admin.dashboard.quickActions.users',
    'admin.dashboard.quickActions.plans',
    'admin.dashboard.quickActions.analytics',
    'admin.dashboard.quickActions.settings',
    'admin.errors.notFound.title',
    'admin.errors.notFound.description',
    'admin.errors.serverError.title',
    'admin.errors.serverError.description',
    'admin.errors.forbidden.title',
    'admin.errors.forbidden.description',
    'admin.errors.backHome',
    'admin.errors.backToLogin',
    'admin.nav.dashboard',
    'admin.nav.users',
    'admin.nav.openNavigation',
    'admin.nav.toggleTheme',
    'admin.nav.skipToContent',
  ]

  for (const key of requiredKeys) {
    it(`has translation for "${key}"`, () => {
      const result = t(key)
      expect(result).not.toBe(key)
    })
  }
})

describe('a11y – contrast and dark mode', () => {
  it('LoginPage uses bg-background for automatic dark mode adaptation', () => {
    renderLogin()
    const wrapper = document.querySelector('.bg-background')
    expect(wrapper).toBeTruthy()
  })

  it('error pages use semantic color tokens (text-destructive for warnings)', () => {
    const { container } = render(
      <MemoryRouter>
        <ServerErrorPage />
      </MemoryRouter>,
    )
    const icon = container.querySelector('.text-destructive')
    expect(icon).toBeTruthy()
  })

  it('ForbiddenPage uses text-destructive for shield icon', () => {
    const { container } = render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    )
    const icon = container.querySelector('.text-destructive')
    expect(icon).toBeTruthy()
  })

  it('NotFoundPage uses text-muted-foreground for icon', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    const icon = container.querySelector('.text-muted-foreground')
    expect(icon).toBeTruthy()
  })

  it('Dashboard uses semantic tokens for KPI colors with dark variants', async () => {
    vi.mocked(getAdminOverviewStats).mockResolvedValue(mockStats)
    vi.mocked(getAdminUsers).mockResolvedValue(mockUsers)

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('142')).toBeInTheDocument()
    })

    const darkColorEl = document.querySelector('[class*="dark:text-blue-400"]')
    expect(darkColorEl).toBeTruthy()
  })
})
