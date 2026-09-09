import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function FashionLoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await login(email, password, 'fashion');
      navigate('/fashion', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fashion login failed');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
      <form onSubmit={submit} className="mx-auto max-w-md rounded-2xl border border-pink-400/20 bg-slate-900 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-300">Omni Core Fashion</p>
        <h1 className="mt-3 text-3xl font-semibold">Fashion workspace</h1>
        <p className="mt-2 text-sm text-slate-400">Use an account explicitly provisioned for Fashion.</p>
        <label className="mt-8 block text-sm text-slate-300">Email<input className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="mt-4 block text-sm text-slate-300">Password<input className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <button className="mt-6 w-full rounded-lg bg-pink-500 px-4 py-2.5 font-semibold text-white disabled:opacity-50" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Enter Fashion workspace'}</button>
      </form>
    </main>
  );
}
