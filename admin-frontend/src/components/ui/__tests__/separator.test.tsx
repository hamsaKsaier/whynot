import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Separator } from '../separator';

describe('Separator', () => {
  it('renders a separator', () => {
    const { container } = render(<Separator />);
    expect(container.querySelector('[data-orientation]')).toBeInTheDocument();
  });

  it('defaults to horizontal orientation', () => {
    const { container } = render(<Separator />);
    expect(container.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument();
  });

  it('supports vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();
  });

  it('applies bg-border class', () => {
    const { container } = render(<Separator />);
    const sep = container.firstChild as HTMLElement;
    expect(sep).toHaveClass('bg-border');
  });

  it('merges custom className', () => {
    const { container } = render(<Separator className="my-4" />);
    const sep = container.firstChild as HTMLElement;
    expect(sep).toHaveClass('my-4');
  });
});
