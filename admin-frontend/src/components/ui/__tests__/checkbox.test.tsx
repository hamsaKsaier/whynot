import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../checkbox';

describe('Checkbox', () => {
  it('renders a checkbox', () => {
    render(<Checkbox aria-label="Check me" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('is unchecked by default', () => {
    render(<Checkbox aria-label="Check" />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('can be checked', () => {
    render(<Checkbox checked aria-label="Check" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('handles check change', async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox onCheckedChange={onCheckedChange} aria-label="Check" />);
    await user.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Checkbox disabled aria-label="Check" />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Checkbox className="custom" aria-label="Check" />);
    expect(screen.getByRole('checkbox')).toHaveClass('custom');
  });
});
