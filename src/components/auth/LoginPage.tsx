/* ─── Login Page ──────────────────────────────────────────
 *  Email + password login with error handling.
 *  Public branding from GET /api/client-settings/branding.
 * ────────────────────────────────────────────────────────── */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import { usePublicBranding } from '../../hooks/usePublicBranding';
import { usePublicAuthConfig } from '../../hooks/usePublicAuthConfig';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const { branding, loading: brandingLoading } = usePublicBranding();
  const { config: authConfig } = usePublicAuthConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

  const logoSrc = branding.loginLogoUrl ?? branding.logoUrl;
  const tagline = branding.footerText ?? 'eBay listing management platform';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={branding.appName}
              className="h-14 mx-auto mb-3 object-contain"
            />
          ) : (
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold mb-3"
              style={{
                backgroundColor: branding.primaryColor,
                color: 'var(--brand-primary-fg)',
              }}
            >
              {(branding.shortName ?? branding.clientName).slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            {brandingLoading ? '…' : branding.appName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{tagline}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-6">
            Sign in to {branding.clientName}
          </h2>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ ['--tw-ring-color' as string]: 'var(--brand-primary)' }}
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium hover:opacity-80"
                  style={{ color: branding.primaryColor }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ ['--tw-ring-color' as string]: 'var(--brand-primary)' }}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors border-none"
              style={{
                backgroundColor: branding.primaryColor,
                color: 'var(--brand-primary-fg)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = branding.primaryColor;
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Sign in
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {authConfig.registrationEnabled ? (
              <>
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium hover:opacity-80"
                  style={{ color: branding.primaryColor }}
                >
                  Create one
                </Link>
              </>
            ) : (
              <span>Contact your administrator for an account.</span>
            )}
          </div>
        </div>

        {branding.poweredByVisible && (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">Powered by RealTrack</p>
        )}
      </div>
    </div>
  );
}
