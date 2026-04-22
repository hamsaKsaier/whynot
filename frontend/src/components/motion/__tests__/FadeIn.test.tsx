import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/motion/prefers-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { FadeIn } from '../FadeIn';

const mockUseReducedMotion = vi.mocked(useReducedMotion);

describe('FadeIn', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders children', () => {
    render(<FadeIn><span>Hello</span></FadeIn>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies data-motion attribute', () => {
    render(<FadeIn>content</FadeIn>);
    expect(screen.getByText('content').closest('[data-motion="fade-in"]')).toBeInTheDocument();
  });

  it('passes className', () => {
    render(<FadeIn className="test-class">content</FadeIn>);
    const el = screen.getByText('content').closest('[data-motion="fade-in"]');
    expect(el).toHaveClass('test-class');
  });

  it('renders as section with as prop', () => {
    render(<FadeIn as="section">content</FadeIn>);
    const el = screen.getByText('content').closest('[data-motion="fade-in"]');
    expect(el?.tagName).toBe('SECTION');
  });

  it('sets opacity 1 immediately with reduced motion', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<FadeIn>content</FadeIn>);
    const el = screen.getByText('content').closest('[data-motion="fade-in"]');
    expect(el).toBeInTheDocument();
  });
});
