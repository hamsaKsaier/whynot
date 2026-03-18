import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { FiLoader } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

/**
 * Wrap all routes that require authentication.
 * Shows a full-page spinner while auth is being verified,
 * redirects to /login if not authenticated.
 */
export const ProtectedRoute: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <FiLoader className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/landing" replace />;
  }

  return <Outlet />;
};
