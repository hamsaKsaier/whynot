import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders as textarea tag', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').tagName).toBe('TEXTAREA');
  });

  it('handles value changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Textarea onChange={onChange} placeholder="Type" />);
    await user.type(screen.getByPlaceholderText('Type'), 'hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is set', () => {
    render(<Textarea disabled data-testid="ta" />);
    expect(screen.getByTestId('ta')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Textarea className="custom" data-testid="ta" />);
    expect(screen.getByTestId('ta')).toHaveClass('custom');
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Textarea ref={ref} />);
    expect(ref).toHaveBeenCalled();
  });

  it('applies default styling classes', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta')).toHaveClass('rounded-md', 'border');
  });
});
