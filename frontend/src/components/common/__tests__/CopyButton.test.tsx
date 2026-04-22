import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock useClipboard
const mockCopyToClipboard = vi.fn();
let mockCopied = false;

vi.mock('../../../hooks/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
    copied: mockCopied,
  }),
}));

import { CopyButton } from '../CopyButton';

describe('CopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopied = false;
  });

  it('renders icon variant by default', () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
  });

  it('calls copyToClipboard when clicked', () => {
    render(<CopyButton text="hello world" />);
    fireEvent.click(screen.getByLabelText('Copy to clipboard'));
    expect(mockCopyToClipboard).toHaveBeenCalledWith('hello world', {
      successMessage: undefined,
      errorMessage: undefined,
    });
  });

  it('passes custom messages to copyToClipboard', () => {
    render(
      <CopyButton
        text="test"
        successMessage="Copied URL!"
        errorMessage="Copy failed!"
      />
    );
    fireEvent.click(screen.getByLabelText('Copy to clipboard'));
    expect(mockCopyToClipboard).toHaveBeenCalledWith('test', {
      successMessage: 'Copied URL!',
      errorMessage: 'Copy failed!',
    });
  });

  it('renders button variant', () => {
    render(<CopyButton text="test" variant="button" />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('shows "Copied!" text when copied (button variant)', () => {
    mockCopied = true;
    render(<CopyButton text="test" variant="button" />);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<CopyButton text="test" className="my-copy" />);
    const button = screen.getByLabelText('Copy to clipboard');
    expect(button.className).toContain('my-copy');
  });
});
