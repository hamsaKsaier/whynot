import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/motion/prefers-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    useInView: vi.fn(() => true),
    animate: vi.fn((_from: number, to: number, opts: { onUpdate: (v: number) => void }) => {
      opts.onUpdate(to);
      return { stop: vi.fn() };
    }),
  };
});

import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { CountUp } from '../CountUp';

const mockUseReducedMotion = vi.mocked(useReducedMotion);

describe('CountUp', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders target number', () => {
    render(<CountUp target={1000} locale="en" />);
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('applies data-motion attribute', () => {
    render(<CountUp target={42} locale="en" />);
    expect(document.querySelector('[data-motion="count-up"]')).toBeInTheDocument();
  });

  it('passes className', () => {
    render(<CountUp target={42} locale="en" className="stat" />);
    expect(document.querySelector('[data-motion="count-up"]')).toHaveClass('stat');
  });

  it('shows final value immediately with reduced motion', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<CountUp target={500} locale="en" />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('supports polymorphic as prop', () => {
    render(<CountUp as="div" target={10} locale="en" />);
    const el = document.querySelector('[data-motion="count-up"]');
    expect(el?.tagName).toBe('DIV');
  });

  it.each(['en', 'ar', 'fr', 'de', 'es'])(
    'formats number for locale %s via Intl.NumberFormat',
    (locale) => {
      mockUseReducedMotion.mockReturnValue(true);
      render(<CountUp target={1000} locale={locale} />);
      const el = document.querySelector('[data-motion="count-up"]');
      const expected = new Intl.NumberFormat(locale).format(1000);
      expect(el?.textContent).toBe(expected);
    },
  );
});
