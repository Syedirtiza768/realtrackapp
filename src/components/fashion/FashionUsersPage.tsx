import { useEffect, useState, type FormEvent } from 'react';
import { fetchWithAuth } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';

type Assignment = { storeId: string; accessLevel: string };
type FashionUser = { userId: string; email: string; name: string | null; roleSlug: string; roleName: string; active: boolean; storeAssignments: Assignment[] };
type Store = { id: string; storeName: string; marketplaceId?: string | null };
const roles = ['fashion_operator', 'fashion_manager', 'fashion_admin'] as const;
const labelOf = (role: string) => role.replace('fashion_', 'Fashion ');
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';

function MemberEditor({ member, stores, storesReady, onSaved, onClose }: { member: FashionUser; stores: Store[]; storesReady: boolean; onSaved: (message: string) => void; onClose: () => void }) {
  const { permissions, user } = useAuth();
  const [role, setRole] = useState(member.roleSlug);
  const [storeIds, setStoreIds] = useState((member.storeAssignments ?? []).map((assignment) => assignment.storeId));
  const [accessLevel, setAccessLevel] = useState('view');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const self = user?.id === member.userId;
  const unknownStores = storeIds.filter((id) => !stores.some((store) => store.id === id));
  async function save(action: 'role' | 'stores' | 'deactivate') {
    if (busy || !member.active || (action === 'role' && (!permissions.includes('fashion.roles.manage') || self)) || (action === 'deactivate' && self) || (action === 'stores' && (!storesReady || unknownStores.length))) return;
    if (action === 'deactivate' && !window.confirm(`Deactivate ${member.email}? This revokes their account access.`)) return;
    setBusy(action); setError('');
    try {
      await fetchWithAuth(`/api/fashion/users/${encodeURIComponent(member.userId)}/${action}`, { method: 'PATCH',
        ...(action === 'deactivate' ? {} : { body: JSON.stringify(action === 'role' ? { role } : { storeIds, accessLevel }) }),
      });
      onSaved(action === 'deactivate' ? 'User deactivated.' : action === 'role' ? 'Fashion role updated.' : 'Store assignments saved.');
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(''); }
  }
  return <section className="mt-5 rounded-xl border border-pink-200 bg-white p-5 dark:border-pink-900 dark:bg-slate-900" aria-label="Manage Fashion member">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{member.name || member.email}</h2><button className={button} disabled={!!busy} onClick={onClose}>Close member</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
    <fieldset disabled={!!busy || !member.active} className="mt-4 space-y-5">
      <div><label className="block text-sm font-medium">Fashion role<select className={field} value={role} disabled={self || !permissions.includes('fashion.roles.manage')} onChange={(e) => setRole(e.target.value)}>{!roles.includes(member.roleSlug as typeof roles[number]) && <option value={member.roleSlug}>{member.roleName || member.roleSlug}</option>}{roles.map((value) => <option key={value} value={value}>{labelOf(value)}</option>)}</select></label>
        {permissions.includes('fashion.roles.manage') && <button className={`${button} mt-2`} disabled={self || role === member.roleSlug} onClick={() => void save('role')}>{busy === 'role' ? 'Saving role…' : 'Save role'}</button>}
        {self && <p className="mt-2 text-xs text-slate-500">Ask another Fashion administrator to change your role or deactivate your account.</p>}
      </div>
      <div><h3 className="text-sm font-medium">Assigned stores</h3><p className="mt-1 text-xs text-slate-500">Saving replaces assignments with the checked stores and applies the selected access level to all of them. No checked stores removes explicit assignments.</p>
        {!storesReady && <p className="mt-2 text-sm text-amber-700">Store access could not be loaded or is not permitted. Assignment changes are unavailable.</p>}
        {!!unknownStores.length && <p className="mt-2 text-sm text-amber-700">This member has assignments outside the available store list. Assignment editing is blocked to preserve them.</p>}
        <div className="my-3 space-y-2">{stores.map((store) => <label key={store.id} className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={!storesReady || !!unknownStores.length} checked={storeIds.includes(store.id)} onChange={(e) => setStoreIds((ids) => e.target.checked ? [...ids, store.id] : ids.filter((id) => id !== store.id))} /><span>{store.storeName} · {store.marketplaceId || 'Marketplace pending'}{member.storeAssignments?.find((a) => a.storeId === store.id) ? ` · current: ${member.storeAssignments.find((a) => a.storeId === store.id)?.accessLevel}` : ''}</span></label>)}</div>
        {storesReady && !stores.length && <p className="my-2 text-sm text-slate-500">No Fashion stores available.</p>}
        <label className="block text-sm">Access level<select className={field} value={accessLevel} disabled={!storesReady || !!unknownStores.length} onChange={(e) => setAccessLevel(e.target.value)}><option value="view">View</option><option value="operate">Operate</option><option value="admin">Store admin</option></select></label>
        <button className={`${button} mt-3`} disabled={!storesReady || !!unknownStores.length} onClick={() => void save('stores')}>{busy === 'stores' ? 'Saving stores…' : 'Save store assignments'}</button>
      </div>
      {!self && <button className={`${button} text-red-700 dark:text-red-400`} onClick={() => void save('deactivate')}>{busy === 'deactivate' ? 'Deactivating…' : 'Deactivate user'}</button>}
    </fieldset>
    {!member.active && <p className="mt-3 text-sm text-slate-500">This user is inactive.</p>}
  </section>;
}

export default function FashionUsersPage() {
  const { permissions } = useAuth();
  const canManage = permissions.includes('fashion.access') && permissions.includes('fashion.users.manage');
  const canRoles = permissions.includes('fashion.roles.manage');
  const canStores = permissions.includes('fashion.stores.view');
  const [users, setUsers] = useState<FashionUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesReady, setStoresReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storeError, setStoreError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<FashionUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('fashion_operator');
  const [storeIds, setStoreIds] = useState<string[]>([]);
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setStoreError(''); setStoresReady(false);
    fetchWithAuth<FashionUser[]>('/api/fashion/users', { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setUsers(data); })
      .catch((err) => { if (!controller.signal.aborted) setError(messageOf(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    if (canStores) void fetchWithAuth<Store[]>('/api/fashion/stores', { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setStores(data); setStoresReady(true); } })
      .catch((err) => { if (!controller.signal.aborted) setStoreError(messageOf(err)); });
    return () => controller.abort();
  }, [canManage, canStores, revision]);
  const saved = (text: string) => { setMessage(text); setSelected(null); setRevision((n) => n + 1); };
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canManage || creating || !email.trim() || password.length < 12) return;
    setCreating(true); setError(''); setMessage('');
    try {
      await fetchWithAuth('/api/fashion/users', { method: 'POST', body: JSON.stringify({
        email: email.trim(), ...(name.trim() ? { name: name.trim() } : {}), password, role: canRoles ? role : 'fashion_operator',
        ...(storesReady ? { storeIds } : {}),
      }) });
      setPassword(''); setName(''); setEmail(''); setRole('fashion_operator'); setStoreIds([]); setShowCreate(false);
      saved('Fashion user created. Provide their sign-in details through your secure account handover process.');
    } catch (err) { setError(messageOf(err)); }
    finally { setCreating(false); }
  }
  if (!canManage) return <p role="alert">You do not have permission to manage Fashion users.</p>;
  return <div><h1 className="text-3xl font-semibold">Fashion users</h1><p className="mt-2 text-slate-500">Create workspace accounts, assign Fashion roles and control store access.</p>
    {message && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p>}
    {storeError && <p role="alert" className="mt-3 text-sm text-amber-700">Store assignments unavailable: {storeError}</p>}
    <div className="my-5 flex gap-3"><button className={`${button} bg-pink-600 text-white`} disabled={!!selected || creating || showCreate} onClick={() => { setShowCreate(true); setMessage(''); }}>Create user</button><button className={button} disabled={loading || creating || !!selected || showCreate} onClick={() => setRevision((n) => n + 1)}>Refresh users</button></div>
    {showCreate && <form onSubmit={(e) => void create(e)} className="mb-6 space-y-4 rounded-xl bg-white p-5 dark:bg-slate-900"><h2 className="font-semibold">New Fashion account</h2><fieldset disabled={creating} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Name<input className={field} maxLength={160} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="text-sm">Email<input className={field} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="text-sm">Initial password<input className={field} type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><span className="mt-1 block text-xs text-slate-500">At least 12 characters. Never reuse an existing password.</span></label>
      <label className="text-sm">Fashion role<select className={field} value={role} disabled={!canRoles} onChange={(e) => setRole(e.target.value)}>{roles.map((value) => <option key={value} value={value}>{labelOf(value)}</option>)}</select></label>
      {storesReady && <div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Initial store assignments</p>{stores.map((store) => <label key={store.id} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={storeIds.includes(store.id)} onChange={(e) => setStoreIds((ids) => e.target.checked ? [...ids, store.id] : ids.filter((id) => id !== store.id))} />{store.storeName}</label>)}{!stores.length && <p className="text-sm text-slate-500">No Fashion stores connected yet.</p>}</div>}
    </fieldset><div className="flex gap-3"><button type="submit" className={`${button} bg-pink-600 text-white`} disabled={creating}>{creating ? 'Creating…' : 'Create Fashion user'}</button><button type="button" className={button} disabled={creating} onClick={() => { setShowCreate(false); setPassword(''); }}>Cancel</button></div></form>}
    {loading && <p role="status">Loading Fashion users…</p>}
    {!loading && !error && <div className="space-y-3">{users.map((member) => <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 dark:bg-slate-900" key={member.userId}><div><p className="font-medium">{member.name || member.email}</p><p className="text-sm text-slate-500">{member.email} · {member.roleName || labelOf(member.roleSlug)} · {member.active ? 'Active' : 'Inactive'}</p><p className="text-xs text-slate-500">{member.storeAssignments?.length ?? 0} explicit store assignments</p></div><button className={button} disabled={!!selected || showCreate} onClick={() => { setSelected(member); setMessage(''); }}>Manage user</button></div>)}{!users.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 dark:bg-slate-900">No Fashion workspace members found. Create the first account above.</p>}</div>}
    {selected && <MemberEditor key={selected.userId} member={selected} stores={stores} storesReady={storesReady} onSaved={saved} onClose={() => setSelected(null)} />}
  </div>;
}
