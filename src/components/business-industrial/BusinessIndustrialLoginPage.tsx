import { FormEvent, useState } from 'react';
import { AlertCircle, Factory, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { usePublicBranding } from '../../hooks/usePublicBranding';
import { toProxyUrl } from '../../lib/imageUrl';

export default function BusinessIndustrialLoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { branding, loading: brandingLoading } = usePublicBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await login(email, password, 'business_industrial');
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith('/business-industrial') ? from : '/business-industrial', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Business & Industrial login failed');
    }
  }

  const logoSrc = branding.loginLogoUrl ?? branding.logoUrl;
  const fieldClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
  const fieldStyle = { ['--tw-ring-color' as string]: 'var(--brand-primary)' };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {logoSrc ? (
            <img src={toProxyUrl(logoSrc)} alt="" className="mx-auto mb-3 h-14 object-contain" />
          ) : (
            <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-600 text-white">
              <Factory size={28} aria-hidden="true" />
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Omni Core B&amp;I</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {brandingLoading ? 'Business & Industrial' : branding.appName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Business &amp; Industrial workspace. Use an account explicitly provisioned for this vertical.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-6 text-xl font-semibold text-slate-800 dark:text-slate-100">Sign in</h2>
          {error ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : null}
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Email
              <input className={fieldClass} style={fieldStyle} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Password
              <input className={fieldClass} style={fieldStyle} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}
              disabled={loading}
              type="submit"
            >
              {loading ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {loading ? 'Signing in…' : 'Enter B&I workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
