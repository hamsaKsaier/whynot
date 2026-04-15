import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slider } from '../slider';

describe('Slider', () => {
  it('renders a slider', () => {
    render(<Slider defaultValue={[50]} max={100} step={1} aria-label="Volume" />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('sets aria-valuenow', () => {
    render(<Slider defaultValue={[75]} max={100} step={1} aria-label="Volume" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '75');
  });

  it('applies default classes', () => {
    const { container } = render(<Slider defaultValue={[50]} max={100} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('flex', 'w-full');
  });

  it('merges custom className', () => {
    const { container } = render(<Slider defaultValue={[50]} max={100} className="my-4" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('my-4');
  });
});
