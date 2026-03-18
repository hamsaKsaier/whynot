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
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-red-100 text-red-800',
    canceled: 'bg-gray-100 text-gray-800',
    paused: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workspace</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period End</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : subscriptions.map((sub: any) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.workspace_name || sub.workspace_id}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{sub.owner_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{sub.plan_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[sub.status] || 'bg-gray-100 text-gray-800'}`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{sub.credits_remaining}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Math.ceil(total / limit) > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}</span>
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
