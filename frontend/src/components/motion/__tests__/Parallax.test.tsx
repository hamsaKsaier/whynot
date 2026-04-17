import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/motion/prefers-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { Parallax } from '../Parallax';

const mockUseReducedMotion = vi.mocked(useReducedMotion);

describe('Parallax', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders children', () => {
    render(<Parallax><span>Hello</span></Parallax>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies data-motion attribute', () => {
    render(<Parallax>content</Parallax>);
    expect(screen.getByText('content').closest('[data-motion="parallax"]')).toBeInTheDocument();
  });

  it('passes className', () => {
    render(<Parallax className="parallax-test">content</Parallax>);
    const el = screen.getByText('content').closest('[data-motion="parallax"]');
    expect(el).toHaveClass('parallax-test');
  });

  it('renders with reduced motion (no transform)', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<Parallax>content</Parallax>);
    expect(screen.getByText('content').closest('[data-motion="parallax"]')).toBeInTheDocument();
  });

  it('accepts custom speed prop', () => {
    render(<Parallax speed={0.5}>content</Parallax>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('supports polymorphic as prop', () => {
    render(<Parallax as="section">content</Parallax>);
    const el = screen.getByText('content').closest('[data-motion="parallax"]');
    expect(el?.tagName).toBe('SECTION');
  });
});
