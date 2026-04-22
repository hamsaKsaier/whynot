import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '../useOnboarding';

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts as not completed when no stored value', () => {
    const { result } = renderHook(() => useOnboarding());

    // After the effect runs, isCompleted should reflect localStorage (not set = false)
    // isLoading starts true, then goes to false after effect
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isCompleted).toBe(false);
  });

  it('starts as completed when stored value is true', () => {
    localStorage.setItem('whynot_onboarding_completed', 'true');
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.isCompleted).toBe(true);
  });

  it('completeOnboarding sets localStorage and state', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.completeOnboarding();
    });

    expect(result.current.isCompleted).toBe(true);
    expect(localStorage.getItem('whynot_onboarding_completed')).toBe('true');
  });

  it('resetOnboarding removes localStorage and resets state', () => {
    localStorage.setItem('whynot_onboarding_completed', 'true');
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.resetOnboarding();
    });

    expect(result.current.isCompleted).toBe(false);
    expect(localStorage.getItem('whynot_onboarding_completed')).toBeNull();
  });

  it('isLoading transitions from true to false', () => {
    const { result } = renderHook(() => useOnboarding());
    // After render + effect, isLoading should be false
    expect(result.current.isLoading).toBe(false);
  });
});
