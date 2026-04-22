import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock useAuth
let mockIsAuthenticated = true;
vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { id: '1', email: 'test@test.com', name: 'Test' } : null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: (...args: any[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: '/api' },
  },
}));

import { WorkspaceProvider, useWorkspace } from '../WorkspaceContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

describe('WorkspaceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockIsAuthenticated = true;
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), href: '' },
      writable: true,
    });
  });

  it('throws when useWorkspace is used outside provider', () => {
    expect(() => {
      renderHook(() => useWorkspace());
    }).toThrow('useWorkspace must be used within <WorkspaceProvider>');
  });

  it('fetches workspaces on mount when authenticated', async () => {
    const workspaces = [
      { id: 'ws-1', name: 'Default', owner_id: '1', created_at: '2025-01-01' },
    ];
    mockGet.mockResolvedValueOnce({ data: { success: true, workspaces } });

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.workspaces).toHaveLength(1);
    });

    expect(result.current.activeWorkspace?.id).toBe('ws-1');
  });

  it('uses stored active workspace ID', async () => {
    localStorage.setItem('active_workspace_id', 'ws-2');
    const workspaces = [
      { id: 'ws-1', name: 'First', owner_id: '1', created_at: '2025-01-01' },
      { id: 'ws-2', name: 'Second', owner_id: '1', created_at: '2025-01-01' },
    ];
    mockGet.mockResolvedValueOnce({ data: { success: true, workspaces } });

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.workspaces).toHaveLength(2);
    });

    expect(result.current.activeWorkspace?.id).toBe('ws-2');
  });

  it('createWorkspace adds a workspace', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, workspaces: [] } });
    const newWs = { id: 'ws-new', name: 'New', owner_id: '1', created_at: '2025-01-01' };
    mockPost.mockResolvedValueOnce({ data: { success: true, workspace: newWs } });

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let created: any;
    await act(async () => {
      created = await result.current.createWorkspace('New');
    });

    expect(created).toEqual(newWs);
    expect(result.current.workspaces).toContainEqual(newWs);
  });

  it('renameWorkspace updates workspace name', async () => {
    const workspaces = [{ id: 'ws-1', name: 'Old', owner_id: '1', created_at: '2025-01-01' }];
    mockGet.mockResolvedValueOnce({ data: { success: true, workspaces } });
    const updated = { ...workspaces[0], name: 'Renamed' };
    mockPut.mockResolvedValueOnce({ data: { success: true, workspace: updated } });

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.workspaces).toHaveLength(1);
    });

    await act(async () => {
      await result.current.renameWorkspace('ws-1', 'Renamed');
    });

    expect(result.current.workspaces[0].name).toBe('Renamed');
  });

  it('switchWorkspace updates localStorage and reloads', () => {
    mockGet.mockResolvedValue({ data: { success: true, workspaces: [] } });

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    act(() => {
      result.current.switchWorkspace('ws-2');
    });

    expect(localStorage.getItem('active_workspace_id')).toBe('ws-2');
    expect(window.location.reload).toHaveBeenCalled();
  });
});
