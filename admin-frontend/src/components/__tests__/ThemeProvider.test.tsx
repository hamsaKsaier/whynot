import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../ThemeProvider';

vi.mock('../../hooks/useTheme', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light' as const,
    resolvedTheme: 'light' as const,
    setTheme: vi.fn(),
    toggle: vi.fn(),
  })),
}));

function TestConsumer() {
  const { theme, resolvedTheme } = useThemeContext();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('provides theme context to children', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('resolved').textContent).toBe('light');
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
        <span>Child content</span>
      </ThemeProvider>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('throws when useThemeContext is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useThemeContext must be used within a ThemeProvider',
    );
    spy.mockRestore();
  });
});
