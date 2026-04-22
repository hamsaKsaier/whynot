import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DirectionProvider, useDirectionContext } from '../DirectionProvider';

vi.mock('../../hooks/useDirection', () => ({
  useDirection: vi.fn(() => ({
    direction: 'ltr' as const,
    setDirection: vi.fn(),
    isRtl: false,
  })),
}));

function TestConsumer() {
  const { direction, isRtl } = useDirectionContext();
  return (
    <div>
      <span data-testid="direction">{direction}</span>
      <span data-testid="isRtl">{String(isRtl)}</span>
    </div>
  );
}

describe('DirectionProvider', () => {
  it('provides direction context to children', () => {
    render(
      <DirectionProvider>
        <TestConsumer />
      </DirectionProvider>,
    );
    expect(screen.getByTestId('direction').textContent).toBe('ltr');
    expect(screen.getByTestId('isRtl').textContent).toBe('false');
  });

  it('renders children', () => {
    render(
      <DirectionProvider>
        <span>Child content</span>
      </DirectionProvider>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('throws when useDirectionContext is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useDirectionContext must be used within a DirectionProvider',
    );
    spy.mockRestore();
  });
});
