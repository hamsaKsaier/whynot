import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PerfMetric } from '../../hooks/usePerfStream';

interface VirtualUsersChartProps {
  data: PerfMetric[];
}

export const VirtualUsersChart: React.FC<VirtualUsersChartProps> = ({ data }) => {
  const chartData = data.map((m, i) => ({
    time: i,
    vus: m.vus,
  }));

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Virtual Users</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}s`}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              formatter={(value: any) => [`${value} VUs`, 'Virtual Users']}
            />
            <Area
              type="monotone"
              dataKey="vus"
              stroke="#38bdf8"
              fill="#38bdf8"
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
