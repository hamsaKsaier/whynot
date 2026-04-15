import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../theme-toggle';

const mockToggle = vi.fn();

vi.mock('../../ThemeProvider', () => ({
  useThemeContext: vi.fn(() => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
    toggle: mockToggle,
  })),
}));

import { useThemeContext } from '../../ThemeProvider';

describe('ThemeToggle', () => {
  it('renders toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has accessible label for light mode', () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
  });

  it('has accessible label for dark mode', () => {
    vi.mocked(useThemeContext).mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: vi.fn(),
      toggle: mockToggle,
    });
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument();
  });

  it('calls toggle on click', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    render(<ThemeToggle className="extra" />);
    expect(screen.getByRole('button')).toHaveClass('extra');
  });
});
