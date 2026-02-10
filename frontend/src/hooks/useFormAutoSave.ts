import { useEffect, useCallback, useRef } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import { debounce } from '../utils/debounce';

export const useFormAutoSave = <T extends Record<string, any>>(
  formKey: string,
  formData: T,
  options: {
    debounceMs?: number;
    enabled?: boolean;
    onRestore?: (data: T) => void;
  } = {}
) => {
  const { info } = useToastContext();
  const {
    debounceMs = 1000,
    enabled = true,
    onRestore,
  } = options;

  const storageKey = `draft_${formKey}`;
  const hasRestoredRef = useRef(false);

  // Debounced save function
  const saveDraft = useCallback(
    debounce((data: T) => {
      if (!enabled) return;

      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (error) {
        // Handle quota exceeded or other localStorage errors
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded, cannot save draft');
        } else {
          console.error('Failed to save draft:', error);
        }
      }
    }, debounceMs),
    [storageKey, enabled, debounceMs]
  );

  // Save draft whenever form data changes
  useEffect(() => {
    if (enabled && Object.keys(formData).length > 0) {
      // Check if form has meaningful data (not just empty strings)
      const hasData = Object.values(formData).some(
        (value) => value !== '' && value !== null && value !== undefined
      );

      if (hasData) {
        saveDraft(formData);
      }
    }
  }, [formData, enabled, saveDraft]);

  // Load draft on mount
  const loadDraft = useCallback((): T | null => {
    if (!enabled || hasRestoredRef.current) return null;

    try {
      const draft = localStorage.getItem(storageKey);
      if (draft) {
        const parsed = JSON.parse(draft) as T;
        hasRestoredRef.current = true;
        
        // Show notification
        info('Draft restored. You can continue where you left off.', {
          title: 'Draft Found',
          duration: 5000,
        });

        // Call onRestore callback if provided
        onRestore?.(parsed);

        return parsed;
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }

    return null;
  }, [storageKey, enabled, info, onRestore]);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      hasRestoredRef.current = false;
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [storageKey]);

  // Check if draft exists
  const hasDraft = useCallback((): boolean => {
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  }, [storageKey]);

  return {
    loadDraft,
    clearDraft,
    hasDraft,
  };
};
