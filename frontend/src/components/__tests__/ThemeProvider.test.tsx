import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark' as const,
    resolvedTheme: 'dark' as const,
    setTheme: vi.fn(),
    toggle: vi.fn(),
  }),
}));

import { ThemeProvider, useThemeContext } from '../ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeProvider', () => {
  it('throws when useThemeContext is used outside provider', () => {
    expect(() => {
      renderHook(() => useThemeContext());
    }).toThrow('useThemeContext must be used within a ThemeProvider');
  });

  it('provides theme context values', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.toggle).toBe('function');
  });
});
