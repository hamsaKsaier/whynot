import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, AvatarFallback } from '../avatar';

describe('Avatar', () => {
  it('renders avatar root', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(container.firstChild).toHaveClass('rounded-full');
  });

  it('renders avatar with custom class', () => {
    const { container } = render(
      <Avatar className="h-8 w-8">
        <AvatarFallback>X</AvatarFallback>
      </Avatar>,
    );
    expect(container.firstChild).toHaveClass('h-8', 'w-8');
  });
});

describe('AvatarFallback', () => {
  it('renders fallback text', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('applies bg-muted class', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('JD')).toHaveClass('bg-muted');
  });
});
