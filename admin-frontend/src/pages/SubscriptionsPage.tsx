import React, { useState, useEffect, useCallback } from 'react';
import { getAdminSubscriptions } from '../services/api';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export const SubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminSubscriptions({ offset, limit, status: statusFilter || undefined });
      setSubscriptions(data.subscriptions || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [offset, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const statusColors: Record<string, string> = {
    active: 'bg-green-900/30 text-green-300',
    trialing: 'bg-blue-900/30 text-blue-300',
    past_due: 'bg-red-900/30 text-red-300',
    canceled: 'bg-slate-800 text-slate-200',
    paused: 'bg-yellow-900/30 text-yellow-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="px-3 py-2 border border-slate-600 rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Workspace</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Credits</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Period End</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-700 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : subscriptions.map((sub: any) => (
              <tr key={sub.id} className="hover:bg-slate-900">
                <td className="px-4 py-3 text-sm font-medium text-white">{sub.workspace_name || sub.workspace_id}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{sub.owner_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{sub.plan_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[sub.status] || 'bg-slate-800 text-slate-200'}`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-white">{sub.credits_remaining}</td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '-'}
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
