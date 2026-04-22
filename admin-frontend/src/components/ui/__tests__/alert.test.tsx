import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../alert';

describe('Alert', () => {
  it('renders alert with content', () => {
    render(<Alert>Alert content</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    render(<Alert>Test</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('bg-background');
  });

  it('applies destructive variant', () => {
    render(<Alert variant="destructive">Error</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('text-destructive');
  });

  it('merges custom className', () => {
    render(<Alert className="custom">Test</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('custom');
  });
});

describe('AlertTitle', () => {
  it('renders title as h5', () => {
    render(<AlertTitle>Title</AlertTitle>);
    expect(screen.getByText('Title').tagName).toBe('H5');
  });

  it('applies font-medium class', () => {
    render(<AlertTitle>Title</AlertTitle>);
    expect(screen.getByText('Title')).toHaveClass('font-medium');
  });
});

describe('AlertDescription', () => {
  it('renders description text', () => {
    render(<AlertDescription>Description</AlertDescription>);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('applies text-sm class', () => {
    render(<AlertDescription>Desc</AlertDescription>);
    expect(screen.getByText('Desc')).toHaveClass('text-sm');
  });
});
