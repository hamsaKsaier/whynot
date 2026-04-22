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
          bg-card rounded-xl shadow-sm p-6 flex flex-col items-center gap-3
          transform transition-opacity duration-150
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <div className="relative">
          <div className="relative bg-green-900/20 rounded-full p-3">
            <FiCheck className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        {message && (
          <p className="text-sm font-medium text-foreground">{message}</p>
        )}
      </div>
    </div>
  );
};
