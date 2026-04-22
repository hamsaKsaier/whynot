import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the FeatureFlagsProvider
const mockFlags: Record<string, boolean> = {};

vi.mock('../../providers/FeatureFlagsProvider', () => ({
  useFeatureFlagsContext: () => ({
    flags: mockFlags,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

import { useFeatureFlag } from '../useFeatureFlag';

describe('useFeatureFlag', () => {
  it('returns true when flag is enabled', () => {
    mockFlags['feature_a'] = true;
    const { result } = renderHook(() => useFeatureFlag('feature_a'));
    expect(result.current).toBe(true);
  });

  it('returns false when flag is disabled', () => {
    mockFlags['feature_b'] = false;
    const { result } = renderHook(() => useFeatureFlag('feature_b'));
    expect(result.current).toBe(false);
  });

  it('returns false when flag does not exist', () => {
    const { result } = renderHook(() => useFeatureFlag('nonexistent'));
    expect(result.current).toBe(false);
  });
});
