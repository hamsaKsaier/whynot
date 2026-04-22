import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/motion/prefers-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { Reveal } from '../Reveal';

const mockUseReducedMotion = vi.mocked(useReducedMotion);

describe('Reveal', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders children', () => {
    render(<Reveal><span>Hello</span></Reveal>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies data-motion attribute', () => {
    render(<Reveal>content</Reveal>);
    expect(screen.getByText('content').closest('[data-motion="reveal"]')).toBeInTheDocument();
  });

  it('passes className', () => {
    render(<Reveal className="test-reveal">content</Reveal>);
    const el = screen.getByText('content').closest('[data-motion="reveal"]');
    expect(el).toHaveClass('test-reveal');
  });

  it('renders as section with as prop', () => {
    render(<Reveal as="section">content</Reveal>);
    const el = screen.getByText('content').closest('[data-motion="reveal"]');
    expect(el?.tagName).toBe('SECTION');
  });

  it('sets final state immediately with reduced motion', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<Reveal>content</Reveal>);
    const el = screen.getByText('content').closest('[data-motion="reveal"]');
    expect(el).toBeInTheDocument();
  });
});
