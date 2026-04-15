import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultToast = {
    id: 'toast-1',
    type: 'success' as const,
    message: 'Operation successful',
  };

  it('renders message', () => {
    render(<Toast toast={defaultToast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Toast
        toast={{ ...defaultToast, title: 'Success!' }}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('has alert role', () => {
    render(<Toast toast={defaultToast} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={defaultToast} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('auto-dismisses after default duration (5000ms)', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={defaultToast} onDismiss={onDismiss} />);

    vi.advanceTimersByTime(5000);
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('auto-dismisses after custom duration', () => {
    const onDismiss = vi.fn();
    render(
      <Toast toast={{ ...defaultToast, duration: 2000 }} onDismiss={onDismiss} />
    );

    vi.advanceTimersByTime(2000);
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('does not auto-dismiss when duration is 0', () => {
    const onDismiss = vi.fn();
    render(
      <Toast toast={{ ...defaultToast, duration: 0 }} onDismiss={onDismiss} />
    );

    vi.advanceTimersByTime(10000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders success toast with correct styles', () => {
    render(<Toast toast={{ ...defaultToast, type: 'success' }} onDismiss={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('border');
  });

  it('renders error toast', () => {
    render(<Toast toast={{ ...defaultToast, type: 'error' }} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders warning toast', () => {
    render(<Toast toast={{ ...defaultToast, type: 'warning' }} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders info toast', () => {
    render(<Toast toast={{ ...defaultToast, type: 'info' }} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
