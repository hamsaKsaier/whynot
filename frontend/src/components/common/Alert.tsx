import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import { Button } from './Button';

export interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  actions?: AlertAction[];
  suggestions?: string[];
  onClose?: () => void;
  dismissible?: boolean;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  actions = [],
  suggestions = [],
  onClose,
  dismissible = true,
  className = '',
}) => {
  const typeStyles = {
    success: 'bg-green-900/20 border-green-800 text-green-300',
    error: 'bg-red-900/20 border-red-800 text-red-300',
    warning: 'bg-yellow-900/20 border-yellow-700 text-yellow-300',
    info: 'bg-blue-900/20 border-blue-800 text-blue-300',
  };

  const icons = {
    success: FiCheckCircle,
    error: FiAlertCircle,
    warning: FiAlertCircle,
    info: FiInfo,
  };

  const Icon = icons[type];

  return (
    <div className={`border rounded-lg p-4 ${typeStyles[type]} ${className}`.trim()}>
      <div className="flex items-start">
        <Icon className="h-5 w-5 mt-0.5 me-3 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="font-semibold mb-1 text-base">{title}</h3>
          )}
          <p className="text-sm mb-2">{message}</p>

          {suggestions.length > 0 && (
            <div className="mt-3 mb-3">
              <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant || 'primary'}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {dismissible && onClose && (
          <button
            onClick={onClose}
            className="ms-4 flex-shrink-0 text-current opacity-50 hover:opacity-75 transition-opacity"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};





























