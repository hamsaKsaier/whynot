import React, { useState, useEffect } from 'react';
import { getAnalyticsOverview, getAnalyticsSignups, getAnalyticsRevenue, getAnalyticsUsage, getAnalyticsChurn } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [churn, setChurn] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAnalyticsOverview(),
      getAnalyticsSignups(30),
      getAnalyticsRevenue(),
      getAnalyticsUsage(30),
      getAnalyticsChurn(90),
    ]).then(([ov, su, rev, us, ch]) => {
      setOverview(ov.overview);
      setSignups(su.signups || []);
      setRevenue(rev.revenue || []);
      setUsage(us.usage || []);
      setChurn(ch.churn || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Revenue & Analytics</h1>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  const kpis = [
    { label: 'Total Users', value: overview?.total_users || 0 },
    { label: 'Active Subscriptions', value: overview?.active_subscriptions || 0 },
    { label: 'MRR', value: `$${((overview?.mrr_cents || 0) / 100).toFixed(2)}` },
    { label: 'ARR', value: `$${((overview?.arr_cents || 0) / 100).toFixed(2)}` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Revenue & Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Signups Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Signups (Last 30 days)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={signups}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="plan_name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
              <Tooltip formatter={(val: number) => `$${(val / 100).toFixed(2)}`} />
              <Bar dataKey="mrr_cents" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Credit Usage */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Credit Usage (Last 30 days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={usage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="credits_used" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Churn */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cancellations (Last 90 days)</h2>
        {churn.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No cancellations in this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={churn}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="cancellations" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
