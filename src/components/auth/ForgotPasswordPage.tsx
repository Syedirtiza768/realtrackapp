/* ─── Forgot Password Page ────────────────────────────────
 *  Submit email for password reset link.
 *  Shows success confirmation after submission.
 * ────────────────────────────────────────────────────────── */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">MergeKart</h1>
          <p className="text-sm text-slate-500 mt-1">Password recovery</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {sent ? (
            /* Success state */
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Check your email</h2>
              <p className="text-sm text-slate-500">
                If an account exists for <span className="font-medium text-slate-700">{email}</span>,
                we've sent a password reset link. Please check your inbox and spam folder.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Reset your password</h2>
              <p className="text-sm text-slate-500 mb-6">
                Enter the email address associated with your account and we'll send a reset link.
              </p>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-red-50 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
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
