import React from 'react';
import { FiCheckCircle, FiXCircle, FiClock, FiAlertCircle, FiInfo } from 'react-icons/fi';

type Status = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';

interface StatusBadgeProps {
  status: Status;
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig = {
  success: {
    icon: FiCheckCircle,
    color: 'bg-green-900/30 text-green-300 border-green-800',
  },
  error: {
    icon: FiXCircle,
    color: 'bg-red-900/30 text-red-300 border-red-800',
  },
  warning: {
    icon: FiAlertCircle,
    color: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
  },
  info: {
    icon: FiInfo,
    color: 'bg-blue-900/30 text-blue-300 border-blue-800',
  },
  pending: {
    icon: FiClock,
    color: 'bg-muted text-muted-foreground border-border',
  },
  running: {
    icon: FiClock,
    color: 'bg-blue-900/30 text-blue-300 border-blue-800',
  },
};

const sizeConfig = {
  sm: {
    text: 'text-xs',
    padding: 'px-2 py-0.5',
    icon: 'h-3 w-3',
    gap: 'gap-1',
  },
  md: {
    text: 'text-sm',
    padding: 'px-2.5 py-1',
    icon: 'h-4 w-4',
    gap: 'gap-1.5',
  },
  lg: {
    text: 'text-base',
    padding: 'px-3 py-1.5',
    icon: 'h-5 w-5',
    gap: 'gap-2',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  pulse = false,
  size = 'md',
  className = '',
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeStyles = sizeConfig[size];
  const defaultLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center ${sizeStyles.gap} rounded-full border font-medium ${config.color} ${sizeStyles.text} ${sizeStyles.padding} transition-colors duration-150 ${className}`}
      role="status"
      aria-label={`Status: ${label || defaultLabel}`}
    >
      <Icon className={sizeStyles.icon} />
      {label || defaultLabel}
    </span>
  );
};
