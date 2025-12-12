import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
}) => {
  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  
  const icons = {
    success: FiCheckCircle,
    error: FiAlertCircle,
    warning: FiAlertCircle,
    info: FiInfo,
  };
  
  const Icon = icons[type];
  
  return (
    <div className={`border rounded-lg p-4 ${typeStyles[type]}`}>
      <div className="flex items-start">
        <Icon className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          {title && (
            <h3 className="font-medium mb-1">{title}</h3>
          )}
          <p className="text-sm">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 text-current opacity-50 hover:opacity-75"
          >
            <FiX className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};


















