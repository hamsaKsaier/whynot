import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../skeleton';

describe('Skeleton', () => {
  it('renders a div element', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('applies animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('applies rounded-md class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('rounded-md');
  });

  it('applies bg-muted class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('bg-muted');
  });

  it('has data-slot attribute', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute('data-slot', 'skeleton');
  });

  it('merges custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);
    expect(container.firstChild).toHaveClass('h-8', 'w-32');
  });
});
