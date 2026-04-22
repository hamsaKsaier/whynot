import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../providers/FeatureFlagsProvider', () => ({
  useFeatureFlagsContext: vi.fn(() => ({
    flags: { 'feature-a': true, 'feature-b': false },
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

import { useFeatureFlag } from '../useFeatureFlag';

describe('useFeatureFlag', () => {
  it('returns true for enabled flag', () => {
    const { result } = renderHook(() => useFeatureFlag('feature-a'));
    expect(result.current).toBe(true);
  });

  it('returns false for disabled flag', () => {
    const { result } = renderHook(() => useFeatureFlag('feature-b'));
    expect(result.current).toBe(false);
  });

  it('returns false for unknown flag', () => {
    const { result } = renderHook(() => useFeatureFlag('nonexistent'));
    expect(result.current).toBe(false);
  });
});
