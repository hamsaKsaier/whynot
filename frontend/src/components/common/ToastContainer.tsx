import React from 'react';
import { useTranslation } from 'react-i18next';
import { Toast, ToastType } from './Toast';

export type { ToastType };

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
}

const positionClasses = {
  'top-right': 'top-4 end-4',
  'top-left': 'top-4 start-4',
  'top-center': 'top-4 start-1/2 transform -translate-x-1/2',
  'bottom-right': 'bottom-4 end-4',
  'bottom-left': 'bottom-4 start-4',
  'bottom-center': 'bottom-4 start-1/2 transform -translate-x-1/2',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'top-right',
}) => {
  const { t } = useTranslation('common');

  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed z-50 ${positionClasses[position]} pointer-events-none`}
      aria-live="polite"
      aria-label={t('common.aria.notifications')}
    >
      <div className="pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
};
