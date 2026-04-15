import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isSuperadmin: true,
    user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'super_admin' },
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

import { useAuth } from '../../contexts/AuthContext';
import { useIsSuperadmin } from '../useIsSuperadmin';

describe('useIsSuperadmin', () => {
  it('returns true when user is superadmin', () => {
    const { result } = renderHook(() => useIsSuperadmin());
    expect(result.current).toBe(true);
  });

  it('returns false when user is not superadmin', () => {
    vi.mocked(useAuth).mockReturnValue({
      isSuperadmin: false,
      user: { id: '2', name: 'User', email: 'user@test.com', role: 'user' },
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const { result } = renderHook(() => useIsSuperadmin());
    expect(result.current).toBe(false);
  });
});
