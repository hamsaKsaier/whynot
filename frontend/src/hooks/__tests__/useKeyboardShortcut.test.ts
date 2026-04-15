import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcut } from '../useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
  it('calls callback when the correct key is pressed', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('k', callback));

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      })
    );

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call callback for wrong key', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('k', callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('respects ctrlKey modifier', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('s', callback, { ctrlKey: true }));

    // Without ctrl - should not fire
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: false }));
    expect(callback).not.toHaveBeenCalled();

    // With ctrl - should fire
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('respects shiftKey modifier', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('?', callback, { shiftKey: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('respects altKey modifier', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('n', callback, { altKey: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('respects metaKey modifier', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('k', callback, { metaKey: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault by default', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('k', callback));

    const event = new KeyboardEvent('keydown', { key: 'k', cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not call preventDefault when disabled', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut('k', callback, { preventDefault: false }));

    const event = new KeyboardEvent('keydown', { key: 'k', cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('cleans up event listener on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut('k', callback));

    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));

    expect(callback).not.toHaveBeenCalled();
  });
});
