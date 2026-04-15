import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserFrame } from '../BrowserFrame';

describe('BrowserFrame', () => {
  it('renders loading state when isLoading and no imageUrl', () => {
    render(<BrowserFrame isLoading />);
    expect(screen.getByText('Connecting to browser stream...')).toBeInTheDocument();
  });

  it('shows URL in loading state when provided', () => {
    render(<BrowserFrame isLoading url="https://example.com" />);
    expect(screen.getByText('URL: https://example.com')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<BrowserFrame error="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText(/Check browser console/)).toBeInTheDocument();
  });

  it('renders image when imageUrl provided', () => {
    render(<BrowserFrame imageUrl="data:image/png;base64,abc" />);
    const img = screen.getByAltText('Browser preview');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc');
  });

  it('renders idle state when no props', () => {
    render(<BrowserFrame />);
    expect(screen.getByText('Waiting for browser frames...')).toBeInTheDocument();
  });

  it('shows URL in idle state when provided', () => {
    render(<BrowserFrame url="https://test.com" />);
    expect(screen.getByText('URL: https://test.com')).toBeInTheDocument();
  });

  it('image has correct styling classes', () => {
    render(<BrowserFrame imageUrl="data:image/png;base64,abc" />);
    const img = screen.getByAltText('Browser preview');
    expect(img).toHaveClass('rounded-lg');
    expect(img).toHaveClass('border');
    expect(img).toHaveClass('border-border');
  });
});
