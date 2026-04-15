import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DateRangePicker } from '../DateRangePicker';

describe('DateRangePicker', () => {
  const defaultProps = {
    value: { from: '2024-01-01', to: '2024-01-31' },
    onChange: vi.fn(),
  };

  it('renders button with date range label', () => {
    render(<DateRangePicker {...defaultProps} />);
    expect(screen.getByText('2024-01-01 — 2024-01-31')).toBeInTheDocument();
  });

  it('renders "Select date range" when no dates are set', () => {
    render(
      <DateRangePicker value={{ from: '', to: '' }} onChange={vi.fn()} />
    );
    expect(screen.getByText('Select date range')).toBeInTheDocument();
  });

  it('renders preset buttons in popover when clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /2024-01-01/ }));
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
    expect(screen.getByText('This year')).toBeInTheDocument();
  });

  it('renders From and To labels in popover', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /2024-01-01/ }));
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
  });

  it('renders Apply button in popover', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /2024-01-01/ }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('calls onChange when a preset button is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangePicker value={{ from: '2024-01-01', to: '2024-01-31' }} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /2024-01-01/ }));
    await user.click(screen.getByText('Last 7 days'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(arg).toHaveProperty('from');
    expect(arg).toHaveProperty('to');
    // 'from' should be a date string, 'to' should be today
    expect(typeof arg.from).toBe('string');
    expect(typeof arg.to).toBe('string');
  });
});
