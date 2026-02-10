import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastItem, ToastType } from '../components/common/ToastContainer';

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, options?: { title?: string; duration?: number }) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
  success: (message: string, options?: { title?: string; duration?: number }) => string;
  error: (message: string, options?: { title?: string; duration?: number }) => string;
  warning: (message: string, options?: { title?: string; duration?: number }) => string;
  info: (message: string, options?: { title?: string; duration?: number }) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        dismissAll,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
};
