import React, { useState, useEffect } from 'react';
import { getAdminOverviewStats, getAdminUsers } from '../services/api';
import { FiUsers, FiDollarSign, FiCreditCard, FiTrendingUp } from 'react-icons/fi';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAdminOverviewStats().catch(() => ({ stats: {} })),
      getAdminUsers({ limit: 5 }).catch(() => ({ users: [] })),
    ]).then(([statsData, usersData]) => {
      setStats(statsData.stats);
      setRecentUsers(usersData.users || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: FiUsers, color: 'bg-blue-50 text-blue-600' },
    { label: 'MRR', value: `$${((stats?.mrr_cents ?? 0) / 100).toFixed(0)}`, icon: FiDollarSign, color: 'bg-green-50 text-green-600' },
    { label: 'Active Plans', value: stats?.subscriptions_by_plan?.length ?? 0, icon: FiCreditCard, color: 'bg-purple-50 text-purple-600' },
    { label: 'ARR', value: `$${((stats?.mrr_cents ?? 0) * 12 / 100).toFixed(0)}`, icon: FiTrendingUp, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Distribution */}
      {stats?.subscriptions_by_plan && stats.subscriptions_by_plan.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscriptions by Plan</h2>
          <div className="space-y-2">
            {stats.subscriptions_by_plan.map((item: any) => (
              <div key={item.plan_id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{item.plan_id}</span>
                <span className="text-sm font-medium text-gray-900">{item.count} subscribers</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Users */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Users</h2>
        <table className="min-w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="pb-3">Name</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Plan</th>
              <th className="pb-3">Credits</th>
              <th className="pb-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentUsers.map((u: any) => (
              <tr key={u.id}>
                <td className="py-3 text-sm font-medium text-gray-900">{u.name}</td>
                <td className="py-3 text-sm text-gray-500">{u.email}</td>
                <td className="py-3 text-sm text-gray-500">{u.plan_name || '-'}</td>
                <td className="py-3 text-sm text-gray-500">{u.credits}</td>
                <td className="py-3 text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
