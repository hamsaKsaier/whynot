import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/motion/prefers-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { Stagger } from '../Stagger';

const mockUseReducedMotion = vi.mocked(useReducedMotion);

describe('Stagger', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders children', () => {
    render(
      <Stagger>
        <div>Child 1</div>
        <div>Child 2</div>
      </Stagger>,
    );
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('applies data-motion attribute', () => {
    render(<Stagger>content</Stagger>);
    expect(screen.getByText('content').closest('[data-motion="stagger"]')).toBeInTheDocument();
  });

  it('passes className', () => {
    render(<Stagger className="my-class">content</Stagger>);
    const el = screen.getByText('content').closest('[data-motion="stagger"]');
    expect(el).toHaveClass('my-class');
  });

  it('accepts custom delay and stagger props', () => {
    render(
      <Stagger delay={0.1} stagger={0.08}>
        <div>A</div>
        <div>B</div>
      </Stagger>,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders immediately with reduced motion', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(
      <Stagger>
        <div>A</div>
      </Stagger>,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('supports polymorphic as prop', () => {
    render(<Stagger as="ul">content</Stagger>);
    const el = screen.getByText('content').closest('[data-motion="stagger"]');
    expect(el?.tagName).toBe('UL');
  });
});
