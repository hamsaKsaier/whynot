import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StatsCard } from '../StatsCard';

describe('StatsCard', () => {
  it('renders title and value', () => {
    render(<StatsCard title="Total Tests" value={42} />);
    expect(screen.getByText('Total Tests')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<StatsCard title="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('formats large numbers with K suffix', () => {
    render(<StatsCard title="Users" value={1500} />);
    expect(screen.getByText('1.5K')).toBeInTheDocument();
  });

  it('formats very large numbers with M suffix', () => {
    render(<StatsCard title="Requests" value={2500000} />);
    expect(screen.getByText('2.5M')).toBeInTheDocument();
  });

  it('renders change indicator when provided', () => {
    render(
      <StatsCard
        title="Revenue"
        value={100}
        change={{ value: 15, isPositive: true }}
      />
    );
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <StatsCard
        title="Tests"
        value={10}
        icon={<span data-testid="icon">icon</span>}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('is clickable when onClick is provided', () => {
    const onClick = vi.fn();
    render(<StatsCard title="Tests" value={10} onClick={onClick} />);

    // Find the card element by role="button" (Card component adds it when clickable)
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatsCard title="Test" value={1} className="my-card" />
    );
    // The Card component receives the className
    expect(container.innerHTML).toContain('my-card');
  });
});
