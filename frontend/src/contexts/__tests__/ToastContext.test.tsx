import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToastContext } from '../ToastContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('ToastContext', () => {
  it('throws when useToastContext is used outside provider', () => {
    expect(() => {
      renderHook(() => useToastContext());
    }).toThrow('useToastContext must be used within ToastProvider');
  });

  it('provides toast functions', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    expect(result.current.toasts).toEqual([]);
    expect(typeof result.current.showToast).toBe('function');
    expect(typeof result.current.dismissToast).toBe('function');
    expect(typeof result.current.dismissAll).toBe('function');
    expect(typeof result.current.success).toBe('function');
    expect(typeof result.current.error).toBe('function');
    expect(typeof result.current.warning).toBe('function');
    expect(typeof result.current.info).toBe('function');
  });

  it('showToast adds a toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('success', 'Test message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Test message');
  });

  it('success adds a success toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.success('Done!', { title: 'Success' });
    });

    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].title).toBe('Success');
  });

  it('error adds an error toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.error('Failed!');
    });

    expect(result.current.toasts[0].type).toBe('error');
  });

  it('warning adds a warning toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.warning('Watch out!');
    });

    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('info adds an info toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.info('FYI');
    });

    expect(result.current.toasts[0].type).toBe('info');
  });

  it('dismissToast removes a specific toast', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    let id: string;
    act(() => {
      id = result.current.showToast('success', 'First');
      result.current.showToast('error', 'Second');
    });

    act(() => {
      result.current.dismissToast(id!);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second');
  });

  it('dismissAll clears all toasts', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast('success', 'First');
      result.current.showToast('error', 'Second');
    });

    act(() => {
      result.current.dismissAll();
    });

    expect(result.current.toasts).toEqual([]);
  });

  it('showToast returns the toast ID', () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    let id: string;
    act(() => {
      id = result.current.showToast('info', 'Test');
    });

    expect(id!).toBeTruthy();
    expect(typeof id!).toBe('string');
  });
});
