import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SearchInput } from '../SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Search tests..." />);
    expect(screen.getByPlaceholderText('Search tests...')).toBeInTheDocument();
  });

  it('renders default placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<SearchInput value="hello" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('has search aria-label', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('debounces onChange calls', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} debounceMs={300} />);

    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should not call immediately
    expect(onChange).not.toHaveBeenCalled();

    // Should call after debounce
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('shows clear button when there is a value', () => {
    render(<SearchInput value="test" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('does not show clear button when value is empty', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('clears value when clear button is clicked', () => {
    const onChange = vi.fn();
    render(<SearchInput value="test" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
