import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserDetailPage } from '../UserDetailPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: any) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      return key;
    },
  }),
}));

vi.mock('../../services/api', () => ({
  getAdminUser: vi.fn(),
  updateUserRole: vi.fn(),
  grantCredits: vi.fn(),
  revokeCredits: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  impersonateUser: vi.fn(),
  resetUserPassword: vi.fn(),
  forceUserPlan: vi.fn(),
  getAdminPlans: vi.fn(),
  getAuditLog: vi.fn(),
  getOrgFeatureFlags: vi.fn(),
  setOrgFlagOverride: vi.fn(),
  clearOrgFlagOverride: vi.fn(),
}));

import { getAdminUser, getAdminPlans, getAuditLog, getOrgFeatureFlags } from '../../services/api';

function renderPage(id = 'user-1') {
  return render(
    <MemoryRouter initialEntries={[`/users/${id}`]}>
      <Routes>
        <Route path="/users/:id" element={<UserDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    vi.mocked(getAdminUser).mockReturnValue(new Promise(() => {}));
    vi.mocked(getAdminPlans).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders user details after loading', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@test.com',
        role: 'user',
        created_at: '2025-01-15T00:00:00Z',
        github_id: null,
        google_id: null,
        is_suspended: false,
      },
      workspaces: [],
    });
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [] });
    vi.mocked(getAuditLog).mockResolvedValue({ entries: [] });

    renderPage();

    await waitFor(() => {
      // Name appears in both the breadcrumb and the title
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
    });
    // Email appears in the description/breadcrumb
    expect(screen.getAllByText('jane@test.com').length).toBeGreaterThan(0);
  });

  it('shows not found when user is null', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({
      user: null,
      workspaces: [],
    });
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [] });
    vi.mocked(getAuditLog).mockResolvedValue({ entries: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('User not found.')).toBeInTheDocument();
    });
  });

  it('renders tabs', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Test',
        email: 'test@test.com',
        role: 'user',
        created_at: '2025-01-01',
        github_id: null,
        google_id: null,
        is_suspended: false,
      },
      workspaces: [],
    });
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [] });
    vi.mocked(getAuditLog).mockResolvedValue({ entries: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Flags')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
  });

  it('renders action buttons for non-suspended user', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Active User',
        email: 'active@test.com',
        role: 'user',
        created_at: '2025-01-01',
        github_id: null,
        google_id: null,
        is_suspended: false,
      },
      workspaces: [],
    });
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [] });
    vi.mocked(getAuditLog).mockResolvedValue({ entries: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Impersonate')).toBeInTheDocument();
    });
    expect(screen.getByText('Reset Password')).toBeInTheDocument();
    expect(screen.getByText('Ban')).toBeInTheDocument();
  });

  it('renders unban button for suspended user', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Banned User',
        email: 'banned@test.com',
        role: 'user',
        created_at: '2025-01-01',
        github_id: null,
        google_id: null,
        is_suspended: true,
      },
      workspaces: [],
    });
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [] });
    vi.mocked(getAuditLog).mockResolvedValue({ entries: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Unban')).toBeInTheDocument();
    });
  });
});
