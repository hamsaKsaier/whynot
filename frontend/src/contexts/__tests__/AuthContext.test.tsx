import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock apiClient
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: '/api' },
  },
}));

import { AuthProvider, useAuth } from '../AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Mock location
    Object.defineProperty(window, 'location', {
      value: { href: '', pathname: '/' },
      writable: true,
    });
  });

  it('throws when useAuth is used outside provider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within <AuthProvider>');
  });

  it('starts unauthenticated when no token exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for loading to finish (no token so immediately done)
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('validates existing token on mount', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'user' },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeTruthy();
    expect(result.current.user?.email).toBe('test@test.com');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('clears token when validation fails', async () => {
    localStorage.setItem('auth_token', 'invalid-token');
    mockGet.mockRejectedValueOnce(new Error('401'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('login stores token and sets user', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        token: 'new-token',
        user: { id: '1', email: 'test@test.com', name: 'Test', avatarUrl: null },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login('test@test.com', 'password123');
    });

    expect(localStorage.getItem('auth_token')).toBe('new-token');
    expect(result.current.user?.email).toBe('test@test.com');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('register stores token and sets user', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        token: 'new-token',
        user: { id: '1', email: 'new@test.com', name: 'New User', avatarUrl: null },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.register('new@test.com', 'password', 'New User');
    });

    expect(localStorage.getItem('auth_token')).toBe('new-token');
    expect(result.current.user?.name).toBe('New User');
  });

  it('logout clears token and user', async () => {
    localStorage.setItem('auth_token', 'token');
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('login clears active_workspace_id', async () => {
    localStorage.setItem('active_workspace_id', 'ws-1');
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        token: 'token',
        user: { id: '1', email: 'a@b.com', name: 'A', avatarUrl: null },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('a@b.com', 'pass');
    });

    expect(localStorage.getItem('active_workspace_id')).toBeNull();
  });
});
