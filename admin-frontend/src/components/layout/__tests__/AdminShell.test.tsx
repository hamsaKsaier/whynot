import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminShell } from '../AdminShell';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: '1', name: 'Admin User', email: 'admin@test.com', role: 'super_admin' },
    logout: vi.fn(),
  })),
}));

vi.mock('../../ThemeProvider', () => ({
  useThemeContext: vi.fn(() => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
    toggle: vi.fn(),
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'admin.nav.title': 'Admin Panel',
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
      };
      return map[key] || key;
    },
    i18n: { resolvedLanguage: 'en', changeLanguage: vi.fn() },
  })),
}));

vi.mock('../../LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/i18n', () => ({
  SUPPORTED_LANGUAGES: ['en'],
  LANGUAGE_META: { en: { nativeName: 'English', flag: 'US', dir: 'ltr' } },
  RTL_LANGUAGES: [],
}));

function renderShell() {
  return render(
    <MemoryRouter>
      <AdminShell />
    </MemoryRouter>,
  );
}

describe('AdminShell', () => {
  it('renders the admin shell layout', () => {
    renderShell();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders skip-to-content link', () => {
    renderShell();
    expect(screen.getByText('Skip to content')).toBeInTheDocument();
  });

  it('renders user avatar with initials', () => {
    renderShell();
    expect(screen.getByText('AU')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderShell();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Plans')).toBeInTheDocument();
  });

  it('renders the version footer', () => {
    renderShell();
    expect(screen.getByText('WhyNot Admin v2.0')).toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    renderShell();
    expect(screen.getByLabelText('Toggle Theme')).toBeInTheDocument();
  });

  it('renders mobile menu button', () => {
    renderShell();
    expect(screen.getByLabelText('Open Navigation')).toBeInTheDocument();
  });

  it('renders language switcher', () => {
    renderShell();
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });
});
