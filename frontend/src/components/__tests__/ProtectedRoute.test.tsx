import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

let mockAuthState = { isLoading: false, isAuthenticated: false };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">Navigate to {to}</div>,
  Outlet: () => <div data-testid="outlet">Protected Content</div>,
}));

import { ProtectedRoute } from '../ProtectedRoute';

describe('ProtectedRoute', () => {
  it('shows loading spinner when auth is loading', () => {
    mockAuthState = { isLoading: true, isAuthenticated: false };
    render(<ProtectedRoute />);

    // Should show spinner (Loader2 component)
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
  });

  it('redirects to / when not authenticated', () => {
    mockAuthState = { isLoading: false, isAuthenticated: false };
    render(<ProtectedRoute />);

    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByText('Navigate to /')).toBeInTheDocument();
  });

  it('renders Outlet when authenticated', () => {
    mockAuthState = { isLoading: false, isAuthenticated: true };
    render(<ProtectedRoute />);

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
