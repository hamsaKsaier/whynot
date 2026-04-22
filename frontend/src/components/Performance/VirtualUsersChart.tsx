import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('runner');
  const chartData = data.map((m, i) => ({
    time: i,
    vus: m.vus,
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">{t('runner.performance.virtualUsers')}</h3>
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
              formatter={(value: any) => [`${value} ${t('runner.performance.chart.unit.vus')}`, t('runner.performance.virtualUsers')]}
            />
            <Area
              type="monotone"
              dataKey="vus"
              stroke="#10b981"
              fill="#10b981"
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
