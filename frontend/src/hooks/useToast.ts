import { useState, useCallback } from 'react';
import { ToastItem, ToastType } from '../components/common/ToastContainer';

let toastIdCounter = 0;

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((
    type: ToastType,
    message: string,
    options?: {
      title?: string;
      duration?: number;
    }
  ) => {
    const id = `toast-${++toastIdCounter}`;
    const newToast: ToastItem = {
      id,
      type,
      message,
      title: options?.title,
      duration: options?.duration,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback(
    (message: string, options?: { title?: string; duration?: number }) =>
      showToast('success', message, options),
    [showToast]
  );

  const error = useCallback(
    (message: string, options?: { title?: string; duration?: number }) =>
      showToast('error', message, options),
    [showToast]
  );

  const warning = useCallback(
    (message: string, options?: { title?: string; duration?: number }) =>
      showToast('warning', message, options),
    [showToast]
  );

  const info = useCallback(
    (message: string, options?: { title?: string; duration?: number }) =>
      showToast('info', message, options),
    [showToast]
  );

  return {
    toasts,
    showToast,
    dismissToast,
    dismissAll,
    success,
    error,
    warning,
    info,
  };
};
