import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, MoreHorizontal, UserPlus } from 'lucide-react';
import Can from '../auth/Can';
import ProtectedRoute from '../auth/ProtectedRoute';
import {
  assignUserRole,
  createRbacUser,
  deactivateUser,
  listRbacRoles,
  listRbacUsers,
  type RbacRole,
  type RbacUser,
} from '../../lib/rbacApi';

export default function UsersAdminPage() {
  return (
    <ProtectedRoute permissions={['users.view']}>
      <UsersAdmin />
    </ProtectedRoute>
  );
}

function UsersAdmin() {
  const [users, setUsers] = useState<RbacUser[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleEditUser, setRoleEditUser] = useState<RbacUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, roleList] = await Promise.all([
        listRbacUsers(),
        listRbacRoles(),
      ]);
      setUsers(userList);
      setRoles(roleList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Users & roles</h2>
          <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">
            Create users, assign roles, and deactivate accounts.
          </p>
        </div>
        <Can permission="users.create">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <UserPlus className="h-4 w-4" />
            Create user
          </button>
        </Can>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-white/80 dark:bg-slate-900/80 text-slate-400 dark:text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/40 dark:bg-slate-900/40">
                <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{u.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{u.email}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                  {u.profile?.roleName ?? u.profile?.roleSlug ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={u.active ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Can permission="roles.assign">
                      <button
                        type="button"
                        title="Change role"
                        onClick={() => setRoleEditUser(u)}
                        className="p-1.5 rounded text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:bg-slate-800"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateUserModal
          roles={roles}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      )}

      {roleEditUser && (
        <EditRoleModal
          user={roleEditUser}
          roles={roles}
          onClose={() => setRoleEditUser(null)}
          onSaved={() => {
            setRoleEditUser(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function CreateUserModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: RbacRole[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleSlug, setRoleSlug] = useState(roles[0]?.slug ?? 'staff');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const result = await createRbacUser({
      email: email.trim(),
      password,
      name: name.trim() || undefined,
      roleSlug,
    });
    setBusy(false);
    if ('error' in result) {
      setErr(result.error);
      return;
    }
    onCreated();
  };

  return (
    <Modal title="Create user" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {err && <p className="text-sm text-red-400">{err}</p>}
        <label className="block text-sm">
          <span className="text-slate-400 dark:text-slate-400">Email</span>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400 dark:text-slate-400">Name</span>
          <input
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400 dark:text-slate-400">Password</span>
          <input
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400 dark:text-slate-400">Role</span>
          <select
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={roleSlug}
            onChange={(e) => setRoleSlug(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditRoleModal({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: RbacUser;
  roles: RbacRole[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roleSlug, setRoleSlug] = useState(
    user.profile?.roleSlug ?? roles[0]?.slug ?? 'staff',
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const saveRole = async () => {
    setBusy(true);
    setErr(null);
    const result = await assignUserRole(user.id, roleSlug);
    setBusy(false);
    if ('error' in result) {
      setErr(result.error);
      return;
    }
    onSaved();
  };

  const deactivate = async () => {
    if (!user.active) return;
    if (!window.confirm(`Deactivate ${user.email}?`)) return;
    setBusy(true);
    setErr(null);
    const result = await deactivateUser(user.id);
    setBusy(false);
    if ('error' in result) {
      setErr(result.error);
      return;
    }
    onSaved();
  };

  return (
    <Modal title={`Manage ${user.email}`} onClose={onClose}>
      <div className="space-y-4">
        {err && <p className="text-sm text-red-400">{err}</p>}
        <label className="block text-sm">
          <span className="text-slate-400 dark:text-slate-400">Role</span>
          <select
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={roleSlug}
            onChange={(e) => setRoleSlug(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Can permission="users.deactivate">
            {user.active && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void deactivate()}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Deactivate user
              </button>
            )}
          </Can>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:text-slate-200"
            >
              Cancel
            </button>
            <Can permission="roles.assign">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveRole()}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {busy ? 'Saving…' : 'Save role'}
              </button>
            </Can>
          </div>
        </div>
      </div>
    </Modal>
  );
}
