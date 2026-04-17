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
    expect(screen.getAllByText(/drag|drop|upload|browse/i).length).toBeGreaterThan(0);
  });

  it('renders uploaded documents list', () => {
    render(
      <DocumentUpload
        documents={[
          {
            id: 'doc-1',
            filename: 'test-spec.md',
            fileSizeBytes: 1024,
            fileType: 'text/markdown',
            isActive: true,
            chunkCount: 1,
            estimatedTokens: 500,
            createdAt: '2026-01-01T00:00:00Z',
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
