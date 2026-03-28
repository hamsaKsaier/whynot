import React, { useState } from 'react';
import { FiZap, FiLock, FiAlertCircle, FiLoader, FiCheck } from 'react-icons/fi';
import { useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../services/api';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-500 rounded-xl mb-3">
            <FiZap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WhyNot QA</h1>
          <p className="text-sm text-slate-500 mt-1">Reset your password</p>
        </div>

        <div className="bg-navy-800 rounded-2xl shadow-lg border border-navy-700 p-8">
          {success ? (
            <div>
              <div className="flex items-start gap-3 p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-lg mb-4">
                <FiCheck className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-emerald-300 font-medium">Password reset successfully</p>
                  <p className="text-sm text-slate-400 mt-1">You can now sign in with your new password.</p>
                </div>
              </div>
              <Link
                to="/login"
                className="block w-full py-2.5 px-4 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors text-center"
              >
                Go to Login
              </Link>
            </div>
          ) : !token ? (
            <div>
              <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400 mb-4">
                <FiAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Invalid reset link. Please request a new password reset.</span>
              </div>
              <Link
                to="/login"
                className="block w-full py-2.5 px-4 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 transition-colors text-center"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  New password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Confirm password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400">
                  <FiAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><FiLoader className="h-4 w-4 animate-spin" /> Resetting...</>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
