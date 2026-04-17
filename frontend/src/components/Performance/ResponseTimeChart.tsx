import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('runner');
  const chartData = data.map((m, i) => ({
    time: i,
    p50: Math.round(m.p50ResponseTime),
    p95: Math.round(m.p95ResponseTime),
    p99: Math.round(m.p99ResponseTime),
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">{t('runner.performance.responseTimeMs')}</h3>
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
                `${value} ${t('runner.performance.chart.unit.ms')}`,
                name,
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
            />
            <Area
              type="monotone"
              dataKey="p50"
              name={t('runner.performance.chart.legend.p50')}
              fill="#0ea5e9"
              fillOpacity={0.08}
              stroke="none"
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="p50"
              name={t('runner.performance.chart.legend.p50')}
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p95"
              name={t('runner.performance.chart.legend.p95')}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p99"
              name={t('runner.performance.chart.legend.p99')}
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
