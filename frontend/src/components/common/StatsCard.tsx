import React from 'react';
import { FiTrendingUp, FiTrendingDown, FiChevronRight } from 'react-icons/fi';
import { cn } from '../../lib/utils';
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
      className={cn('p-4 group', onClick && 'cursor-pointer', className)}
      onClick={onClick}
      hoverable={!!onClick}
      clickable={!!onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {onClick && (
              <FiChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-150 flex-shrink-0 rtl:scale-x-[-1]" />
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">{formatValue(value)}</p>
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
          <div className="p-3 bg-muted group-hover:bg-muted/70 rounded-lg flex-shrink-0 ms-4 transition-colors duration-150">
            <div className="text-primary">{icon}</div>
          </div>
        )}
      </div>
    </Card>
  );
};
