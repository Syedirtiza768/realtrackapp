import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authPatch } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';

/** Mounted outside FashionShell so setup never starts protected workspace requests. */
export default function FashionPasswordPage() {
  const { user, refreshSession, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
      navigate('/fashion', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await logout();
    navigate('/fashion/login', { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
      <form onSubmit={submit} className="mx-auto max-w-md rounded-2xl border border-pink-400/20 bg-slate-900 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-300">Omni Core Fashion</p>
        <h1 className="mt-3 text-3xl font-semibold">Set your own password</h1>
        <p className="mt-2 text-sm text-slate-400">Change your temporary password before entering the workspace. Use at least 12 characters.</p>
        <p className="mt-4 break-all text-sm text-slate-300">{user?.email}</p>
        <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <label className="mt-6 block text-sm text-slate-300">Current password
          <input name="currentPassword" autoComplete="current-password" className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2" type="password" required disabled={saving} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm text-slate-300">New password
          <input name="newPassword" autoComplete="new-password" className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2" type="password" minLength={12} required disabled={saving} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm text-slate-300">Confirm new password
          <input name="confirmation" autoComplete="new-password" className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2" type="password" minLength={12} required disabled={saving} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <button className="mt-6 w-full rounded-lg bg-pink-500 px-4 py-2.5 font-semibold disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Saving password…' : 'Save password and continue'}</button>
        <button className="mt-4 w-full text-sm text-slate-400 hover:text-white disabled:opacity-50" disabled={saving} type="button" onClick={() => void signOut()}>Sign out</button>
      </form>
    </main>
  );
}
