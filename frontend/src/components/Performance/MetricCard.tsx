import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'success' | 'warning' | 'danger';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  color = 'default',
}) => {
  const colorMap = {
    default: 'text-white',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <div className={`text-2xl font-bold ${colorMap[color]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
    </div>
  );
};
