import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrganizationDetailPage } from '../OrganizationDetailPage';

const stableT = (key: string, fallbackOrOpts?: any) => {
  if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock('../../services/api', () => ({
  getAdminOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  getAdminPlans: vi.fn(),
  setOrgFlagOverrideViaOrg: vi.fn(),
}));

import { getAdminOrganization, getAdminPlans } from '../../services/api';

function renderPage(id = 'org-1') {
  return render(
    <MemoryRouter initialEntries={[`/organizations/${id}`]}>
      <Routes>
        <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrganizationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    vi.mocked(getAdminOrganization).mockReturnValue(new Promise(() => {}));
    vi.mocked(getAdminPlans).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders org details after loading', async () => {
    const orgData = {
      organization: {
        id: 'org-1',
        name: 'Acme Corp',
        ownerId: 'u-1',
        ownerName: 'John',
        ownerEmail: 'john@acme.com',
        createdAt: '2025-01-15T00:00:00Z',
      },
      subscription: { id: 's-1', planId: 'p-1', planName: 'Pro', status: 'active', currentPeriodEnd: null, trialEnd: null, cancelAtPeriodEnd: false },
      credits: 500,
      members: [],
      flagOverrides: [],
      auditLog: [],
    };
    vi.mocked(getAdminOrganization).mockResolvedValue(orgData);
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [{ id: 'p-1', name: 'Pro' }] });

    renderPage();

    await waitFor(() => {
      // Name appears in breadcrumb and title
      expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
    });
    // john@acme.com appears in breadcrumb description and owner display
    expect(screen.getAllByText('john@acme.com').length).toBeGreaterThan(0);
  });

  it('renders tabs', async () => {
    vi.mocked(getAdminOrganization).mockResolvedValue({
      organization: { id: 'org-1', name: 'Test Org', ownerId: 'u-1', ownerName: null, ownerEmail: 'test@test.com', createdAt: '2025-01-01T00:00:00Z' },
      subscription: null,
      credits: 0,
      members: [],
      flagOverrides: [],
      auditLog: [],
    });
    vi.mocked(getAdminPlans).mockResolvedValue({ plans: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Overview/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: /Members/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Subscription/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Flags/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Audit/ })).toBeInTheDocument();
  });
});
