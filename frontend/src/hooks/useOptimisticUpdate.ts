import { useState, useCallback, useRef } from 'react';
import { useToastContext } from '../contexts/ToastContext';

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error, rollback: () => void) => void;
  successMessage?: string;
  errorMessage?: string;
}

export const useOptimisticUpdate = <T extends { id: string }>() => {
  const { success, error: showError } = useToastContext();
  const previousStateRef = useRef<T[]>([]);

  const optimisticCreate = useCallback(
    async (
      items: T[],
      newItem: T,
      apiCall: () => Promise<T>,
      options: OptimisticUpdateOptions<T> = {}
    ): Promise<T[]> => {
      const { onSuccess, onError, successMessage, errorMessage } = options;

      // Store previous state for rollback
      previousStateRef.current = [...items];

      // Optimistically add item
      const optimisticItems = [...items, newItem];

      try {
        // Perform API call
        const createdItem = await apiCall();

        // Replace optimistic item with real item
        const updatedItems = items.map((item) =>
          item.id === newItem.id ? createdItem : item
        );
        updatedItems.push(createdItem);

        if (successMessage) {
          success(successMessage);
        }

        onSuccess?.(createdItem);

        return updatedItems;
      } catch (err: any) {
        // Rollback to previous state
        const error = err instanceof Error ? err : new Error(err?.message || 'Unknown error');
        
        if (errorMessage) {
          showError(errorMessage);
        }

        onError?.(error, () => {
          // Rollback function
          return previousStateRef.current;
        });

        // Return previous state
        return previousStateRef.current;
      }
    },
    [success, showError]
  );

  const optimisticUpdate = useCallback(
    async (
      items: T[],
      updatedItem: T,
      apiCall: () => Promise<T>,
      options: OptimisticUpdateOptions<T> = {}
    ): Promise<T[]> => {
      const { onSuccess, onError, successMessage, errorMessage } = options;

      // Store previous state for rollback
      previousStateRef.current = [...items];

      // Optimistically update item
      const optimisticItems = items.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      );

      try {
        // Perform API call
        const result = await apiCall();

        // Replace optimistic item with real item
        const finalItems = optimisticItems.map((item) =>
          item.id === updatedItem.id ? result : item
        );

        if (successMessage) {
          success(successMessage);
        }

        onSuccess?.(result);

        return finalItems;
      } catch (err: any) {
        // Rollback to previous state
        const error = err instanceof Error ? err : new Error(err?.message || 'Unknown error');
        
        if (errorMessage) {
          showError(errorMessage);
        }

        onError?.(error, () => {
          // Rollback function
          return previousStateRef.current;
        });

        // Return previous state
        return previousStateRef.current;
      }
    },
    [success, showError]
  );

  const optimisticDelete = useCallback(
    async (
      items: T[],
      itemId: string,
      apiCall: () => Promise<void>,
      options: OptimisticUpdateOptions<T> = {}
    ): Promise<T[]> => {
      const { onSuccess, onError, successMessage, errorMessage } = options;

      // Store previous state for rollback
      previousStateRef.current = [...items];

      // Optimistically remove item
      const optimisticItems = items.filter((item) => item.id !== itemId);

      try {
        // Perform API call
        await apiCall();

        if (successMessage) {
          success(successMessage);
        }

        onSuccess?.(items.find((item) => item.id === itemId) as T);

        return optimisticItems;
      } catch (err: any) {
        // Rollback to previous state
        const error = err instanceof Error ? err : new Error(err?.message || 'Unknown error');
        
        if (errorMessage) {
          showError(errorMessage);
        }

        onError?.(error, () => {
          // Rollback function
          return previousStateRef.current;
        });

        // Return previous state
        return previousStateRef.current;
      }
    },
    [success, showError]
  );

  return {
    optimisticCreate,
    optimisticUpdate,
    optimisticDelete,
  };
};
