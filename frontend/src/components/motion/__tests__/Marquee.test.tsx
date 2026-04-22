import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/motion/prefers-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock('@/lib/motion/direction', () => ({
  useMotionDirection: vi.fn(() => 1),
}));

import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { useMotionDirection } from '@/lib/motion/direction';
import { Marquee } from '../Marquee';

const mockUseReducedMotion = vi.mocked(useReducedMotion);
const mockUseMotionDirection = vi.mocked(useMotionDirection);

describe('Marquee', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
    mockUseMotionDirection.mockReturnValue(1);
  });

  it('renders children', () => {
    render(<Marquee><span>Logo</span></Marquee>);
    expect(screen.getAllByText('Logo').length).toBeGreaterThanOrEqual(1);
  });

  it('applies data-motion attribute', () => {
    render(<Marquee><span>Logo</span></Marquee>);
    expect(document.querySelector('[data-motion="marquee"]')).toBeInTheDocument();
  });

  it('passes className', () => {
    render(<Marquee className="trust-bar"><span>Logo</span></Marquee>);
    expect(document.querySelector('[data-motion="marquee"]')).toHaveClass('trust-bar');
  });

  it('pauses on mouseenter', () => {
    render(<Marquee><span>Logo</span></Marquee>);
    const container = document.querySelector('[data-motion="marquee"]')!;
    fireEvent.mouseEnter(container);
    const inner = container.querySelector('[style*="animation"]') as HTMLElement;
    expect(inner?.style.animationPlayState).toBe('paused');
  });

  it('resumes on mouseleave', () => {
    render(<Marquee><span>Logo</span></Marquee>);
    const container = document.querySelector('[data-motion="marquee"]')!;
    fireEvent.mouseEnter(container);
    fireEvent.mouseLeave(container);
    const inner = container.querySelector('[style*="animation"]') as HTMLElement;
    expect(inner?.style.animationPlayState).toBe('running');
  });

  it('reverses direction for RTL', () => {
    mockUseMotionDirection.mockReturnValue(-1);
    render(<Marquee><span>Logo</span></Marquee>);
    const container = document.querySelector('[data-motion="marquee"]')!;
    const inner = container.querySelector('[style*="animation"]') as HTMLElement;
    expect(inner?.style.animationDirection).toBe('reverse');
  });

  it('computes animation duration from content width', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() { return 600; },
    });
    render(<Marquee speed={30}><span>Logo</span></Marquee>);
    const container = document.querySelector('[data-motion="marquee"]')!;
    const inner = container.querySelector('[style*="animation"]') as HTMLElement;
    expect(inner?.style.animation).toContain('20s');
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() { return 0; },
    });
  });

  it('renders static grid with reduced motion', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<Marquee><span>Logo</span></Marquee>);
    const container = document.querySelector('[data-motion="marquee"]')!;
    const animatedEl = container.querySelector('[style*="animation"]');
    expect(animatedEl).toBeNull();
    expect(screen.getByText('Logo')).toBeInTheDocument();
  });
});
