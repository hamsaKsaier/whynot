import { useState, useCallback } from 'react';
import { useToastContext } from '../contexts/ToastContext';

export const useClipboard = () => {
  const { success, error: showError } = useToastContext();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(
    async (text: string, options?: { successMessage?: string; errorMessage?: string }) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        success(options?.successMessage || 'Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        showError(options?.errorMessage || 'Failed to copy to clipboard');
      }
    },
    [success, showError]
  );

  return { copyToClipboard, copied };
};
