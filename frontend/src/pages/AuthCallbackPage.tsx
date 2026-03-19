import React, { useEffect } from 'react';
import { FiZap, FiLoader } from 'react-icons/fi';

/**
 * Handles the redirect back from OAuth providers (GitHub/Google).
 * The gateway redirects to: /auth/callback?token=<jwt>
 * We store the token and send the user to the home page.
 */
export const AuthCallbackPage: React.FC = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      localStorage.setItem('auth_token', token);
      window.location.href = '/';
    } else if (error) {
      const msg = error === 'oauth_failed' ? 'OAuth sign-in failed' : 'Sign-in could not be completed';
      window.location.href = `/login?message=${encodeURIComponent(msg)}`;
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl">
        <FiZap className="h-6 w-6 text-white" />
      </div>
      <div className="flex items-center gap-2 text-slate-400">
        <FiLoader className="h-5 w-5 animate-spin" />
        <span>Completing sign-in…</span>
      </div>
    </div>
  );
};
