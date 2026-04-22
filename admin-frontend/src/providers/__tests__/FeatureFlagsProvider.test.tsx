import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FeatureFlagsProvider, useFeatureFlagsContext } from '../FeatureFlagsProvider';

vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'super_admin' },
  })),
}));

import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

function TestConsumer() {
  const { flags, isLoading } = useFeatureFlagsContext();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="flags">{JSON.stringify(flags)}</span>
    </div>
  );
}

describe('FeatureFlagsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches flags when user is present', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, flags: { 'feature-x': true } },
    });

    vi.useRealTimers();
    render(
      <FeatureFlagsProvider>
        <TestConsumer />
      </FeatureFlagsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('flags').textContent).toBe('{"feature-x":true}');
  });

  it('sets empty flags when no user', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
    } as any);

    vi.useRealTimers();
    render(
      <FeatureFlagsProvider>
        <TestConsumer />
      </FeatureFlagsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('flags').textContent).toBe('{}');
  });

  it('keeps previous flags on fetch error', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('fail'));

    vi.useRealTimers();
    render(
      <FeatureFlagsProvider>
        <TestConsumer />
      </FeatureFlagsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    // Flags remain empty (initial state)
    expect(screen.getByTestId('flags').textContent).toBe('{}');
  });

  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useFeatureFlagsContext must be used within <FeatureFlagsProvider>',
    );
    spy.mockRestore();
  });
});
