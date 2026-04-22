import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrollArea } from '../scroll-area';

describe('ScrollArea', () => {
  it('renders children', () => {
    render(
      <ScrollArea>
        <p>Scrollable content</p>
      </ScrollArea>,
    );
    expect(screen.getByText('Scrollable content')).toBeInTheDocument();
  });

  it('applies overflow-hidden class', () => {
    const { container } = render(
      <ScrollArea>
        <p>Content</p>
      </ScrollArea>,
    );
    expect(container.firstChild).toHaveClass('overflow-hidden');
  });

  it('merges custom className', () => {
    const { container } = render(
      <ScrollArea className="h-64">
        <p>Content</p>
      </ScrollArea>,
    );
    expect(container.firstChild).toHaveClass('h-64');
  });
});
