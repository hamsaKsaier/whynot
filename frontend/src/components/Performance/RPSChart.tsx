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

interface RPSChartProps {
  data: PerfMetric[];
}

export const RPSChart: React.FC<RPSChartProps> = ({ data }) => {
  const chartData = data.map((m, i) => ({
    time: i,
    rps: Math.round(m.requestsPerSecond * 10) / 10,
  }));

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Requests/Second</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: 12,
              }}
              labelFormatter={(v) => `${v}s`}
              formatter={(value: any) => [`${value} req/s`, 'Throughput']}
            />
            <Area
              type="monotone"
              dataKey="rps"
              stroke="#0ea5e9"
              fill="#0ea5e9"
              fillOpacity={0.12}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
