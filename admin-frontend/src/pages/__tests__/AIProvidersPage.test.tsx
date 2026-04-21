import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIProvidersPage } from '../AIProvidersPage';

const stableT = (key: string, opts?: any) => {
  const map: Record<string, string> = {
        'admin.aiProviders.title': 'AI Providers',
        'admin.aiProviders.description': 'Manage providers',
        'admin.aiProviders.save': 'Save Changes',
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
        'admin.aiProviders.apiKey': 'API Key',
        'admin.aiProviders.apiKeyPlaceholder': 'sk-...',
        'admin.aiProviders.saveKey': 'Save Key',
        'admin.aiProviders.rotateKey': 'Rotate',
        'admin.aiProviders.removeKey': 'Remove Key',
        'admin.aiProviders.confirmRemoveKey': `Are you sure you want to remove the API key for ${opts?.provider ?? ''}?`,
        'admin.aiProviders.keyConfigured': 'Key configured',
        'admin.aiProviders.keyNotConfigured': 'Not configured',
        'admin.aiProviders.testConnection': 'Test',
        'admin.aiProviders.testFallback': 'Test Fallback',
        'admin.aiProviders.testSuccess': `Connected (${opts?.ms ?? 0}ms)`,
        'admin.aiProviders.testFailure': `Failed: ${opts?.error ?? ''}`,
        'admin.aiProviders.fallbackKey': 'Fallback API Key',
        'admin.aiProviders.fallbackKeyHint': 'Optional backup key',
        'admin.aiProviders.optional': 'optional',
        'admin.aiProviders.defaultModel': 'Default AI Model',
        'admin.aiProviders.defaultModelDesc': 'Default provider and model',
        'admin.aiProviders.provider': 'Provider',
        'admin.aiProviders.model': 'Model',
        'admin.aiProviders.fallbackOrder': 'Fallback Order',
        'admin.aiProviders.fallbackOrderDesc': 'System tries providers in this order',
        'admin.aiProviders.saveFallbackOrder': 'Save Order',
        'admin.aiProviders.keySaved': 'API key saved successfully',
        'admin.aiProviders.keyRemoved': 'API key removed',
        'admin.aiProviders.noActiveProviders': 'No active providers',
        'admin.aiProviders.cancel': 'Cancel',
        'admin.aiProviders.providerDesc.openai': '',
        'admin.aiProviders.providerDesc.anthropic': '',
        'admin.aiProviders.providerDesc.google': '',
        'admin.aiProviders.providerDesc.openrouter': '',
        'admin.ai.recon.title': 'Recon Model Overrides',
        'admin.ai.recon.description': 'Recon model override description',
        'admin.ai.recon.placeholder': 'Inherit platform default',
        'admin.ai.recon.small.label': 'Recon — Small Model (optional override)',
        'admin.ai.recon.small.help': 'Leave blank to inherit platform default',
        'admin.ai.recon.medium.label': 'Recon — Medium Model (optional override)',
        'admin.ai.recon.medium.help': 'Leave blank to inherit platform default',
        'admin.ai.recon.large.label': 'Recon — Large Model (optional override)',
        'admin.ai.recon.large.help': 'Leave blank to inherit platform default',
  };
  return map[key] || key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock('../../services/api', () => ({
  getAIProviders: vi.fn(),
  updateAIProviders: vi.fn(),
  setProviderKey: vi.fn(),
  removeProviderKey: vi.fn(),
  setProviderFallbackKey: vi.fn(),
  removeProviderFallbackKey: vi.fn(),
  testProviderKey: vi.fn(),
  setDefaultModel: vi.fn(),
  setFallbackOrder: vi.fn(),
  setReconModels: vi.fn(),
}));

import {
  getAIProviders, updateAIProviders, setProviderKey, removeProviderKey,
  setProviderFallbackKey, removeProviderFallbackKey, testProviderKey,
  setDefaultModel, setFallbackOrder as saveFallbackOrderApi,
  setReconModels,
} from '../../services/api';

const mockConfig = {
  providers: [
    {
      provider: 'openai', displayName: 'OpenAI', enabled: true, rateLimit: 60,
      hasKey: true, hasFallbackKey: false, maskedKey: 'sk-•••••abc1',
      maskedFallbackKey: null, defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini'],
    },
    {
      provider: 'anthropic', displayName: 'Anthropic', enabled: false, rateLimit: 30,
      hasKey: false, hasFallbackKey: false, maskedKey: null,
      maskedFallbackKey: null, defaultModel: 'claude-sonnet-4-6', models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    },
    {
      provider: 'google', displayName: 'Google AI', enabled: true, rateLimit: 0,
      hasKey: true, hasFallbackKey: true, maskedKey: 'AI-•••••xyz9',
      maskedFallbackKey: 'AI-•••••fb01', defaultModel: 'gemini-pro', models: ['gemini-pro'],
    },
    {
      provider: 'openrouter', displayName: 'OpenRouter', enabled: false, rateLimit: 0,
      hasKey: false, hasFallbackKey: false, maskedKey: null,
      maskedFallbackKey: null, defaultModel: '', models: [],
    },
  ],
  defaultProvider: { provider: 'openai', model: 'gpt-4o' },
  fallbackOrder: ['openai', 'anthropic', 'google', 'openrouter'],
};

/** Wait for page to finish loading */
async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getByText('AI Providers')).toBeInTheDocument();
  });
}

describe('AIProvidersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(getAIProviders).mockReturnValue(new Promise(() => {}));
    render(<AIProvidersPage />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows error on load failure', async () => {
    vi.mocked(getAIProviders).mockRejectedValue(new Error('fail'));
    render(<AIProvidersPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });

  it('renders all 4 provider cards after loading', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    // Provider names appear in both cards and fallback order, so use getAllByText
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Google AI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('OpenRouter').length).toBeGreaterThanOrEqual(1);
  });

  it('shows enabled count', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    expect(screen.getByText('2 of 4 enabled')).toBeInTheDocument();
  });

  it('shows "Key configured" badge when provider has key', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    // OpenAI and Google have keys
    expect(screen.getAllByText('Key configured').length).toBe(2);
  });

  it('shows "Not configured" badge when provider has no key', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    // Anthropic and OpenRouter have no keys
    expect(screen.getAllByText('Not configured').length).toBe(2);
  });

  it('shows masked key when provider has key configured', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    expect(screen.getByText('sk-•••••abc1')).toBeInTheDocument();
    expect(screen.getByText('AI-•••••xyz9')).toBeInTheDocument();
  });

  it('shows key input when provider has no key', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    // Anthropic and OpenRouter have no key - should show password inputs for key entry
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(2);
  });

  it('disables Switch when provider has no key', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    const switches = document.querySelectorAll('button[role="switch"]');
    const disabledSwitches = Array.from(switches).filter((s) => s.hasAttribute('disabled'));
    // Anthropic and OpenRouter have no keys -> disabled switches
    expect(disabledSwitches.length).toBe(2);
  });

  it('saves API key and refetches config', async () => {
    const updatedConfig = {
      ...mockConfig,
      providers: mockConfig.providers.map((p) =>
        p.provider === 'anthropic'
          ? { ...p, hasKey: true, maskedKey: 'sk-•••••new1', enabled: true }
          : p
      ),
    };
    vi.mocked(getAIProviders)
      .mockResolvedValueOnce(mockConfig)
      .mockResolvedValueOnce(updatedConfig);
    vi.mocked(setProviderKey).mockResolvedValue({ hasKey: true, maskedKey: 'sk-•••••new1' });

    render(<AIProvidersPage />);
    await waitForLoaded();

    // Find password inputs - anthropic and openrouter have no keys so they show inputs
    const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(1);
    fireEvent.change(passwordInputs[0], { target: { value: 'sk-test-key-123' } });

    // Click the first Save Key button (for the first provider without a key)
    const saveKeyButtons = screen.getAllByText('Save Key');
    await userEvent.click(saveKeyButtons[0]);

    await waitFor(() => {
      expect(setProviderKey).toHaveBeenCalledWith('anthropic', 'sk-test-key-123');
    });
  });

  it('opens remove key confirmation dialog', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    const user = userEvent.setup();
    render(<AIProvidersPage />);
    await waitForLoaded();

    // Find remove button by aria-label
    const removeBtn = screen.getByLabelText('Remove Key OpenAI');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to remove/)).toBeInTheDocument();
    });
  });

  it('removes key after confirmation', async () => {
    vi.mocked(getAIProviders)
      .mockResolvedValueOnce(mockConfig)
      .mockResolvedValueOnce({
        ...mockConfig,
        providers: mockConfig.providers.map((p) =>
          p.provider === 'openai' ? { ...p, hasKey: false, maskedKey: null, enabled: false } : p
        ),
      });
    vi.mocked(removeProviderKey).mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<AIProvidersPage />);
    await waitForLoaded();

    // Click remove button for OpenAI
    const removeBtn = screen.getByLabelText('Remove Key OpenAI');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to remove/)).toBeInTheDocument();
    });

    // Click the Remove Key button in dialog footer
    const dialogRemoveButtons = screen.getAllByText('Remove Key');
    const confirmBtn = dialogRemoveButtons[dialogRemoveButtons.length - 1];
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(removeProviderKey).toHaveBeenCalledWith('openai');
    });
  });

  it('shows rotate key input when clicking Rotate', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();

    const rotateButtons = screen.getAllByText('Rotate');
    await userEvent.click(rotateButtons[0]);

    // After clicking Rotate, masked key should be replaced with password input
    await waitFor(() => {
      expect(screen.queryByText('sk-•••••abc1')).not.toBeInTheDocument();
    });
  });

  it('tests connection and shows success result', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    vi.mocked(testProviderKey).mockResolvedValue({ ok: true, latencyMs: 245 });

    render(<AIProvidersPage />);
    await waitForLoaded();

    const testButtons = screen.getAllByText('Test');
    await userEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(testProviderKey).toHaveBeenCalledWith('openai');
    });
    await waitFor(() => {
      expect(screen.getByText('Connected (245ms)')).toBeInTheDocument();
    });
  });

  it('tests connection and shows failure result', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    vi.mocked(testProviderKey).mockResolvedValue({ ok: false, error: 'Invalid API key' });

    render(<AIProvidersPage />);
    await waitForLoaded();

    const testButtons = screen.getAllByText('Test');
    await userEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed: Invalid API key')).toBeInTheDocument();
    });
  });

  it('shows spinner during test connection', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    vi.mocked(testProviderKey).mockReturnValue(new Promise(() => {}));

    render(<AIProvidersPage />);
    await waitForLoaded();

    const testButtons = screen.getAllByText('Test');
    await userEvent.click(testButtons[0]);

    await waitFor(() => {
      // Test button should be disabled while testing
      expect(testButtons[0]).toBeDisabled();
    });
  });

  it('toggles fallback key section visibility', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();

    const fallbackToggles = screen.getAllByText('Fallback API Key');
    expect(fallbackToggles.length).toBe(4);

    // Hint should not be visible before click
    expect(screen.queryByText('Optional backup key')).not.toBeInTheDocument();

    // Click to expand first one
    await userEvent.click(fallbackToggles[0]);

    await waitFor(() => {
      expect(screen.getByText('Optional backup key')).toBeInTheDocument();
    });
  });

  it('renders default model picker with active providers only', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    expect(screen.getByText('Default AI Model')).toBeInTheDocument();
    expect(screen.getByText('Default provider and model')).toBeInTheDocument();
  });

  it('renders fallback order section with all providers', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    expect(screen.getByText('Fallback Order')).toBeInTheDocument();
    expect(screen.getByText('System tries providers in this order')).toBeInTheDocument();
    expect(screen.getByText('Save Order')).toBeInTheDocument();
    // Verify numbering
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
    expect(screen.getByText('4.')).toBeInTheDocument();
  });

  it('saves fallback order when clicking Save Order', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    vi.mocked(saveFallbackOrderApi).mockResolvedValue(undefined);

    render(<AIProvidersPage />);
    await waitForLoaded();

    await userEvent.click(screen.getByText('Save Order'));

    await waitFor(() => {
      expect(saveFallbackOrderApi).toHaveBeenCalledWith(['openai', 'anthropic', 'google', 'openrouter']);
    });
  });

  it('shows no active providers message when none have keys', async () => {
    const noKeysConfig = {
      ...mockConfig,
      providers: mockConfig.providers.map((p) => ({ ...p, hasKey: false, enabled: false })),
    };
    vi.mocked(getAIProviders).mockResolvedValue(noKeysConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    expect(screen.getByText('No active providers')).toBeInTheDocument();
  });

  it('shows Test Fallback button when provider has fallback key', async () => {
    vi.mocked(getAIProviders).mockResolvedValue(mockConfig);
    render(<AIProvidersPage />);
    await waitForLoaded();
    // Google has hasFallbackKey: true
    expect(screen.getByText('Test Fallback')).toBeInTheDocument();
  });

  it('shows no providers message when empty', async () => {
    vi.mocked(getAIProviders).mockResolvedValue({
      providers: [],
      defaultProvider: { provider: '', model: '' },
      fallbackOrder: [],
    });
    render(<AIProvidersPage />);
    await waitForLoaded();
    expect(screen.getByText('No providers')).toBeInTheDocument();
  });

  describe('Recon model overrides', () => {
    it('hydrates the 3 recon inputs from the config response', async () => {
      vi.mocked(getAIProviders).mockResolvedValue({
        ...mockConfig,
        reconModels: {
          small: 'sonnet-small',
          medium: 'sonnet-medium',
          large: 'opus-large',
        },
      });
      render(<AIProvidersPage />);
      await waitForLoaded();

      const small = document.getElementById('recon-small-model') as HTMLInputElement;
      const medium = document.getElementById('recon-medium-model') as HTMLInputElement;
      const large = document.getElementById('recon-large-model') as HTMLInputElement;
      expect(small.value).toBe('sonnet-small');
      expect(medium.value).toBe('sonnet-medium');
      expect(large.value).toBe('opus-large');
    });

    it('renders empty inputs when the server returned null for each tier', async () => {
      vi.mocked(getAIProviders).mockResolvedValue({
        ...mockConfig,
        reconModels: { small: null, medium: null, large: null },
      });
      render(<AIProvidersPage />);
      await waitForLoaded();

      const small = document.getElementById('recon-small-model') as HTMLInputElement;
      const medium = document.getElementById('recon-medium-model') as HTMLInputElement;
      const large = document.getElementById('recon-large-model') as HTMLInputElement;
      expect(small.value).toBe('');
      expect(medium.value).toBe('');
      expect(large.value).toBe('');
    });

    it('round-trips an empty input as null (not "") when saving', async () => {
      vi.mocked(getAIProviders).mockResolvedValue({
        ...mockConfig,
        reconModels: {
          small: 'sonnet-small',
          medium: null,
          large: 'opus-large',
        },
      });
      vi.mocked(setReconModels).mockResolvedValue({
        small: null,
        medium: null,
        large: 'opus-large',
      });

      render(<AIProvidersPage />);
      await waitForLoaded();

      // Clear the small input (replacing 'sonnet-small' with '').
      const small = document.getElementById('recon-small-model') as HTMLInputElement;
      fireEvent.change(small, { target: { value: '' } });

      const saveBtn = screen.getByTestId('save-recon-models');
      await userEvent.click(saveBtn);

      await waitFor(() => {
        expect(setReconModels).toHaveBeenCalledTimes(1);
      });

      // The page hands raw input to the API helper, which is the boundary
      // where '' collapses to null before hitting the wire (see api.test.ts).
      const payload = vi.mocked(setReconModels).mock.calls[0][0];
      expect(payload.small).toBe('');
      expect(payload.large).toBe('opus-large');

      // After the server confirms null, the cleared input stays empty
      // instead of drifting to a literal "null" string.
      await waitFor(() => {
        expect((document.getElementById('recon-small-model') as HTMLInputElement).value).toBe('');
      });
    });

    it('forwards a non-empty override verbatim', async () => {
      vi.mocked(getAIProviders).mockResolvedValue({
        ...mockConfig,
        reconModels: { small: null, medium: null, large: null },
      });
      vi.mocked(setReconModels).mockResolvedValue({
        small: null,
        medium: 'claude-opus-4-6',
        large: null,
      });

      render(<AIProvidersPage />);
      await waitForLoaded();

      const medium = document.getElementById('recon-medium-model') as HTMLInputElement;
      fireEvent.change(medium, { target: { value: 'claude-opus-4-6' } });

      const saveBtn = screen.getByTestId('save-recon-models');
      await userEvent.click(saveBtn);

      await waitFor(() => {
        expect(setReconModels).toHaveBeenCalled();
      });

      const payload = vi.mocked(setReconModels).mock.calls[0][0];
      expect(payload.medium).toBe('claude-opus-4-6');
    });
  });
});
