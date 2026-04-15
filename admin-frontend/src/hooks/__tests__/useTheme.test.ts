import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    vi.resetModules();
    // Mock matchMedia for jsdom
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  async function loadHook() {
    const mod = await import('../useTheme');
    return mod.useTheme;
  }

  it('setTheme updates theme and persists to localStorage', async () => {
    const useTheme = await loadHook();
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('setTheme applies class to documentElement', async () => {
    const useTheme = await loadHook();
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('toggle switches between light and dark', async () => {
    localStorage.setItem('theme', 'light');
    const useTheme = await loadHook();
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe('dark');
  });

  it('toggle from dark to light', async () => {
    localStorage.setItem('theme', 'dark');
    const useTheme = await loadHook();
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe('light');
  });

  it('resolvedTheme returns light or dark for explicit theme', async () => {
    localStorage.setItem('theme', 'dark');
    const useTheme = await loadHook();
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('resolvedTheme is never system', async () => {
    localStorage.setItem('theme', 'light');
    const useTheme = await loadHook();
    const { result } = renderHook(() => useTheme());
    expect(['light', 'dark']).toContain(result.current.resolvedTheme);
    expect(result.current.resolvedTheme).not.toBe('system');
  });
});
