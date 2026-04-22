import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FeatureFlagsPage } from '../FeatureFlagsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'admin.featureFlags.title': 'Feature Flags',
        'admin.featureFlags.allFlags': 'All Flags',
        'admin.featureFlags.noFlags': 'No flags',
        'admin.featureFlags.selectFlag': 'Select a flag',
        'admin.featureFlags.defaultOn': 'On',
        'admin.featureFlags.defaultOff': 'Off',
        'admin.featureFlags.orgOverrides': 'Organization Overrides',
        'admin.featureFlags.orgIdPlaceholder': 'Enter org ID',
        'admin.featureFlags.auditTrail': 'Audit Trail',
        'admin.featureFlags.noAuditEntries': 'No audit entries',
        'admin.featureFlags.flagName': 'Flag',
        'admin.featureFlags.default': 'Default',
        'admin.featureFlags.override': 'Override',
        'admin.featureFlags.actions': 'Actions',
        'admin.featureFlags.setOverride': 'Set Override',
        'admin.featureFlags.rollout': 'Rollout',
        'admin.featureFlags.loadingAudit': 'Loading...',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../services/api', () => ({
  getFeatureFlags: vi.fn(),
  getOrgFeatureFlags: vi.fn(),
  setOrgFlagOverride: vi.fn(),
  clearOrgFlagOverride: vi.fn(),
  getAuditLog: vi.fn(),
}));

import { getFeatureFlags } from '../../services/api';

describe('FeatureFlagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    vi.mocked(getFeatureFlags).mockReturnValue(new Promise(() => {}));
    const { container } = render(<FeatureFlagsPage />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders flag list after loading', async () => {
    vi.mocked(getFeatureFlags).mockResolvedValue({
      flags: [
        {
          key: 'new-ui',
          name: 'New UI',
          description: 'The new UI',
          default_enabled: true,
          rollout_percent: 100,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ],
    });

    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    });
    expect(screen.getByText('New UI')).toBeInTheDocument();
    expect(screen.getByText('new-ui')).toBeInTheDocument();
  });

  it('shows no flags message when empty', async () => {
    vi.mocked(getFeatureFlags).mockResolvedValue({ flags: [] });

    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('No flags')).toBeInTheDocument();
    });
  });

  it('shows select flag prompt when no flag selected', async () => {
    vi.mocked(getFeatureFlags).mockResolvedValue({
      flags: [
        { key: 'test', name: 'Test', description: null, default_enabled: false, rollout_percent: 0, created_at: '', updated_at: '' },
      ],
    });

    render(<FeatureFlagsPage />);

    await waitFor(() => {
      expect(screen.getByText('Select a flag')).toBeInTheDocument();
    });
  });
});
