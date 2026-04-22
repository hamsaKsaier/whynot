import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Progress } from '../progress';

describe('Progress', () => {
  it('renders a progress bar', () => {
    const { container } = render(<Progress value={50} />);
    expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument();
  });

  it('renders with given value', () => {
    const { container } = render(<Progress value={75} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeInTheDocument();
    // The indicator shows the correct transform
    const indicator = bar?.querySelector('div');
    expect(indicator).toHaveStyle({ transform: 'translateX(-25%)' });
  });

  it('applies default classes', () => {
    const { container } = render(<Progress value={50} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('rounded-full', 'bg-secondary');
  });

  it('renders indicator with correct transform', () => {
    const { container } = render(<Progress value={60} />);
    const indicator = container.querySelector('[role="progressbar"] > div');
    expect(indicator).toHaveStyle({ transform: 'translateX(-40%)' });
  });

  it('handles value of 0', () => {
    const { container } = render(<Progress value={0} />);
    const indicator = container.querySelector('[role="progressbar"] > div');
    expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('handles value of 100', () => {
    const { container } = render(<Progress value={100} />);
    const indicator = container.querySelector('[role="progressbar"] > div');
    expect(indicator).toHaveStyle({ transform: 'translateX(-0%)' });
  });

  it('merges custom className', () => {
    const { container } = render(<Progress value={50} className="h-2" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('h-2');
  });
});
