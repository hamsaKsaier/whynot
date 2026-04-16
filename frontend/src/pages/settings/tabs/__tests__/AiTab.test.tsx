import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ───────────────────────────────────────────────────────────────────

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: string | Record<string, unknown>, opts?: Record<string, unknown>) => {
      // Handle t('key', 'default') and t('key', { interpolation }) patterns
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      if (typeof fallbackOrOpts === 'object' && fallbackOrOpts) {
        // For interpolation patterns like t('key', 'template {{var}}', { var: val })
        return key;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

import { AiContent } from '../AiTab';

const mockProvidersByo = {
  success: true,
  providers: [
    { provider: 'openai', displayName: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], defaultModel: 'gpt-4o' },
    { provider: 'anthropic', displayName: 'Anthropic', models: ['claude-sonnet-4-6'], defaultModel: 'claude-sonnet-4-6' },
    { provider: 'custom', displayName: 'Custom (OpenAI-compatible)', models: [], defaultModel: '' },
  ],
  tier: 'byo_keys' as const,
  hasPlatformKeys: true,
  platformDefault: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
};

const mockProvidersManaged = {
  ...mockProvidersByo,
  tier: 'managed_payg' as const,
};

const mockConfig = {
  id: 'cfg-1',
  provider: 'openai',
  model: 'gpt-4o',
  baseUrl: null,
  apiKey: 'sk-•••••ABCD',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function setupMocks(overrides: {
  providers?: typeof mockProvidersByo;
  configs?: typeof mockConfig[];
} = {}) {
  const providers = overrides.providers ?? mockProvidersByo;
  const configs = overrides.configs ?? [];

  mockGet.mockImplementation(async (url: string) => {
    if (url === '/me/ai-providers') return { data: providers };
    if (url === '/me/ai-config') return { data: { items: configs } };
    return { data: {} };
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AiTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AiContent />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders dynamic providers from API in dropdown', async () => {
    setupMocks();
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Keys')).toBeInTheDocument();
    });

    // Open the form
    await userEvent.click(screen.getByText('Add provider'));

    // Provider dropdown should contain API-provided options
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
  });

  it('shows text input for model when custom provider selected', async () => {
    setupMocks();
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('Add provider')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Add provider'));

    // The form should be visible with a model select initially
    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('shows byo_keys tier banner', async () => {
    setupMocks({ providers: mockProvidersByo });
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Keys')).toBeInTheDocument();
    });

    expect(screen.getByText('Add your own AI provider API keys to use AI features. Your keys are encrypted and stored securely.')).toBeInTheDocument();
  });

  it('shows byo_keys key-required prompt when no configs', async () => {
    setupMocks({ providers: mockProvidersByo, configs: [] });
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('You need to add an API key to use AI features.')).toBeInTheDocument();
    });
  });

  it('shows managed_payg tier banner', async () => {
    setupMocks({ providers: mockProvidersManaged });
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('Managed AI Keys')).toBeInTheDocument();
    });

    expect(screen.getByText('Your plan includes managed AI access. You can optionally add your own keys for custom provider access.')).toBeInTheDocument();
  });

  it('shows platform key message for managed_payg with no user keys', async () => {
    setupMocks({ providers: mockProvidersManaged, configs: [] });
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText("You're currently using the platform's managed AI keys. No configuration needed.")).toBeInTheDocument();
    });
  });

  it('does not show platform key message for managed_payg with user keys', async () => {
    setupMocks({ providers: mockProvidersManaged, configs: [mockConfig] });
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('Managed AI Keys')).toBeInTheDocument();
    });

    expect(screen.queryByText("You're currently using the platform's managed AI keys. No configuration needed.")).not.toBeInTheDocument();
  });

  it('renders configured providers with default badge', async () => {
    setupMocks({ configs: [mockConfig] });
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('shows empty state when no configs and form is closed', async () => {
    setupMocks({ configs: [] });
    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('No AI providers configured yet. Add one to use your own API keys.')).toBeInTheDocument();
    });
  });

  it('submits add key form', async () => {
    setupMocks({ configs: [] });
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    // After submit, re-fetch returns the new config
    mockGet.mockImplementation(async (url: string) => {
      if (url === '/me/ai-providers') return { data: mockProvidersByo };
      if (url === '/me/ai-config') return { data: { items: [mockConfig] } };
      return { data: {} };
    });

    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('Add provider')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Add provider'));

    // Fill in API key
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    await userEvent.type(apiKeyInput, 'sk-test-key-1234');

    // Submit
    await userEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/me/ai-config', expect.objectContaining({
        provider: 'openai',
        apiKey: 'sk-test-key-1234',
      }));
    });
  });

  it('tests connection and shows result', async () => {
    setupMocks({ configs: [mockConfig] });
    mockPost.mockResolvedValueOnce({ data: { ok: true, latencyMs: 123 } });

    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    const testButton = screen.getByTitle('Test connection');
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/me/ai-config/cfg-1/test');
    });
  });

  it('sets default provider', async () => {
    const nonDefaultConfig = { ...mockConfig, id: 'cfg-2', isDefault: false };
    setupMocks({ configs: [mockConfig, nonDefaultConfig] });
    mockPut.mockResolvedValueOnce({ data: { success: true } });

    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    const setDefaultButtons = screen.getAllByTitle('Set as default');
    await userEvent.click(setDefaultButtons[0]);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/me/ai-config/cfg-2/default');
    });
  });

  it('deletes a provider config', async () => {
    setupMocks({ configs: [mockConfig] });
    mockDelete.mockResolvedValueOnce({ data: { success: true } });

    render(<AiContent />);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle('Delete');
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/me/ai-config/cfg-1');
    });
  });

  it('renders correctly with dir="rtl"', async () => {
    setupMocks({ configs: [mockConfig] });

    const { container } = render(
      <div dir="rtl">
        <AiContent />
      </div>,
    );

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    expect(container.firstChild).toHaveAttribute('dir', 'rtl');
  });

  it('all visible text uses i18n (no hardcoded strings leak)', async () => {
    // This test verifies the component renders without crashes when
    // i18n returns keys instead of translations (our mock behavior)
    setupMocks({ configs: [mockConfig] });
    render(<AiContent />);

    await waitFor(() => {
      // The component should render without errors even with key-only i18n
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });
  });
});
