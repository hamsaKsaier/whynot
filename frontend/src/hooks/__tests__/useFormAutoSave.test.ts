import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock ToastContext
const mockInfo = vi.fn();

vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: mockInfo,
    warning: vi.fn(),
    toasts: [],
    showToast: vi.fn(),
    dismissToast: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

// Mock debounce to execute immediately for testing
vi.mock('../../utils/debounce', () => ({
  debounce: (fn: (...args: any[]) => void, _ms: number) => fn,
}));

import { useFormAutoSave } from '../useFormAutoSave';

describe('useFormAutoSave', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('saves form data to localStorage', () => {
    const formData = { name: 'Test', email: 'test@test.com' };
    renderHook(() => useFormAutoSave('test-form', formData));

    const stored = localStorage.getItem('draft_test-form');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(formData);
  });

  it('does not save when enabled is false', () => {
    const formData = { name: 'Test' };
    renderHook(() => useFormAutoSave('test-form', formData, { enabled: false }));

    expect(localStorage.getItem('draft_test-form')).toBeNull();
  });

  it('does not save empty form data', () => {
    const formData = { name: '', email: '' };
    renderHook(() => useFormAutoSave('test-form', formData));

    expect(localStorage.getItem('draft_test-form')).toBeNull();
  });

  it('loadDraft returns stored data', () => {
    const savedData = { name: 'Saved', email: 'saved@test.com' };
    localStorage.setItem('draft_load-test', JSON.stringify(savedData));

    const { result } = renderHook(() =>
      useFormAutoSave('load-test', { name: '', email: '' })
    );

    let loaded: any;
    act(() => {
      loaded = result.current.loadDraft();
    });

    expect(loaded).toEqual(savedData);
    expect(mockInfo).toHaveBeenCalled();
  });

  it('loadDraft returns null when no draft exists', () => {
    const { result } = renderHook(() =>
      useFormAutoSave('no-draft', { name: '' })
    );

    let loaded: any;
    act(() => {
      loaded = result.current.loadDraft();
    });

    expect(loaded).toBeNull();
  });

  it('loadDraft only loads once (hasRestoredRef)', () => {
    localStorage.setItem('draft_once-test', JSON.stringify({ name: 'data' }));

    const { result } = renderHook(() =>
      useFormAutoSave('once-test', { name: '' })
    );

    let first: any, second: any;
    act(() => {
      first = result.current.loadDraft();
    });
    act(() => {
      second = result.current.loadDraft();
    });

    expect(first).toEqual({ name: 'data' });
    expect(second).toBeNull();
  });

  it('clearDraft removes draft from localStorage', () => {
    localStorage.setItem('draft_clear-test', JSON.stringify({ name: 'data' }));

    const { result } = renderHook(() =>
      useFormAutoSave('clear-test', { name: '' })
    );

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem('draft_clear-test')).toBeNull();
  });

  it('hasDraft returns true when draft exists', () => {
    localStorage.setItem('draft_has-test', JSON.stringify({ name: 'data' }));

    const { result } = renderHook(() =>
      useFormAutoSave('has-test', { name: '' })
    );

    let has: boolean;
    act(() => {
      has = result.current.hasDraft();
    });

    expect(has!).toBe(true);
  });

  it('hasDraft returns false when no draft exists', () => {
    const { result } = renderHook(() =>
      useFormAutoSave('no-has-test', { name: '' })
    );

    let has: boolean;
    act(() => {
      has = result.current.hasDraft();
    });

    expect(has!).toBe(false);
  });

  it('calls onRestore callback when draft is loaded', () => {
    const onRestore = vi.fn();
    localStorage.setItem('draft_restore-test', JSON.stringify({ name: 'restored' }));

    const { result } = renderHook(() =>
      useFormAutoSave('restore-test', { name: '' }, { onRestore })
    );

    act(() => {
      result.current.loadDraft();
    });

    expect(onRestore).toHaveBeenCalledWith({ name: 'restored' });
  });
});
