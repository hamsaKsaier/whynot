import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMotionDirection } from '../direction';

describe('useMotionDirection', () => {
  let originalDir: string;

  beforeEach(() => {
    originalDir = document.documentElement.dir;
  });

  afterEach(() => {
    document.documentElement.dir = originalDir;
  });

  it('returns 1 for LTR', () => {
    document.documentElement.dir = 'ltr';
    const { result } = renderHook(() => useMotionDirection());
    expect(result.current).toBe(1);
  });

  it('returns -1 for RTL', () => {
    document.documentElement.dir = 'rtl';
    const { result } = renderHook(() => useMotionDirection());
    expect(result.current).toBe(-1);
  });

  it('returns 1 when dir is empty', () => {
    document.documentElement.dir = '';
    const { result } = renderHook(() => useMotionDirection());
    expect(result.current).toBe(1);
  });

  it('updates when dir attribute changes', async () => {
    document.documentElement.dir = 'ltr';
    const { result } = renderHook(() => useMotionDirection());
    expect(result.current).toBe(1);

    await act(async () => {
      document.documentElement.dir = 'rtl';
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current).toBe(-1);
  });
});
