import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

let flagValue = true;
vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => flagValue,
}));

vi.mock('@/pages/NotFoundPage', () => ({
  NotFoundPage: () => <div data-testid="not-found">Not Found</div>,
}));

import { ReconRoute } from '../ReconRoute';

function ChildPage() {
  return <div data-testid="recon-child">Recon child</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recon" element={<ReconRoute><ChildPage /></ReconRoute>} />
        <Route path="/recon/:scanId" element={<ReconRoute><ChildPage /></ReconRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReconRoute', () => {
  it('renders children when recon_enabled flag is true', () => {
    flagValue = true;
    renderAt('/recon');
    expect(screen.getByTestId('recon-child')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('renders NotFoundPage when recon_enabled flag is false (list route)', () => {
    flagValue = false;
    renderAt('/recon');
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('recon-child')).not.toBeInTheDocument();
  });

  it('renders NotFoundPage when recon_enabled flag is false (detail route)', () => {
    flagValue = false;
    renderAt('/recon/abc-123');
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('recon-child')).not.toBeInTheDocument();
  });

  it('renders children on detail route when flag is true', () => {
    flagValue = true;
    renderAt('/recon/abc-123');
    expect(screen.getByTestId('recon-child')).toBeInTheDocument();
  });
});
