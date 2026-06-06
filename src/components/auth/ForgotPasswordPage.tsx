/* ─── Forgot Password Page ────────────────────────────────
 *  Submit email for password reset link.
 *  Shows success confirmation after submission.
 * ────────────────────────────────────────────────────────── */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { usePublicBranding } from '../../hooks/usePublicBranding';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const { branding, loading: brandingLoading } = usePublicBranding();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            {brandingLoading ? '…' : branding.appName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Password recovery</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          {sent ? (
            /* Success state */
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Check your email</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                If an account exists for <span className="font-medium text-slate-700 dark:text-slate-200">{email}</span>,
                we've sent a password reset link. Please check your inbox and spam folder.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80"
                style={{ color: branding.primaryColor }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">Reset your password</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Enter the email address associated with your account and we'll send a reset link.
              </p>

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
                    <Mail className="w-4 h-4" />
                  )}
                  Send reset link
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
