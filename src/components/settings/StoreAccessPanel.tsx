import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import Can from '../auth/Can';
import {
  listStores,
  getUserStoreAssignments,
  assignUserToStore,
  removeUserFromStore,
  setUserAccessAll,
  type StoreBrief,
  type StoreAssignment,
} from '../../lib/rbacApi';

const LEVEL_LABELS: Record<string, string> = {
  view: 'View',
  operate: 'Operate',
  admin: 'Admin',
};

const LEVEL_COLORS: Record<string, string> = {
  view: 'bg-slate-500/20 text-slate-400',
  operate: 'bg-blue-500/20 text-blue-400',
  admin: 'bg-amber-500/20 text-amber-400',
};

export default function StoreAccessPanel({ userId }: { userId: string }) {
  const [assignments, setAssignments] = useState<StoreAssignment[]>([]);
  const [allStores, setAllStores] = useState<StoreBrief[]>([]);
  const [accessAll, setAccessAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newLevel, setNewLevel] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [storeList, { assignments: assigns }] = await Promise.all([
        listStores(),
        getUserStoreAssignments(userId),
      ]);
      // Deduplicate by storeName so the same store isn't listed multiple times
      const seen = new Map<string, StoreBrief>();
      for (const s of storeList) {
        if (!seen.has(s.storeName)) seen.set(s.storeName, s);
      }
      setAllStores(Array.from(seen.values()));
      setAssignments(assigns);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [userId]);

  const assignedStoreIds = new Set(assignments.map((a) => a.storeId));
  const availableStores = allStores.filter((s) => !assignedStoreIds.has(s.id));

  const toggleCheck = (storeId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const assignSelected = async () => {
    if (checked.size === 0) return;
    setSaving(true);
    setError(null);
    for (const storeId of checked) {
      const level = newLevel[storeId] ?? 'view';
      const result = await assignUserToStore(userId, storeId, level);
      if ('error' in result) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }
    setChecked(new Set());
    setNewLevel({});
    await load();
    setSaving(false);
  };

  const removeAssignment = async (storeId: string) => {
    setSaving(true);
    setError(null);
    const result = await removeUserFromStore(userId, storeId);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    void load();
  };

  const toggleAccessAll = async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    const result = await setUserAccessAll(userId, enabled);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setAccessAll(enabled);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Store Access
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Access All toggle */}
      <Can permission="stores.access_all_manage">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={accessAll}
            disabled={saving}
            onChange={(e) => void toggleAccessAll(e.target.checked)}
            className="rounded border-slate-600"
          />
          <span className="text-slate-700 dark:text-slate-200">
            Access all stores (bypasses per-store assignment)
          </span>
        </label>
      </Can>

      {!accessAll && (
        <>
          {/* Current assignments */}
          {assignments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Assigned stores</p>
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <span className="text-slate-800 dark:text-slate-100">
                    {a.store?.storeName ?? a.storeId}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[a.accessLevel] ?? LEVEL_COLORS.view}`}
                    >
                      {LEVEL_LABELS[a.accessLevel] ?? a.accessLevel}
                    </span>
                    <Can permission="stores.assign">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void removeAssignment(a.storeId)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 disabled:opacity-50"
                        title="Remove access"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Can>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add multiple stores */}
          <Can permission="stores.assign">
            {availableStores.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Add store access</p>
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-slate-300 dark:border-slate-600 p-1.5">
                  {availableStores.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(s.id)}
                        onChange={() => toggleCheck(s.id)}
                        className="rounded border-slate-500 dark:border-slate-500"
                      />
                      <span className="flex-1 text-slate-700 dark:text-slate-200">
                        {s.storeName || s.id}
                      </span>
                      <select
                        value={newLevel[s.id] ?? 'view'}
                        onChange={(e) =>
                          setNewLevel((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        className="w-24 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm text-slate-800 dark:text-slate-100"
                        style={{ colorScheme: 'dark' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.entries(LEVEL_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving || checked.size === 0}
                    onClick={() => void assignSelected()}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    Assign selected ({checked.size})
                  </button>
                </div>
              </div>
            )}
            {availableStores.length === 0 && assignments.length > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                User has access to all stores.
              </p>
            )}
          </Can>
        </>
      )}
    </div>
  );
}
