import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../label';

describe('Label', () => {
  it('renders label with text', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    render(<Label>Test</Label>);
    expect(screen.getByText('Test')).toHaveClass('text-sm', 'font-medium');
  });

  it('supports htmlFor attribute', () => {
    render(<Label htmlFor="email">Email</Label>);
    expect(screen.getByText('Email')).toHaveAttribute('for', 'email');
  });

  it('merges custom className', () => {
    render(<Label className="custom">Test</Label>);
    expect(screen.getByText('Test')).toHaveClass('custom');
  });
});
