import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLog } from '../services/api';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export const AuditLogPage: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 30;

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditLog({
        offset,
        limit,
        action: actionFilter || undefined,
      });
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [offset, actionFilter]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const actionColors: Record<string, string> = {
    'user.role_change': 'bg-sky-900/30 text-sky-300',
    'user.suspend': 'bg-red-900/30 text-red-300',
    'user.unsuspend': 'bg-green-900/30 text-green-300',
    'user.impersonate': 'bg-yellow-900/30 text-yellow-300',
    'credits.grant': 'bg-green-900/30 text-green-300',
    'credits.revoke': 'bg-red-900/30 text-red-300',
    'plan.archive': 'bg-slate-800 text-slate-200',
    'plan.restore': 'bg-blue-900/30 text-blue-300',
    'settings.update': 'bg-sky-900/30 text-sky-300',
    'announcement.create': 'bg-blue-900/30 text-blue-300',
    'announcement.update': 'bg-yellow-900/30 text-yellow-300',
    'announcement.delete': 'bg-red-900/30 text-red-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
          className="px-3 py-2 border border-slate-600 rounded-lg text-sm"
        >
          <option value="">All Actions</option>
          <option value="user.role_change">Role Change</option>
          <option value="user.suspend">User Suspend</option>
          <option value="user.unsuspend">User Unsuspend</option>
          <option value="user.impersonate">Impersonate</option>
          <option value="credits.grant">Credits Grant</option>
          <option value="credits.revoke">Credits Revoke</option>
          <option value="plan.archive">Plan Archive</option>
          <option value="plan.restore">Plan Restore</option>
          <option value="settings.update">Settings Update</option>
          <option value="announcement.create">Announcement Create</option>
          <option value="announcement.update">Announcement Update</option>
          <option value="announcement.delete">Announcement Delete</option>
        </select>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Target</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-700 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No audit entries found</td></tr>
            ) : entries.map((entry: any) => (
              <tr key={entry.id} className="hover:bg-slate-900">
                <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-slate-200">
                  {entry.actor_email || entry.actor_id?.slice(0, 8) || 'System'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[entry.action] || 'bg-slate-800 text-slate-200'}`}>
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {entry.target_type && (
                    <span className="font-mono text-xs">
                      {entry.target_type}:{entry.target_id?.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                  {entry.details && Object.keys(entry.details).length > 0
                    ? JSON.stringify(entry.details)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Math.ceil(total / limit) > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="p-2 border rounded-lg disabled:opacity-50">
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="p-2 border rounded-lg disabled:opacity-50">
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
