import React from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { useClipboard } from '../../hooks/useClipboard';
import { Button } from './Button';

interface CopyButtonProps {
  text: string;
  successMessage?: string;
  errorMessage?: string;
  variant?: 'icon' | 'button';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  successMessage,
  errorMessage,
  variant = 'icon',
  size = 'sm',
  className = '',
}) => {
  const { copyToClipboard, copied } = useClipboard();

  const handleCopy = () => {
    copyToClipboard(text, { successMessage, errorMessage });
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCopy}
        className={`p-2 rounded hover:bg-gray-100 transition-colors ${className}`}
        aria-label="Copy to clipboard"
        title="Copy to clipboard"
      >
        {copied ? (
          <FiCheck className="h-4 w-4 text-green-600" />
        ) : (
          <FiCopy className="h-4 w-4 text-gray-600" />
        )}
      </button>
    );
  }

  return (
    <Button
      onClick={handleCopy}
      size={size}
      variant="secondary"
      className={className}
    >
      {copied ? (
        <>
          <FiCheck className="mr-2" />
          Copied!
        </>
      ) : (
        <>
          <FiCopy className="mr-2" />
          Copy
        </>
      )}
    </Button>
  );
};
