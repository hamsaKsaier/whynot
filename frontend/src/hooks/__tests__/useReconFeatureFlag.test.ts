import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockFlags: Record<string, boolean> = {};

vi.mock('../../providers/FeatureFlagsProvider', () => ({
  useFeatureFlagsContext: () => ({
    flags: mockFlags,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

import { useFeatureFlag } from '../useFeatureFlag';

describe('useFeatureFlag("recon_enabled")', () => {
  it('returns true after provider resolves flag as enabled', () => {
    mockFlags['recon_enabled'] = true;
    const { result } = renderHook(() => useFeatureFlag('recon_enabled'));
    expect(result.current).toBe(true);
  });

  it('returns false when org has override disabling recon', () => {
    mockFlags['recon_enabled'] = false;
    const { result } = renderHook(() => useFeatureFlag('recon_enabled'));
    expect(result.current).toBe(false);
  });

  it('returns false before the flag map has loaded', () => {
    delete mockFlags['recon_enabled'];
    const { result } = renderHook(() => useFeatureFlag('recon_enabled'));
    expect(result.current).toBe(false);
  });
});
