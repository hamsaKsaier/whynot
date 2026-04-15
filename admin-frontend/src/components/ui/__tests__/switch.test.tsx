import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../switch';

describe('Switch', () => {
  it('renders a switch', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('is unchecked by default', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('can be checked', () => {
    render(<Switch checked aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('handles checked change', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch onCheckedChange={onCheckedChange} aria-label="Toggle" />);
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Switch disabled aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Switch className="data-[state=checked]:bg-green-600" aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toHaveClass('data-[state=checked]:bg-green-600');
  });

  it('has proper dimensions (h-6 w-11)', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch')).toHaveClass('h-6', 'w-11');
  });
});
