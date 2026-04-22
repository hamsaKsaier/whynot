import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardShortcutsDialog } from '../KeyboardShortcutsDialog';

describe('KeyboardShortcutsDialog', () => {
  it('renders when open', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<KeyboardShortcutsDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('displays all shortcuts', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Space')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('Escape')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
  });

  it('displays shortcut descriptions', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Pause / Resume execution')).toBeInTheDocument();
    expect(screen.getByText('Rerun test')).toBeInTheDocument();
    expect(screen.getByText('Close detail dialog')).toBeInTheDocument();
    expect(screen.getByText('Show this dialog')).toBeInTheDocument();
    expect(screen.getByText('Toggle fullscreen preview')).toBeInTheDocument();
  });

  it('renders kbd elements with correct styling', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={vi.fn()} />);
    const kbdElements = screen.getAllByText('Space')[0].closest('kbd');
    expect(kbdElements).toHaveClass('bg-muted');
    expect(kbdElements).toHaveClass('border');
    expect(kbdElements).toHaveClass('rounded-md');
    expect(kbdElements).toHaveClass('font-mono');
  });

  it('has a table structure', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('calls onOpenChange when closing', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<KeyboardShortcutsDialog open onOpenChange={onOpenChange} />);
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
