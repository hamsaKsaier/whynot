import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="No items"
        description="You have no items yet."
      />
    );

    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('You have no items yet.')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <EmptyState
        icon={<span data-testid="test-icon">icon</span>}
        title="Empty"
        description="Nothing here"
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Empty"
        description="Nothing here"
        action={<button>Create</button>}
      />
    );

    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('does not render action when not provided', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Empty"
        description="Nothing here"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders tip when provided', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Empty"
        description="Nothing here"
        tip="Try creating something first"
      />
    );

    expect(screen.getByText(/Try creating something first/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState
        icon={<span>icon</span>}
        title="Empty"
        description="Nothing here"
        className="my-class"
      />
    );

    expect(container.firstChild).toHaveClass('my-class');
  });

  it('renders with sm size', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Empty"
        description="Nothing here"
        size="sm"
      />
    );

    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('renders with lg size', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Empty"
        description="Nothing here"
        size="lg"
      />
    );

    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});
