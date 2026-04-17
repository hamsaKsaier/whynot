import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiZap, FiLoader } from 'react-icons/fi';

/**
 * Handles the redirect back from OAuth providers (GitHub/Google).
 * The gateway redirects to: /auth/callback?token=<jwt>
 * We store the token and send the user to the home page.
 */
export const AuthCallbackPage: React.FC = () => {
  const { t } = useTranslation('common');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      localStorage.setItem('auth_token', token);
      window.location.href = '/';
    } else if (error) {
      const msg = error === 'oauth_failed' ? t('auth.callback.oauthFailed') : t('auth.callback.signinFailed');
      window.location.href = `/login?message=${encodeURIComponent(msg)}`;
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl">
        <FiZap className="h-6 w-6 text-foreground" />
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <FiLoader className="h-5 w-5 animate-spin" />
        <span>{t('auth.callback.completing')}</span>
      </div>
    </div>
  );
};
