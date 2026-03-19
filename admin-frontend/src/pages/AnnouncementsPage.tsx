import React, { useState, useEffect, useCallback } from 'react';
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

interface AnnouncementForm {
  title: string;
  body: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_active: boolean;
  starts_at: string;
  ends_at: string;
}

const emptyForm: AnnouncementForm = { title: '', body: '', type: 'info', is_active: true, starts_at: '', ends_at: '' };

export const AnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAnnouncements();
      setAnnouncements(data.announcements || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (a: any) => {
    setForm({
      title: a.title,
      body: a.body || '',
      type: a.type,
      is_active: a.is_active,
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : '',
      ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '',
    });
    setEditingId(a.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        body: form.body || undefined,
        type: form.type,
        is_active: form.is_active,
        starts_at: form.starts_at || undefined,
        ends_at: form.ends_at || undefined,
      };
      if (editingId) {
        await updateAnnouncement(editingId, payload);
      } else {
        await createAnnouncement(payload);
      }
      setShowModal(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await deleteAnnouncement(id);
    fetchAll();
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-900/30 text-blue-300',
      warning: 'bg-yellow-900/30 text-yellow-300',
      success: 'bg-green-900/30 text-green-300',
      error: 'bg-red-900/30 text-red-300',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || colors.info}`}>{type}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Announcements</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <FiPlus className="h-4 w-4" /> New Announcement
        </button>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Active</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Schedule</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-700 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : announcements.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No announcements</td></tr>
            ) : announcements.map((a: any) => (
              <tr key={a.id} className="hover:bg-slate-900">
                <td className="px-4 py-3 text-sm font-medium text-white">{a.title}</td>
                <td className="px-4 py-3">{typeBadge(a.type)}</td>
                <td className="px-4 py-3">
                  <span className={`h-2 w-2 rounded-full inline-block ${a.is_active ? 'bg-green-500' : 'bg-slate-600'}`} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {a.starts_at ? new Date(a.starts_at).toLocaleDateString() : 'Immediate'}
                  {a.ends_at ? ` — ${new Date(a.ends_at).toLocaleDateString()}` : ''}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400" title="Edit">
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-900/20 rounded-lg text-red-500 ml-1" title="Delete">
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-800 rounded"><FiX className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Body</label>
                <textarea value={form.body} onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={3} className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="rounded border-slate-600" />
                    Active
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Starts At</label>
                  <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm(f => ({ ...f, starts_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Ends At</label>
                  <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm(f => ({ ...f, ends_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
