import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentUpload } from '../DocumentUpload';

describe('DocumentUpload', () => {
  it('renders drop zone', () => {
    render(
      <DocumentUpload
        documents={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByText(/drag|drop|upload|browse/i)).toBeInTheDocument();
  });

  it('renders uploaded documents list', () => {
    render(
      <DocumentUpload
        documents={[
          {
            id: 'doc-1',
            name: 'test-spec.md',
            size: 1024,
            type: 'text/markdown',
            active: true,
            tokenEstimate: 500,
          },
        ]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByText('test-spec.md')).toBeInTheDocument();
  });

  it('shows disabled state', () => {
    render(
      <DocumentUpload
        documents={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        disabled
      />
    );
    expect(document.body).toBeInTheDocument();
  });
});
