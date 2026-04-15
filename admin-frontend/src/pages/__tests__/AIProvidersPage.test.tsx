import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AIProvidersPage } from '../AIProvidersPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const map: Record<string, string> = {
        'admin.aiProviders.title': 'AI Providers',
        'admin.aiProviders.description': 'Manage providers',
        'admin.aiProviders.save': 'Save',
        'admin.aiProviders.saving': 'Saving...',
        'admin.aiProviders.saved': 'Saved',
        'admin.aiProviders.loadError': 'Failed to load',
        'admin.aiProviders.saveError': 'Failed to save',
        'admin.aiProviders.enabled': 'Enabled',
        'admin.aiProviders.disabled': 'Disabled',
        'admin.aiProviders.rateLimit': 'Rate Limit',
        'admin.aiProviders.rateLimitHint': 'Requests per minute',
        'admin.aiProviders.noProviders': 'No providers',
        'admin.aiProviders.enabledCount': `${opts?.count ?? 0} of ${opts?.total ?? 0} enabled`,
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../services/api', () => ({
  getAIProviders: vi.fn(),
  updateAIProviders: vi.fn(),
}));

import { getAIProviders } from '../../services/api';

describe('AIProvidersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(getAIProviders).mockReturnValue(new Promise(() => {}));
    render(<AIProvidersPage />);
    // Loader spinner is rendered
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders provider cards after loading', async () => {
    vi.mocked(getAIProviders).mockResolvedValue({
      providers: [
        { provider: 'openai', enabled: true, rateLimit: 60 },
        { provider: 'anthropic', enabled: false, rateLimit: 30 },
      ],
    });

    render(<AIProvidersPage />);

    await waitFor(() => {
      expect(screen.getByText('AI Providers')).toBeInTheDocument();
    });
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('shows error on load failure', async () => {
    vi.mocked(getAIProviders).mockRejectedValue(new Error('fail'));

    render(<AIProvidersPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });

  it('shows no providers message when empty', async () => {
    vi.mocked(getAIProviders).mockResolvedValue({ providers: [] });

    render(<AIProvidersPage />);

    await waitFor(() => {
      expect(screen.getByText('No providers')).toBeInTheDocument();
    });
  });

  it('shows enabled count', async () => {
    vi.mocked(getAIProviders).mockResolvedValue({
      providers: [
        { provider: 'openai', enabled: true, rateLimit: 60 },
        { provider: 'anthropic', enabled: false, rateLimit: 30 },
      ],
    });

    render(<AIProvidersPage />);

    await waitFor(() => {
      expect(screen.getByText('1 of 2 enabled')).toBeInTheDocument();
    });
  });
});
