import React, { useEffect, useState } from 'react';
import { FiCheck } from 'react-icons/fi';

interface SuccessAnimationProps {
  message?: string;
  onComplete?: () => void;
  duration?: number;
  className?: string;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  message = 'Success!',
  onComplete,
  duration = 2000,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete?.();
      }, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`
          bg-slate-800 rounded-xl shadow-2xl p-6 flex flex-col items-center gap-3
          transform transition-all duration-300
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-green-900/30 rounded-full animate-ping opacity-75" />
          <div className="relative bg-green-900/200 rounded-full p-3">
            <FiCheck className="h-8 w-8 text-white" />
          </div>
        </div>
        {message && (
          <p className="text-sm font-medium text-white">{message}</p>
        )}
      </div>
    </div>
  );
};
