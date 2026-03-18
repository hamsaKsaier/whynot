import React, { useState } from 'react';
import { FiZap, FiGithub, FiMail, FiLock, FiUser, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register';

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        window.location.href = '/';
      } else {
        if (!name.trim()) {
          setError('Name is required');
          return;
        }
        await register(email, password, name);
        window.location.href = '/';
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong';
      setError(msg);
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
          <p className="text-sm text-gray-400 mt-1">AI-powered test automation</p>
        </div>

        <div className="bg-navy-800 rounded-2xl shadow-lg border border-navy-700 p-8">
          {/* Tab selector */}
          <div className="flex rounded-lg border border-navy-700 p-1 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => { setMode('login'); setError(null); }}
            >
              Sign in
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => { setMode('register'); setError(null); }}
            >
              Create account
            </button>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3 mb-6">
            <a
              href={`${apiBase}/auth/github`}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-navy-700 rounded-lg text-sm font-medium text-gray-200 hover:bg-navy-700 transition-colors"
            >
              <FiGithub className="h-5 w-5" />
              Continue with GitHub
            </a>
            <a
              href={`${apiBase}/auth/google`}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-navy-700 rounded-lg text-sm font-medium text-gray-200 hover:bg-navy-700 transition-colors"
            >
              <FcGoogle className="h-5 w-5" />
              Continue with Google
            </a>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-navy-700" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-navy-700" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Full name
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email address
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-4 py-2.5 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
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
                <>
                  <FiLoader className="h-4 w-4 animate-spin" />
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : mode === 'login' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
