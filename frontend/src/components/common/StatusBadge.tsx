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
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  error: {
    icon: FiXCircle,
    color: 'bg-red-100 text-red-800 border-red-200',
  },
  warning: {
    icon: FiAlertCircle,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  info: {
    icon: FiInfo,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  pending: {
    icon: FiClock,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  running: {
    icon: FiClock,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
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
      className={`inline-flex items-center ${sizeStyles.gap} rounded-full border font-medium ${config.color} ${sizeStyles.text} ${sizeStyles.padding} ${
        pulse ? 'animate-pulse' : ''
      } transition-all duration-200 ${className}`}
      role="status"
      aria-label={`Status: ${label || defaultLabel}`}
    >
      <Icon className={sizeStyles.icon} />
      {label || defaultLabel}
    </span>
  );
};
