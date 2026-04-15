import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock useAuth
let mockUser: any = { id: '1', name: 'Test' };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: !!mockUser,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

const mockGet = vi.fn();

vi.mock('../../services/api', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: '/api' },
  },
}));

import { FeatureFlagsProvider, useFeatureFlagsContext } from '../FeatureFlagsProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
);

describe('FeatureFlagsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: '1', name: 'Test' };
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useFeatureFlagsContext());
    }).toThrow('useFeatureFlagsContext must be used within <FeatureFlagsProvider>');
  });

  it('fetches flags when user is authenticated', async () => {
    mockGet.mockResolvedValueOnce({
      data: { success: true, flags: { feature_a: true, feature_b: false } },
    });

    const { result } = renderHook(() => useFeatureFlagsContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual({ feature_a: true, feature_b: false });
  });

  it('clears flags when user is null', async () => {
    mockUser = null;

    const { result } = renderHook(() => useFeatureFlagsContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual({});
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('keeps previous flags on error', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { success: true, flags: { kept: true } },
      })
      .mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useFeatureFlagsContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.flags).toEqual({ kept: true });
    });

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    // flags should still be the old ones
    expect(result.current.flags).toEqual({ kept: true });
  });

  it('provides a refetch function', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, flags: {} },
    });

    const { result } = renderHook(() => useFeatureFlagsContext(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });
});
