import { useEffect, useState, type FormEvent } from 'react';
import { fetchWithAuth } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import FeedbackPanel from '../ui/FeedbackPanel';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { EmptyState, ErrorState, LoadingPlaceholder } from '../ui/StatusBlock';

type Assignment = { storeId: string; accessLevel: string };
type BusinessIndustrialUser = { userId: string; email: string; name: string | null; roleSlug: string; roleName: string; active: boolean; storeAssignments: Assignment[] };
type Store = { id: string; storeName: string; marketplaceId?: string | null };
const roles = ['business_industrial_operator', 'business_industrial_manager', 'business_industrial_admin'] as const;
const labelOf = (role: string) => role.replace('business_industrial_', 'B&I ');
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';

function MemberEditor({ member, stores, storesReady, onSaved, onClose }: { member: BusinessIndustrialUser; stores: Store[]; storesReady: boolean; onSaved: (message: string) => void; onClose: () => void }) {
  const { permissions, user } = useAuth();
  const [role, setRole] = useState(member.roleSlug);
  const [storeIds, setStoreIds] = useState((member.storeAssignments ?? []).map((assignment) => assignment.storeId));
  const [accessLevel, setAccessLevel] = useState('view');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const self = user?.id === member.userId;
  const unknownStores = storeIds.filter((id) => !stores.some((store) => store.id === id));
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  async function save(action: 'role' | 'stores' | 'deactivate', confirmed = false) {
    if (busy || !member.active || (action === 'role' && (!permissions.includes('business_industrial.roles.manage') || self)) || (action === 'deactivate' && self) || (action === 'stores' && (!storesReady || unknownStores.length))) return;
    if (action === 'deactivate' && !confirmed) { setConfirmDeactivate(true); return; }
    setBusy(action); setError('');
    try {
      await fetchWithAuth('/api/business-industrial/users/' + encodeURIComponent(member.userId) + '/' + action, {
        method: 'PATCH',
        ...(action === 'deactivate' ? {} : { body: JSON.stringify(action === 'role' ? { role } : { storeIds, accessLevel }) }),
      });
      onSaved(action === 'deactivate' ? 'User deactivated.' : action === 'role' ? 'B&I role updated.' : 'Store assignments saved.');
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(''); }
  }

  return <section className="mt-5 rounded-xl border border-cyan-200 bg-white p-5 dark:border-cyan-900 dark:bg-slate-900" aria-label="Manage Business and Industrial member">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{member.name || member.email}</h2><button className={button} disabled={!!busy} onClick={onClose}>Close member</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
    <fieldset disabled={!!busy || !member.active} className="mt-4 space-y-5">
      <div><label className="block text-sm font-medium">Business &amp; Industrial role<select className={field} value={role} disabled={self || !permissions.includes('business_industrial.roles.manage')} onChange={(event) => setRole(event.target.value)}>{!roles.includes(member.roleSlug as typeof roles[number]) && <option value={member.roleSlug}>{member.roleName || member.roleSlug}</option>}{roles.map((value) => <option key={value} value={value}>{labelOf(value)}</option>)}</select></label>
        {permissions.includes('business_industrial.roles.manage') && <button className={button + ' mt-2'} disabled={self || role === member.roleSlug} onClick={() => void save('role')}>{busy === 'role' ? 'Saving role…' : 'Save role'}</button>}
        {self && <p className="mt-2 text-xs text-slate-500">Ask another B&amp;I administrator to change your role or deactivate your account.</p>}
      </div>
      <div><h3 className="text-sm font-medium">Assigned stores</h3><p className="mt-1 text-xs text-slate-500">Saving replaces assignments with the checked dedicated B&amp;I stores. No checked stores removes explicit assignments.</p>
        {!storesReady && <p className="mt-2 text-sm text-amber-700">Store access could not be loaded or is not permitted. Assignment changes are unavailable.</p>}
        {!!unknownStores.length && <p className="mt-2 text-sm text-amber-700">This member has assignments outside the available store list. Editing is blocked to preserve them.</p>}
        <div className="my-3 space-y-2">{stores.map((store) => <label key={store.id} className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={!storesReady || !!unknownStores.length} checked={storeIds.includes(store.id)} onChange={(event) => setStoreIds((ids) => event.target.checked ? [...ids, store.id] : ids.filter((id) => id !== store.id))} /><span>{store.storeName} · {store.marketplaceId || 'Marketplace pending'}{member.storeAssignments?.find((assignment) => assignment.storeId === store.id) ? ' · current: ' + member.storeAssignments.find((assignment) => assignment.storeId === store.id)?.accessLevel : ''}</span></label>)}</div>
        {storesReady && !stores.length && <p className="my-2 text-sm text-slate-500">No dedicated B&amp;I stores available.</p>}
        <label className="block text-sm">Access level<select className={field} value={accessLevel} disabled={!storesReady || !!unknownStores.length} onChange={(event) => setAccessLevel(event.target.value)}><option value="view">View</option><option value="operate">Operate</option><option value="admin">Store admin</option></select></label>
        <button className={button + ' mt-3'} disabled={!storesReady || !!unknownStores.length} onClick={() => void save('stores')}>{busy === 'stores' ? 'Saving stores…' : 'Save store assignments'}</button>
      </div>
      {!self && <button className={button + ' text-red-700 dark:text-red-400'} onClick={() => void save('deactivate')}>{busy === 'deactivate' ? 'Deactivating…' : 'Deactivate user'}</button>}
    </fieldset>
    {!member.active && <p className="mt-3 text-sm text-slate-500">This user is inactive.</p>}
    <ConfirmDialog
      open={confirmDeactivate}
      title="Deactivate this account?"
      description={'Deactivate ' + member.email + '? This revokes their Business & Industrial access and does not grant Automotive or Fashion permissions to anyone else.'}
      confirmLabel="Deactivate user"
      tone="danger"
      busy={busy === 'deactivate'}
      onClose={() => setConfirmDeactivate(false)}
      onConfirm={() => { setConfirmDeactivate(false); void save('deactivate', true); }}
    />
  </section>;
}

export default function BusinessIndustrialUsersPage() {
  const { permissions } = useAuth();
  const canManage = permissions.includes('business_industrial.access') && permissions.includes('business_industrial.users.manage');
  const canRoles = permissions.includes('business_industrial.roles.manage');
  const canStores = permissions.includes('business_industrial.stores.view');
  const [users, setUsers] = useState<BusinessIndustrialUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesReady, setStoresReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storeError, setStoreError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<BusinessIndustrialUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('business_industrial_operator');
  const [storeIds, setStoreIds] = useState<string[]>([]);

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setStoreError(''); setStoresReady(false);
    fetchWithAuth<BusinessIndustrialUser[]>('/api/business-industrial/users', { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setUsers(data); }).catch((err) => { if (!controller.signal.aborted) setError(messageOf(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    if (canStores) void fetchWithAuth<Store[]>('/api/business-industrial/stores', { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) { setStores(data); setStoresReady(true); } }).catch((err) => { if (!controller.signal.aborted) setStoreError(messageOf(err)); });
    return () => controller.abort();
  }, [canManage, canStores, revision]);

  const saved = (text: string) => { setMessage(text); setSelected(null); setRevision((value) => value + 1); };
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canManage || creating || !email.trim() || password.length < 12) return;
    setCreating(true); setError(''); setMessage('');
    try {
      await fetchWithAuth('/api/business-industrial/users', { method: 'POST', body: JSON.stringify({ email: email.trim(), ...(name.trim() ? { name: name.trim() } : {}), password, role: canRoles ? role : 'business_industrial_operator', ...(storesReady ? { storeIds } : {}) }) });
      setPassword(''); setName(''); setEmail(''); setRole('business_industrial_operator'); setStoreIds([]); setShowCreate(false);
      saved('B&I user created. Provide sign-in details through your secure account handover process.');
    } catch (err) { setError(messageOf(err)); }
    finally { setCreating(false); }
  }

  if (!canManage) return <p role="alert">You do not have permission to manage Business &amp; Industrial users.</p>;
  return <div className="space-y-5"><WorkspacePageHeader title="Business &amp; Industrial users" subtitle="Create workspace accounts, assign vertical roles and dedicated store access, or revoke access without granting Automotive or Fashion permissions." />
    {message && <FeedbackPanel tone="success">{message}</FeedbackPanel>}
    {error && <ErrorState message={error} onRetry={() => setRevision((value) => value + 1)} />}
    {storeError && <FeedbackPanel tone="warning">Store assignments unavailable: {storeError}</FeedbackPanel>}
    <div className="flex gap-3"><button className={button} style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }} disabled={!!selected || creating || showCreate} onClick={() => { setShowCreate(true); setMessage(''); }}>Create user</button><button className={button} disabled={loading || creating || !!selected || showCreate} onClick={() => setRevision((value) => value + 1)}>Refresh users</button></div>
    {showCreate && <form onSubmit={(event) => void create(event)} className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-semibold">New B&amp;I account</h2><fieldset disabled={creating} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Name<input className={field} value={name} maxLength={200} onChange={(event) => setName(event.target.value)} /></label>
      <label className="text-sm">Email<input className={field} type="email" value={email} required maxLength={200} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="text-sm">Temporary password<input className={field} type="password" value={password} required minLength={12} maxLength={72} onChange={(event) => setPassword(event.target.value)} /><span className="text-xs text-slate-500">At least 12 characters; the user must change it after first sign-in.</span></label>
      <label className="text-sm">B&amp;I role<select className={field} value={role} disabled={!canRoles} onChange={(event) => setRole(event.target.value)}>{roles.map((value) => <option key={value} value={value}>{labelOf(value)}</option>)}</select></label>
      {storesReady && <div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Initial dedicated store assignments</p>{stores.map((store) => <label key={store.id} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={storeIds.includes(store.id)} onChange={(event) => setStoreIds((ids) => event.target.checked ? [...ids, store.id] : ids.filter((id) => id !== store.id))} />{store.storeName}</label>)}{!stores.length && <p className="text-sm text-slate-500">No dedicated B&amp;I stores connected yet.</p>}</div>}
    </fieldset><div className="flex gap-3">        <button type="submit" className={button} style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }} disabled={creating}>{creating ? 'Creating…' : 'Create B&I user'}</button><button type="button" className={button} disabled={creating} onClick={() => { setShowCreate(false); setPassword(''); }}>Cancel</button></div></form>}
    {loading && <LoadingPlaceholder label="Loading B&I users" />}
    {!loading && !error && <div className="space-y-3">{users.map((member) => <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" key={member.userId}><div><p className="font-medium">{member.name || member.email}</p><p className="text-sm text-slate-500">{member.email} · {member.roleName || labelOf(member.roleSlug)} · {member.active ? 'Active' : 'Inactive'}</p><p className="text-xs text-slate-500">{member.storeAssignments?.length ?? 0} explicit dedicated store assignments</p></div><button className={button} disabled={!!selected || showCreate} onClick={() => { setSelected(member); setMessage(''); }}>Manage user</button></div>)}{!users.length && <EmptyState title="No B&I workspace members found" description="Create the first account above." />}</div>}
    {selected && <MemberEditor member={selected} stores={stores} storesReady={storesReady} onSaved={saved} onClose={() => setSelected(null)} />}
  </div>;
}
