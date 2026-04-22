import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock the ToastContext
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    success: mockSuccess,
    error: mockError,
    info: vi.fn(),
    warning: vi.fn(),
    toasts: [],
    showToast: vi.fn(),
    dismissToast: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

import { useClipboard } from '../useClipboard';

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with copied as false', () => {
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copied).toBe(false);
  });

  it('copies text to clipboard and sets copied to true', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copyToClipboard('hello');
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copied).toBe(true);
    expect(mockSuccess).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('uses custom success message', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copyToClipboard('test', { successMessage: 'URL copied!' });
    });

    expect(mockSuccess).toHaveBeenCalledWith('URL copied!');
  });

  it('resets copied to false after 2000ms', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copyToClipboard('test');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  it('shows error toast when clipboard write fails', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copyToClipboard('test');
    });

    expect(mockError).toHaveBeenCalledWith('Failed to copy to clipboard');
    expect(result.current.copied).toBe(false);
  });

  it('uses custom error message on failure', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('fail')),
      },
    });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copyToClipboard('test', { errorMessage: 'Oops!' });
    });

    expect(mockError).toHaveBeenCalledWith('Oops!');
  });
});
