import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationsPage } from '../OrganizationsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: any, opts?: any) => {
      // Handle both t(key, fallback) and t(key, fallback, opts)
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      return key;
    },
  }),
}));

vi.mock('../../services/api', () => ({
  getAdminOrganizations: vi.fn(),
}));

import { getAdminOrganizations } from '../../services/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <OrganizationsPage />
    </MemoryRouter>,
  );
}

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(getAdminOrganizations).mockReturnValue(new Promise(() => {}));
    renderPage();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders organizations table after loading', async () => {
    vi.mocked(getAdminOrganizations).mockResolvedValue({
      organizations: [
        {
          id: 'org-1',
          name: 'Acme Corp',
          ownerId: 'u-1',
          ownerName: 'John',
          ownerEmail: 'john@acme.com',
          planName: 'Pro',
          status: 'active',
          credits: 500,
          memberCount: 5,
          createdAt: '2025-01-15T00:00:00Z',
        },
      ],
      total: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('shows empty message when no orgs found', async () => {
    vi.mocked(getAdminOrganizations).mockResolvedValue({
      organizations: [],
      total: 0,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No organizations found')).toBeInTheDocument();
    });
  });

  it('calls API on mount', () => {
    vi.mocked(getAdminOrganizations).mockResolvedValue({
      organizations: [],
      total: 0,
    });

    renderPage();

    expect(getAdminOrganizations).toHaveBeenCalledTimes(1);
  });
});
