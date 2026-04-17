import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../prefers-reduced-motion';

describe('useReducedMotion', () => {
  let listeners: Map<string, (e: MediaQueryListEvent) => void>;
  let matches: boolean;

  beforeEach(() => {
    listeners = new Map();
    matches = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners.set(query, handler);
        },
        removeEventListener: (_event: string, _handler: (e: MediaQueryListEvent) => void) => {
          listeners.delete(query);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it('returns false when motion is not reduced', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when motion is reduced', () => {
    matches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('reacts to matchMedia change events', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      const handler = listeners.get('(prefers-reduced-motion: reduce)');
      handler?.({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);

    act(() => {
      const handler = listeners.get('(prefers-reduced-motion: reduce)');
      handler?.({ matches: false } as MediaQueryListEvent);
    });
    expect(result.current).toBe(false);
  });

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(listeners.has('(prefers-reduced-motion: reduce)')).toBe(false);
  });
});
