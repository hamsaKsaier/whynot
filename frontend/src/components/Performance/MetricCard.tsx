import React from 'react';

interface MetricCardProps {
  label: string;
  value: number;
  unit?: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
  previousValue?: number;
  formatValue?: (v: number) => string;
  invertTrend?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  color = 'default',
  previousValue,
  formatValue,
  invertTrend = false,
}) => {
  const colorMap = {
    default: 'text-foreground',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (previousValue !== undefined && previousValue !== value) {
    trend = value > previousValue ? 'up' : 'down';
  }

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = invertTrend
    ? (trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-500')
    : (trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-amber-400' : 'text-slate-500');

  const displayValue = formatValue ? formatValue(value) : value.toLocaleString();

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tabular-nums ${colorMap[color]}`}>
          {displayValue}
        </span>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
        {previousValue !== undefined && (
          <span className={`text-xs ms-1 ${trendColor}`}>{trendIcon}</span>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
};
