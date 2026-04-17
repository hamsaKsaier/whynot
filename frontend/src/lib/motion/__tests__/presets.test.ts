import { describe, it, expect } from 'vitest';
import {
  easeOutExpo,
  easeInOutCubic,
  springSmooth,
  springSnappy,
  duration,
  fadeInVariants,
  slideUpVariants,
  staggerContainerVariants,
} from '../presets';

describe('presets', () => {
  it('exports easeOutExpo as a 4-tuple', () => {
    expect(easeOutExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it('exports easeInOutCubic as a 4-tuple', () => {
    expect(easeInOutCubic).toEqual([0.65, 0, 0.35, 1]);
  });

  it('exports springSmooth with correct values', () => {
    expect(springSmooth).toEqual({ type: 'spring', stiffness: 200, damping: 25 });
  });

  it('exports springSnappy with correct values', () => {
    expect(springSnappy).toEqual({ type: 'spring', stiffness: 400, damping: 30 });
  });

  it('exports duration constants within Uncodixify limits', () => {
    expect(duration.fast).toBe(0.15);
    expect(duration.base).toBe(0.2);
    expect(duration.slow).toBe(0.4);
    expect(duration.slow).toBeLessThanOrEqual(0.4);
  });

  it('exports fadeInVariants with hidden and visible states', () => {
    expect(fadeInVariants.hidden).toEqual({ opacity: 0 });
    expect(fadeInVariants.visible).toBeDefined();
  });

  it('exports slideUpVariants with hidden and visible states', () => {
    expect(slideUpVariants.hidden).toEqual({ opacity: 0, y: 8 });
    expect(slideUpVariants.visible).toBeDefined();
  });

  it('exports staggerContainerVariants', () => {
    expect(staggerContainerVariants.hidden).toEqual({});
    expect(staggerContainerVariants.visible).toBeDefined();
  });
});
