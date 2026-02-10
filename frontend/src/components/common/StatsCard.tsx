import React from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { Card } from './Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon,
  trend,
  className = '',
  onClick,
}) => {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toString();
    }
    return val;
  };

  return (
    <Card
      className={`p-4 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      hoverable={!!onClick}
      clickable={!!onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
          {change && (
            <div
              className={`flex items-center gap-1 mt-2 text-sm ${
                change.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {change.isPositive ? (
                <FiTrendingUp className="h-4 w-4" />
              ) : (
                <FiTrendingDown className="h-4 w-4" />
              )}
              <span>{Math.abs(change.value)}%</span>
            </div>
          )}
          {trend && trend !== 'neutral' && !change && (
            <div
              className={`flex items-center gap-1 mt-2 text-sm ${
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend === 'up' ? (
                <FiTrendingUp className="h-4 w-4" />
              ) : (
                <FiTrendingDown className="h-4 w-4" />
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-primary-50 rounded-lg flex-shrink-0 ml-4">
            <div className="text-primary-600">{icon}</div>
          </div>
        )}
      </div>
    </Card>
  );
};
