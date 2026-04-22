import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle } from 'react-icons/fi';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  const { t } = useTranslation('common');
  const resolvedConfirmText = confirmText ?? t('common.actions.confirm');
  const resolvedCancelText = cancelText ?? t('common.actions.cancel');
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-red-900/20 border-red-800',
    warning: 'bg-yellow-900/20 border-yellow-700',
    info: 'bg-blue-900/20 border-blue-800',
  };

  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-card rounded-lg shadow-sm max-w-md w-full border-2 ${variantStyles[variant]}`}>
        <div className="p-6">
          <div className="flex items-start mb-4">
            <FiAlertTriangle className={`h-6 w-6 me-3 flex-shrink-0 ${
              variant === 'danger' ? 'text-red-600' : 
              variant === 'warning' ? 'text-yellow-600' : 
              'text-blue-600'
            }`} />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={onCancel}
            >
              {resolvedCancelText}
            </Button>
            <Button
              onClick={onConfirm}
              className={buttonStyles[variant]}
            >
              {resolvedConfirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

















