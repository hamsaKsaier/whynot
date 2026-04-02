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
  Area,
  ComposedChart,
} from 'recharts';
import type { PerfMetric } from '../../hooks/usePerfStream';

interface ResponseTimeChartProps {
  data: PerfMetric[];
}

export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ data }) => {
  const chartData = data.map((m, i) => ({
    time: i,
    p50: Math.round(m.p50ResponseTime),
    p95: Math.round(m.p95ResponseTime),
    p99: Math.round(m.p99ResponseTime),
  }));

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Response Time (ms)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              stroke="#475569"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${v}s`}
            />
            <YAxis
              stroke="#475569"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: 12,
              }}
              labelFormatter={(v) => `${v}s`}
              formatter={(value: any, name: any) => [
                `${value}ms`,
                name === 'p50' ? 'p50 (median)' : name,
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
            />
            <Area
              type="monotone"
              dataKey="p50"
              fill="#0ea5e9"
              fillOpacity={0.08}
              stroke="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#0ea5e9"
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
            <Line
              type="monotone"
              dataKey="p99"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
