import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import ProtectedRoute from '../auth/ProtectedRoute';
import {
  listRbacPermissions,
  listRbacRoles,
  type RbacPermission,
  type RbacRole,
} from '../../lib/rbacApi';

export default function PermissionsPage() {
  return (
    <ProtectedRoute permissions={['roles.view']}>
      <PermissionsMatrix />
    </ProtectedRoute>
  );
}

function PermissionsMatrix() {
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perms, roleList] = await Promise.all([
        listRbacPermissions(),
        listRbacRoles(),
      ]);
      setPermissions(perms);
      setRoles(roleList);
      setSelectedRoleSlug((prev) => prev ?? roleList[0]?.slug ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byModule = useMemo(() => {
    const map = new Map<string, RbacPermission[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const selectedRole = roles.find((r) => r.slug === selectedRoleSlug);
  const permSet = useMemo(
    () => new Set(selectedRole?.permissions ?? []),
    [selectedRole],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
          Roles & permissions
        </h2>
        <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">
          Read-only matrix of which roles grant each permission. Role changes are managed on the
          Users page.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedRoleSlug(r.slug)}
            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
              selectedRoleSlug === r.slug
                ? 'border-[var(--brand-primary)] text-slate-900 dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 hover:border-slate-300 dark:border-slate-600'
            }`}
            style={
              selectedRoleSlug === r.slug
                ? { backgroundColor: 'color-mix(in srgb, var(--brand-primary) 18%, transparent)' }
                : undefined
            }
          >
            {r.name}
          </button>
        ))}
      </div>

      {selectedRole && (
        <p className="text-sm text-slate-400 dark:text-slate-400">
          <span className="text-slate-600 dark:text-slate-200 font-medium">{selectedRole.name}</span>
          {selectedRole.description ? ` — ${selectedRole.description}` : ''}
          {' · '}
          {selectedRole.permissions.length} permissions
        </p>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-white/80 dark:bg-slate-900/80 text-slate-400 dark:text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3 font-medium w-48">Module</th>
              <th className="px-4 py-3 font-medium">Permission</th>
              <th className="px-4 py-3 font-medium w-24 text-center">Granted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {byModule.map(([module, perms]) =>
              perms.map((p, idx) => (
                <tr key={p.id} className="hover:bg-white/40 dark:bg-slate-900/40">
                  <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 font-mono text-xs">
                    {idx === 0 ? module : ''}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-slate-600 dark:text-slate-200">{p.label}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{p.key}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {permSet.has(p.key) ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-500 dark:text-slate-300">
          All roles × permissions (compact)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500">
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 dark:bg-slate-950">Permission</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-2 py-2 text-center whitespace-nowrap">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {permissions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-900/30">
                  <td className="px-3 py-1.5 font-mono text-slate-400 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-950">
                    {p.key}
                  </td>
                  {roles.map((r) => {
                    const granted = r.permissions.includes(p.key);
                    return (
                      <td key={r.id} className="px-2 py-1.5 text-center">
                        {granted ? (
                          <span className="text-emerald-500">●</span>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-700">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
