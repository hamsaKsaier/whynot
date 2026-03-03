import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiPlus, FiCheck, FiLoader, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useWorkspace } from '../contexts/WorkspaceContext';

export const WorkspaceSwitcher: React.FC = () => {
  const { workspaces, activeWorkspace, isLoading, switchWorkspace, createWorkspace, deleteWorkspace } =
    useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateLoading(true);
    try {
      const ws = await createWorkspace(newName.trim());
      switchWorkspace(ws.id);
      setNewName('');
      setCreating(false);
      setOpen(false);
    } catch {
      // error handled by caller
    } finally {
      setCreateLoading(false);
    }
  };

  if (isLoading || !activeWorkspace) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500">
        <FiLoader className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">Loading…</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors max-w-[180px]"
      >
        <span className="truncate">{activeWorkspace.name}</span>
        <FiChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Workspaces
          </p>

          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer group"
              onClick={() => {
                if (ws.id !== activeWorkspace.id) switchWorkspace(ws.id);
                setOpen(false);
              }}
            >
              <span className="flex-1 text-sm text-gray-700 truncate">{ws.name}</span>
              {ws.id === activeWorkspace.id && (
                <FiCheck className="h-4 w-4 text-primary-600 shrink-0" />
              )}
              {workspaces.length > 1 && (
                <button
                  title="Delete workspace"
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 transition-colors shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) {
                      deleteWorkspace(ws.id);
                    }
                    setOpen(false);
                  }}
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1">
            {creating ? (
              <form onSubmit={handleCreate} className="px-3 py-2 flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={createLoading || !newName.trim()}
                  className="px-2 py-1 bg-primary-600 text-white text-xs rounded-md disabled:opacity-50"
                >
                  {createLoading ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </button>
              </form>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setCreating(true); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <FiPlus className="h-4 w-4" />
                New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
