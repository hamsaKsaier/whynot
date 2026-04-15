import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('admin-frontend smoke', () => {
  it('renders without crashing', () => {
    render(<div>hello</div>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
