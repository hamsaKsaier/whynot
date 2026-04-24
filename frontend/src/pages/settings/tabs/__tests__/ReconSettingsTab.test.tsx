import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ───────────────────────────────────────────────────────────────────

const { mockGet, mockPut, mockUseFeatureFlag, mockToastSuccess, mockToastError, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockUseFeatureFlag: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({
  apiClient: {
    get: mockGet,
    put: mockPut,
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => mockUseFeatureFlag(key),
}));

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub out sibling settings tabs to keep the SettingsPage harness shallow.
vi.mock('../ProfileTab', () => ({ ProfileTab: () => <div>Profile Information</div> }));
vi.mock('../OrganizationTab', () => ({ OrganizationTab: () => <div>org-tab</div> }));
vi.mock('../BillingTab', () => ({ BillingTab: () => <div>billing-tab</div> }));
vi.mock('../AiTab', () => ({ AiContent: () => <div>ai-tab</div> }));
vi.mock('../ApiKeysTab', () => ({ ApiKeysTab: () => <div>api-keys-tab</div> }));
vi.mock('../LanguageTab', () => ({ LanguageTab: () => <div>language-tab</div> }));
vi.mock('../NotificationsTab', () => ({ NotificationsTab: () => <div>notifications-tab</div> }));
vi.mock('../DangerZoneTab', () => ({ DangerZoneTab: () => <div>danger-tab</div> }));
vi.mock('../UsageTab', () => ({ UsageTab: () => <div>usage-tab</div> }));
vi.mock('../../../EnvironmentsPage', () => ({ EnvironmentsContent: () => <div>environments</div> }));
vi.mock('../../../IntegrationsPage', () => ({ IntegrationsContent: () => <div>integrations</div> }));
vi.mock('../../../GitHubReposPage', () => ({ GitHubReposContent: () => <div>github-repos</div> }));
vi.mock('../../../WebhookManagementPage', () => ({ WebhookContent: () => <div>webhook</div> }));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, optsOrFallback?: string | Record<string, unknown>) => {
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (typeof optsOrFallback === 'object' && optsOrFallback && 'defaultValue' in optsOrFallback) {
        return String((optsOrFallback as { defaultValue: string }).defaultValue);
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { ReconSettingsTab } from '../ReconSettingsTab';
import { SettingsPage } from '../../../SettingsPage';
import { BrowserRouter } from 'react-router-dom';

// ── Helpers ─────────────────────────────────────────────────────────────────

const mockMembers = [
  { id: 'mem-1', userId: 'u-1', name: 'Alice', email: 'alice@example.com' },
  { id: 'mem-2', userId: 'u-2', name: 'Bob', email: 'bob@example.com' },
];

const defaultSettings = {
  workspaceId: 'ws-1',
  notifyRecipientUserIds: [] as string[],
  emailOnComplete: true,
  emailOnFail: true,
  paygCapCredits: 0,
};

function setupMocks(overrides: Partial<typeof defaultSettings> = {}) {
  const settings = { ...defaultSettings, ...overrides };
  mockGet.mockImplementation(async (url: string) => {
    if (url === '/recon/settings') return { data: { success: true, settings } };
    if (url === '/me/organization/members') return { data: { members: mockMembers } };
    return { data: {} };
  });
  return settings;
}

function renderInRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ReconSettingsTab — visibility & URL sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u-1', email: 'me@example.com' } });
    mockUseFeatureFlag.mockReturnValue(true);
    setupMocks();
    window.history.replaceState({}, '', '/');
  });

  it('hides the Recon tab when the feature flag is off', async () => {
    mockUseFeatureFlag.mockReturnValue(false);
    renderInRouter(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Profile/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('tab', { name: /Recon/ })).not.toBeInTheDocument();
  });

  it('shows and selects the Recon tab when the flag is on', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    renderInRouter(<SettingsPage />);
    const reconTab = await screen.findByRole('tab', { name: /Recon/ });
    await userEvent.click(reconTab);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Max credits per scan' })).toBeInTheDocument(),
    );
  });

  it('syncs ?tab=recon in the URL when the tab is selected', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    renderInRouter(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Recon')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Recon'));
    await waitFor(() => {
      expect(window.location.search).toContain('tab=recon');
    });
  });

  it('falls back to profile when ?tab=recon but flag is off', async () => {
    mockUseFeatureFlag.mockReturnValue(false);
    window.history.replaceState({}, '', '/?tab=recon');
    renderInRouter(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Profile Information')).toBeInTheDocument();
    });
  });
});

describe('ReconSettingsTab — behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u-1', email: 'me@example.com' } });
    mockUseFeatureFlag.mockReturnValue(true);
    setupMocks();
  });

  it('loads initial settings and members', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/recon/settings');
      expect(mockGet).toHaveBeenCalledWith('/me/organization/members');
    });
    expect(screen.getByText('No recipients selected')).toBeInTheDocument();
  });

  it('round-trips an empty recipient selection', async () => {
    setupMocks({ notifyRecipientUserIds: [] });
    mockPut.mockResolvedValueOnce({
      data: { success: true, settings: { ...defaultSettings, notifyRecipientUserIds: [] } },
    });
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByText('No recipients selected')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/recon/settings',
        expect.objectContaining({ notify_recipient_user_ids: [] }),
      );
    });
  });

  it('adds and removes a recipient chip', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByText('No recipients selected')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Add recipient' }));
    await userEvent.click(screen.getByText('alice@example.com'));

    const list = screen.getByTestId('recon-recipients-list');
    await waitFor(() => {
      expect(within(list).getByText('alice@example.com')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove alice@example.com' }));
    await waitFor(() => {
      expect(screen.getByText('No recipients selected')).toBeInTheDocument();
    });
  });

  it('rejects a negative PAYG cap value', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByLabelText('Max credits per scan')).toBeInTheDocument());
    const input = screen.getByLabelText('Max credits per scan') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '-5');
    expect(screen.getByText('Cap must be 0 or greater')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('rejects a PAYG cap value over 100,000', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByLabelText('Max credits per scan')).toBeInTheDocument());
    const input = screen.getByLabelText('Max credits per scan') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '200000');
    expect(screen.getByText('Cap must be 100,000 or less')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('calls the API with a normalized payload on save', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByLabelText('Max credits per scan')).toBeInTheDocument());
    const input = screen.getByLabelText('Max credits per scan') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '5000');

    mockPut.mockResolvedValueOnce({
      data: {
        success: true,
        settings: { ...defaultSettings, paygCapCredits: 5000 },
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/recon/settings', {
        notify_recipient_user_ids: [],
        email_on_complete: true,
        email_on_fail: true,
        payg_cap_credits: 5000,
      });
    });
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
  });

  it('shows error toast on save failure', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByLabelText('Max credits per scan')).toBeInTheDocument());
    mockPut.mockRejectedValueOnce(new Error('boom'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });

  it('renders the "Coming soon" schedule row as disabled', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeInTheDocument());
    const row = screen.getByTestId('recon-schedule-coming-soon');
    expect(row).toHaveAttribute('aria-disabled', 'true');
    const switches = row.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(1);
    expect(switches[0]).toBeDisabled();
  });

  it('does not apply min-h-[44px] or min-w-[44px] directly to Switch components', async () => {
    const { container } = render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByText('Email me on every scan completion')).toBeInTheDocument());
    const switches = container.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBeGreaterThan(0);
    switches.forEach((el) => {
      const cls = el.className ?? '';
      expect(cls).not.toMatch(/\bmin-h-\[44px\]/);
      expect(cls).not.toMatch(/\bmin-w-\[44px\]/);
    });
  });

  it('toggles email-on-complete switch without the 44px hack', async () => {
    render(<ReconSettingsTab />);
    await waitFor(() => expect(screen.getByText('Email me on every scan completion')).toBeInTheDocument());
    const sw = screen.getByLabelText('Email me on every scan completion');
    expect(sw).toBeInTheDocument();
    await userEvent.click(sw);
  });

  it('renders correctly with dir="rtl" (en snapshot)', async () => {
    const { container } = render(
      <div dir="ltr">
        <ReconSettingsTab />
      </div>,
    );
    await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument());
    expect(container.firstChild).toMatchSnapshot('recon-settings-en');
  });

  it('renders correctly with dir="rtl" (ar snapshot)', async () => {
    const { container } = render(
      <div dir="rtl">
        <ReconSettingsTab />
      </div>,
    );
    await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument());
    expect(container.firstChild).toHaveAttribute('dir', 'rtl');
    expect(container.firstChild).toMatchSnapshot('recon-settings-ar');
  });
});
