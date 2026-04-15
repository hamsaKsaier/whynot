import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ToastContainer } from '../ToastContainer';

describe('ToastContainer', () => {
  it('renders nothing when there are no toasts', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders toasts when present', () => {
    const toasts = [
      { id: '1', type: 'success' as const, message: 'First toast' },
      { id: '2', type: 'error' as const, message: 'Second toast' },
    ];

    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    const toasts = [
      { id: '1', type: 'info' as const, message: 'Test' },
    ];

    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    const container = screen.getByLabelText('Notifications');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });

  it('applies default top-right position', () => {
    const toasts = [
      { id: '1', type: 'info' as const, message: 'Test' },
    ];

    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);
    const container = screen.getByLabelText('Notifications');
    expect(container.className).toContain('top-4');
    expect(container.className).toContain('right-4');
  });

  it('applies custom position', () => {
    const toasts = [
      { id: '1', type: 'info' as const, message: 'Test' },
    ];

    render(
      <ToastContainer toasts={toasts} onDismiss={vi.fn()} position="bottom-left" />
    );
    const container = screen.getByLabelText('Notifications');
    expect(container.className).toContain('bottom-4');
    expect(container.className).toContain('left-4');
  });
});
