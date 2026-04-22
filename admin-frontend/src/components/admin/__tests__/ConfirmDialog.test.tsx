import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Delete Item',
    description: 'Are you sure you want to delete this item?',
    onConfirm: vi.fn(),
  };

  it('renders title and description when open', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
  });

  it('renders default confirm button text', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('renders custom confirm button text', () => {
    render(<ConfirmDialog {...defaultProps} confirmText="Delete Forever" />);
    expect(screen.getByRole('button', { name: 'Delete Forever' })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange with false when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows loading state', () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);
    expect(screen.getByRole('button', { name: 'Processing...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  describe('type-to-confirm', () => {
    it('disables confirm button until text matches', () => {
      render(
        <ConfirmDialog {...defaultProps} typeToConfirm="DELETE" />
      );
      const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmBtn).toBeDisabled();
    });

    it('renders the type-to-confirm label', () => {
      render(
        <ConfirmDialog {...defaultProps} typeToConfirm="DELETE" />
      );
      expect(screen.getByText(/DELETE/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Type.*DELETE.*to confirm/)).toBeInTheDocument();
    });

    it('enables confirm button when typed text matches', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialog {...defaultProps} typeToConfirm="DELETE" />
      );

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'DELETE');

      const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmBtn).not.toBeDisabled();
    });

    it('keeps confirm button disabled when typed text does not match', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialog {...defaultProps} typeToConfirm="DELETE" />
      );

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'DELET');

      const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmBtn).toBeDisabled();
    });

    it('calls onConfirm after typing correct text and clicking confirm', async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();
      render(
        <ConfirmDialog {...defaultProps} onConfirm={onConfirm} typeToConfirm="DELETE" />
      );

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'DELETE');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
