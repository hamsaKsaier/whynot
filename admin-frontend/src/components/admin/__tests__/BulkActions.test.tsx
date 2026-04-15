import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BulkActions } from '../BulkActions';

describe('BulkActions', () => {
  const defaultActions = [
    { label: 'Delete', onClick: vi.fn() },
    { label: 'Archive', onClick: vi.fn() },
  ];

  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(
      <BulkActions selectedCount={0} actions={defaultActions} onClear={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders selected count when selectedCount > 0', () => {
    render(
      <BulkActions selectedCount={5} actions={defaultActions} onClear={vi.fn()} />
    );
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('renders Actions dropdown button', () => {
    render(
      <BulkActions selectedCount={3} actions={defaultActions} onClear={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument();
  });

  it('shows action items in dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(
      <BulkActions selectedCount={3} actions={defaultActions} onClear={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /actions/i }));
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('calls action onClick when dropdown item is clicked', async () => {
    const deleteAction = vi.fn();
    const actions = [
      { label: 'Delete', onClick: deleteAction },
    ];
    const user = userEvent.setup();
    render(
      <BulkActions selectedCount={2} actions={actions} onClear={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /actions/i }));
    await user.click(screen.getByText('Delete'));
    expect(deleteAction).toHaveBeenCalledTimes(1);
  });

  it('renders Clear button', () => {
    render(
      <BulkActions selectedCount={2} actions={defaultActions} onClear={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('calls onClear when Clear button is clicked', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActions selectedCount={2} actions={defaultActions} onClear={onClear} />
    );

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
