import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Helpful tip">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('does not show tooltip content initially', () => {
    render(
      <Tooltip content="Helpful tip">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not show tooltip when disabled', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful tip" disabled>
        <button>Hover me</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!);
    vi.advanceTimersByTime(500);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders wrapper with correct structure', () => {
    const { container } = render(
      <Tooltip content="Tip">
        <span>Target</span>
      </Tooltip>
    );

    expect(container.querySelector('.relative.inline-block')).toBeInTheDocument();
  });
});
