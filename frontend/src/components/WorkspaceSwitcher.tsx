import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiChevronDown, FiPlus, FiCheck, FiLoader, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useWorkspace } from '../contexts/WorkspaceContext';

export const WorkspaceSwitcher: React.FC = () => {
  const { t } = useTranslation('common');
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
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground">
        <FiLoader className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">{t("common.workspace.loading")}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors max-w-[180px]"
      >
        <span className="truncate">{activeWorkspace.name}</span>
        <FiChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute start-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-sm z-50 py-1">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("common.workspace.title")}
          </p>

          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer group"
              onClick={() => {
                if (ws.id !== activeWorkspace.id) switchWorkspace(ws.id);
                setOpen(false);
              }}
            >
              <span className="flex-1 text-sm text-foreground truncate">{ws.name}</span>
              {ws.id === activeWorkspace.id && (
                <FiCheck className="h-4 w-4 text-primary-600 shrink-0" />
              )}
              {workspaces.length > 1 && (
                <button
                  title={t("common.workspace.delete")}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 transition-colors shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t("common.workspace.deleteConfirm", { name: ws.name }))) {
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

          <div className="border-t border-border mt-1 pt-1">
            {creating ? (
              <form onSubmit={handleCreate} className="px-3 py-2 flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("common.workspace.namePlaceholder")}
                  className="flex-1 text-sm border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={createLoading || !newName.trim()}
                  className="px-2 py-1 bg-primary-600 text-foreground text-xs rounded-md disabled:opacity-50"
                >
                  {createLoading ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : t("common.workspace.add")}
                </button>
              </form>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setCreating(true); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <FiPlus className="h-4 w-4" />
                {t("common.workspace.new")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
