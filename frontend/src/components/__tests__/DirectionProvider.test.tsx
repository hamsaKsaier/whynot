import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

vi.mock('../../hooks/useDirection', () => ({
  useDirection: () => ({
    direction: 'ltr' as const,
    setDirection: vi.fn(),
    isRtl: false,
  }),
}));

import { DirectionProvider, useDirectionContext } from '../DirectionProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DirectionProvider>{children}</DirectionProvider>
);

describe('DirectionProvider', () => {
  it('throws when useDirectionContext is used outside provider', () => {
    expect(() => {
      renderHook(() => useDirectionContext());
    }).toThrow('useDirectionContext must be used within a DirectionProvider');
  });

  it('provides direction context values', () => {
    const { result } = renderHook(() => useDirectionContext(), { wrapper });

    expect(result.current.direction).toBe('ltr');
    expect(result.current.isRtl).toBe(false);
    expect(typeof result.current.setDirection).toBe('function');
  });
});
