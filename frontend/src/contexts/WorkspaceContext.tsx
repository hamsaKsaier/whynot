import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => localStorage.getItem('active_workspace_id')
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; workspaces: Workspace[] }>('/workspaces');
      const list = res.data.workspaces;
      setWorkspaces(list);

      // If the stored active ID is invalid, fall back to the first workspace
      const stored = localStorage.getItem('active_workspace_id');
      const validId = stored && list.some((w) => w.id === stored) ? stored : list[0]?.id ?? null;
      if (validId !== stored) {
        if (validId) {
          localStorage.setItem('active_workspace_id', validId);
        } else {
          localStorage.removeItem('active_workspace_id');
        }
      }
      setActiveWorkspaceId(validId);
    } catch {
      // silently fail; user will still be able to use the app
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback((id: string) => {
    localStorage.setItem('active_workspace_id', id);
    setActiveWorkspaceId(id);
    // Reload to clear any cached workspace-scoped data
    window.location.reload();
  }, []);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace> => {
    const res = await apiClient.post<{ success: boolean; workspace: Workspace }>('/workspaces', {
      name,
    });
    const created = res.data.workspace;
    setWorkspaces((prev) => [...prev, created]);
    return created;
  }, []);

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const res = await apiClient.put<{ success: boolean; workspace: Workspace }>(`/workspaces/${id}`, {
      name,
    });
    const updated = res.data.workspace;
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? updated : w)));
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    await apiClient.delete(`/workspaces/${id}`);
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    // If the deleted workspace was active, switch to the first remaining one
    if (activeWorkspaceId === id) {
      const remaining = workspaces.filter((w) => w.id !== id);
      const next = remaining[0]?.id ?? null;
      if (next) {
        localStorage.setItem('active_workspace_id', next);
      } else {
        localStorage.removeItem('active_workspace_id');
      }
      setActiveWorkspaceId(next);
    }
  }, [activeWorkspaceId, workspaces]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        switchWorkspace,
        createWorkspace,
        renameWorkspace,
        deleteWorkspace,
        refresh: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within <WorkspaceProvider>');
  return ctx;
}
