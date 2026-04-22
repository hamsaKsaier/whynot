import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  it('starts with no toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('showToast adds a toast with correct properties', () => {
    const { result } = renderHook(() => useToast());

    let id: string;
    act(() => {
      id = result.current.showToast('success', 'Test message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'success',
      message: 'Test message',
    });
    expect(result.current.toasts[0].id).toBeTruthy();
  });

  it('showToast supports optional title and duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('error', 'Failed', { title: 'Error!', duration: 3000 });
    });

    expect(result.current.toasts[0].title).toBe('Error!');
    expect(result.current.toasts[0].duration).toBe(3000);
  });

  it('success convenience method creates success toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Done!');
    });

    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Done!');
  });

  it('error convenience method creates error toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Failed!');
    });

    expect(result.current.toasts[0].type).toBe('error');
  });

  it('warning convenience method creates warning toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.warning('Careful!');
    });

    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('info convenience method creates info toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('FYI');
    });

    expect(result.current.toasts[0].type).toBe('info');
  });

  it('dismissToast removes a specific toast', () => {
    const { result } = renderHook(() => useToast());

    let id1: string, id2: string;
    act(() => {
      id1 = result.current.showToast('success', 'First');
      id2 = result.current.showToast('error', 'Second');
    });

    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.dismissToast(id1!);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second');
  });

  it('dismissAll removes all toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('success', 'First');
      result.current.showToast('error', 'Second');
      result.current.showToast('info', 'Third');
    });

    expect(result.current.toasts).toHaveLength(3);

    act(() => {
      result.current.dismissAll();
    });

    expect(result.current.toasts).toEqual([]);
  });

  it('generates unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('success', 'First');
      result.current.showToast('success', 'Second');
    });

    const ids = result.current.toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });
});
