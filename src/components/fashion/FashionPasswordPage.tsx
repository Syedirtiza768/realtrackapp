import { type FormEvent, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { authPatch } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';

const fieldClass =
  'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const fieldStyle = { ['--tw-ring-color' as string]: 'var(--brand-primary)' };

/** Mounted outside FashionShell so setup never starts protected workspace requests. */
export default function FashionPasswordPage() {
  const { user, refreshSession, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const businessIndustrial = location.pathname.startsWith('/business-industrial');
  const automotive = location.pathname.startsWith('/auto-parts');
  const workspacePath = businessIndustrial
    ? '/business-industrial'
    : automotive
      ? '/auto-parts'
      : '/fashion';
  const loginPath = `${workspacePath}/login`;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const accentClass = businessIndustrial ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-pink-500 hover:bg-pink-600';
  const eyebrowClass = businessIndustrial
    ? 'text-cyan-700'
    : automotive
      ? 'text-blue-700'
      : 'text-pink-600';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (Array.from(newPassword).length < 12 || new TextEncoder().encode(newPassword).length > 72) {
      setError('Use at least 12 characters and at most 72 UTF-8 bytes.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from your current password.');
      return;
    }
    setSaving(true);
    try {
      await authPatch('/api/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      await refreshSession();
      navigate(workspacePath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await logout();
    navigate(loginPath, { replace: true });
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-6 font-sans pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] dark:bg-slate-950">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${eyebrowClass}`}>
          {businessIndustrial ? 'Omni Core B&I' : automotive ? 'Omni Core Auto Parts' : 'Omni Core Fashion'}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-800 dark:text-slate-100 sm:text-3xl">Set your own password</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Change your temporary password before entering the workspace. Use at least 12 characters.</p>
        <p className="mt-4 break-all text-sm text-slate-600 dark:text-slate-300">{user?.email}</p>
        <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <label className="mt-6 block text-sm font-medium text-slate-700 dark:text-slate-200">Current password
          <input name="currentPassword" autoComplete="current-password" className={fieldClass} style={fieldStyle} type="password" required disabled={saving} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">New password
          <input name="newPassword" autoComplete="new-password" className={fieldClass} style={fieldStyle} type="password" minLength={12} required disabled={saving} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Confirm new password
          <input name="confirmation" autoComplete="new-password" className={fieldClass} style={fieldStyle} type="password" minLength={12} required disabled={saving} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        {error ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        ) : null}
        <button className={`mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold text-white disabled:opacity-50 sm:text-sm ${accentClass}`} disabled={saving} type="submit">
          {saving ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {saving ? 'Saving password…' : 'Save password and continue'}
        </button>
        <button className="mt-4 w-full min-h-11 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:hover:text-slate-200" disabled={saving} type="button" onClick={() => void signOut()}>Sign out</button>
      </form>
    </div>
  );
}
