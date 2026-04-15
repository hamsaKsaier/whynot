import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

describe('Card', () => {
  it('renders card with children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    const { container } = render(<Card>Test</Card>);
    expect(container.firstChild).toHaveClass('rounded-lg', 'border', 'bg-card', 'shadow-sm');
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="custom">Test</Card>);
    expect(container.firstChild).toHaveClass('custom');
  });
});

describe('CardHeader', () => {
  it('renders header with children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    const { container } = render(<CardHeader>Test</CardHeader>);
    expect(container.firstChild).toHaveClass('flex', 'flex-col', 'p-6');
  });
});

describe('CardTitle', () => {
  it('renders title as h3', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title').tagName).toBe('H3');
  });

  it('applies font-semibold class', () => {
    const { container } = render(<CardTitle>Title</CardTitle>);
    expect(container.firstChild).toHaveClass('font-semibold');
  });
});

describe('CardDescription', () => {
  it('renders description text', () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('applies muted foreground class', () => {
    const { container } = render(<CardDescription>Desc</CardDescription>);
    expect(container.firstChild).toHaveClass('text-muted-foreground');
  });
});

describe('CardContent', () => {
  it('renders content', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('CardFooter', () => {
  it('renders footer', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('applies flex class', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveClass('flex', 'items-center');
  });
});
