import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders trialing status', () => {
    render(<StatusBadge status="trialing" />);
    expect(screen.getByText('Trialing')).toBeInTheDocument();
  });

  it('renders past_due status with translated label', () => {
    render(<StatusBadge status="past_due" />);
    expect(screen.getByText('Past Due')).toBeInTheDocument();
  });

  it('renders canceled status', () => {
    render(<StatusBadge status="canceled" />);
    expect(screen.getByText('Canceled')).toBeInTheDocument();
  });

  it('renders unknown status with fallback styling', () => {
    render(<StatusBadge status="something_unknown" />);
    expect(screen.getByText('something unknown')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge status="active" className="extra-class" />);
    const badge = container.querySelector('.extra-class');
    expect(badge).toBeInTheDocument();
  });

  it('renders as a badge with capitalize class', () => {
    const { container } = render(<StatusBadge status="active" />);
    const badge = container.querySelector('.capitalize');
    expect(badge).toBeInTheDocument();
  });
});
