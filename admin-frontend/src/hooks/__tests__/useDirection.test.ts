import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    i18n: { resolvedLanguage: 'en' },
  })),
}));

vi.mock('@/i18n', () => ({
  RTL_LANGUAGES: ['ar'],
  SUPPORTED_LANGUAGES: ['en', 'ar', 'fr', 'de', 'es'],
}));

import { useTranslation } from 'react-i18next';
import { useDirection } from '../useDirection';

describe('useDirection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  it('returns ltr direction for English', () => {
    const { result } = renderHook(() => useDirection());
    expect(result.current.direction).toBe('ltr');
    expect(result.current.isRtl).toBe(false);
  });

  it('returns rtl direction for Arabic', () => {
    vi.mocked(useTranslation).mockReturnValue({
      i18n: { resolvedLanguage: 'ar' },
    } as any);
    const { result } = renderHook(() => useDirection());
    expect(result.current.direction).toBe('rtl');
    expect(result.current.isRtl).toBe(true);
  });

  it('setDirection updates direction and document attribute', () => {
    const { result } = renderHook(() => useDirection());
    act(() => {
      result.current.setDirection('rtl');
    });
    expect(result.current.direction).toBe('rtl');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('sets lang attribute on document element', () => {
    vi.mocked(useTranslation).mockReturnValue({
      i18n: { resolvedLanguage: 'fr' },
    } as any);
    renderHook(() => useDirection());
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
  });
});
