import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PerfMetric } from '../../hooks/usePerfStream';

interface ResponseTimeChartProps {
  data: PerfMetric[];
}

export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ data }) => {
  const chartData = data.map((m, i) => ({
    time: i,
    avg: Math.round(m.avgResponseTime),
    p95: Math.round(m.p95ResponseTime),
  }));

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Response Time (ms)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
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
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              formatter={(value: any, name: any) => [
                `${value}ms`,
                name === 'avg' ? 'Average' : 'p95',
              ]}
            />
            <Legend
              formatter={(value) => (value === 'avg' ? 'Average' : 'p95')}
              wrapperStyle={{ color: '#94a3b8' }}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p95"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
