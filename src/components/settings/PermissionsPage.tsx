import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Loader2,
  Shield,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import ProtectedRoute from "../auth/ProtectedRoute";
import Can from "../auth/Can";
import {
  listRbacPermissions,
  listRbacRoles,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  resetRoleToDefaults,
  getSidebarConfigs,
  setSidebarConfigs,
  type RbacPermission,
  type RbacRole,
  type SidebarModuleConfig,
} from "../../lib/rbacApi";

/* ── Sidebar module definitions (mirrors NAV_ITEMS in Shell.tsx) ── */
const SIDEBAR_MODULES: Array<{ key: string; label: string }> = [
  { key: "", label: "Dashboard" },
  { key: "ingestion", label: "Ingestion" },
  { key: "motors", label: "Motors Intel" },
  { key: "motors/review", label: "Review Queue" },
  { key: "listings/new", label: "Add Part" },
  { key: "fitment", label: "Fitment" },
  { key: "fitment/vin", label: "VIN Lookup" },
  { key: "catalog", label: "Catalog" },
  { key: "catalog/import", label: "CSV Import" },
  { key: "catalog/motors-filters", label: "Motors CSV Filters" },
  { key: "inventory", label: "Inventory" },
  { key: "published-listings", label: "Published Listings" },
  { key: "pipeline", label: "Pipeline" },
  { key: "preview", label: "eBay Preview" },
  { key: "bulk-actions", label: "Bulk Actions" },
  { key: "orders", label: "Orders" },
  { key: "automation", label: "Automation" },
  { key: "templates", label: "Templates" },
  { key: "audit", label: "Audit Trail" },
  { key: "notifications", label: "Notifications" },
  { key: "settings", label: "Settings" },
  { key: "settings/users", label: "Users" },
  { key: "settings/teams", label: "Teams" },
  { key: "settings/permissions", label: "Permissions" },
  { key: "settings/client", label: "Client Settings" },
  { key: "settings/integrations/ebay", label: "eBay Stores" },
  { key: "settings/ai-routing", label: "AI Routing" },
];

export default function PermissionsPage() {
  return (
    <ProtectedRoute permissions={["roles.view"]}>
      <PermissionsAdmin />
    </ProtectedRoute>
  );
}

/* ── Generic Modal ── */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

/* ── Main Admin Component ── */
function PermissionsAdmin() {
  type Tab = "roles" | "permissions" | "sidebar";
  const [tab, setTab] = useState<Tab>("roles");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "roles", label: "Roles" },
    { id: "permissions", label: "Permissions" },
    { id: "sidebar", label: "Sidebar Visibility" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield
            className="h-7 w-7"
            style={{ color: "var(--brand-primary)" }}
          />
          Roles & Permissions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage roles, assign permissions, and control sidebar module
          visibility.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-[var(--brand-primary)] text-slate-900 dark:text-slate-100"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "roles" && <RolesTab />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "sidebar" && <SidebarVisibilityTab />}
    </div>
  );
}

/* ── Roles Tab ── */
function RolesTab() {
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RbacRole | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoles(await listRbacRoles());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load roles");
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {roles.length} roles. System roles cannot be deleted.
        </p>
        <Can permission="roles.create">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Plus className="h-4 w-4" />
            Create role
          </button>
        </Can>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Permissions</th>
              <th className="px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {roles.map((r) => (
              <tr key={r.id} className="hover:bg-white/40 dark:bg-slate-900/40">
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">
                  {r.name}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                  {r.slug}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.isSystem
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {r.isSystem ? "System" : "Custom"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.isSystem && r.isCustomized ? (
                    <span className="text-amber-500 text-xs font-medium">
                      Customized
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-500 text-xs">
                      Default
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {r.permissions.length}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Can permission="roles.update">
                      <button
                        type="button"
                        title="Edit role"
                        onClick={() => setEditRole(r)}
                        className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil className="h-4 w-4" />
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
        <CreateRoleModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      )}

      {editRole && (
        <EditRoleModal
          role={editRole}
          onClose={() => setEditRole(null)}
          onSaved={() => {
            setEditRole(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ── Create Role Modal ── */
function CreateRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const autoSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const result = await createRole({
      slug: slug || autoSlug(name),
      name,
      description: description || undefined,
    });
    setBusy(false);
    if ("error" in result) {
      setErr(result.error);
      return;
    }
    onCreated();
  };

  return (
    <Modal title="Create role" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {err && <p className="text-sm text-red-400">{err}</p>}
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">Name</span>
          <input
            required
            minLength={2}
            maxLength={120}
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === autoSlug(name))
                setSlug(autoSlug(e.target.value));
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">Slug</span>
          <input
            required
            pattern="[a-z0-9_]+"
            maxLength={80}
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-mono"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Description
          </span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Edit Role Modal ── */
function EditRoleModal({
  role,
  onClose,
  onSaved,
}: {
  role: RbacRole;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const result = await updateRole(role.id, { name, description });
    setBusy(false);
    if ("error" in result) {
      setErr(result.error);
      return;
    }
    onSaved();
  };

  const remove = async () => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`))
      return;
    setBusy(true);
    setErr(null);
    const result = await deleteRole(role.id);
    setBusy(false);
    if ("error" in result) {
      setErr(result.error);
      return;
    }
    onSaved();
  };

  return (
    <Modal title={`Edit role: ${role.name}`} onClose={onClose}>
      <div className="space-y-4">
        {err && <p className="text-sm text-red-400">{err}</p>}
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">Name</span>
          <input
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Description
          </span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Slug: <span className="font-mono">{role.slug}</span>
          {role.isSystem && (
            <span className="ml-2 text-blue-500">(System role)</span>
          )}
          {role.isCustomized && (
            <span className="ml-2 text-amber-500">(Customized)</span>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div className="flex gap-2">
            {!role.isSystem && (
              <Can permission="roles.delete">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                  Delete
                </button>
              </Can>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <Can permission="roles.update">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </Can>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ── Permissions Tab ── */
function PermissionsTab() {
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPerms, setLocalPerms] = useState<Set<string>>(new Set());
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRole = roles.find((r) => r.slug === selectedRoleSlug);

  useEffect(() => {
    if (selectedRole) {
      setLocalPerms(new Set(selectedRole.permissions));
      setDirty(false);
      setSaveMsg(null);
    }
  }, [selectedRole?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const byModule = useMemo(() => {
    const map = new Map<string, RbacPermission[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const toggle = (key: string) => {
    setLocalPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const toggleModule = (module: string) => {
    const modulePerms = byModule.find(([m]) => m === module)?.[1] ?? [];
    const allGranted = modulePerms.every((p) => localPerms.has(p.key));
    setLocalPerms((prev) => {
      const next = new Set(prev);
      for (const p of modulePerms) {
        if (allGranted) next.delete(p.key);
        else next.add(p.key);
      }
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const savePerms = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setSaveMsg(null);
    const result = await setRolePermissions(selectedRole.id, [...localPerms]);
    setSaving(false);
    if ("error" in result) {
      setSaveMsg(`Error: ${result.error}`);
      return;
    }
    setDirty(false);
    setSaveMsg("Saved");
    void load();
  };

  const resetPerms = async () => {
    if (!selectedRole) return;
    if (!selectedRole.isSystem) return;
    setSaving(true);
    setSaveMsg(null);
    const result = await resetRoleToDefaults(selectedRole.id);
    setSaving(false);
    if ("error" in result) {
      setSaveMsg(`Error: ${result.error}`);
      return;
    }
    setDirty(false);
    setSaveMsg("Reset to defaults");
    void load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedRoleSlug(r.slug)}
            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
              selectedRoleSlug === r.slug
                ? "border-[var(--brand-primary)] text-slate-900 dark:text-slate-100"
                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
            style={
              selectedRoleSlug === r.slug
                ? {
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-primary) 18%, transparent)",
                  }
                : undefined
            }
          >
            {r.name}
            {r.isCustomized && <span className="ml-1 text-amber-500">*</span>}
          </button>
        ))}
      </div>

      {selectedRole && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="text-slate-600 dark:text-slate-200 font-medium">
              {selectedRole.name}
            </span>
            {selectedRole.description ? ` — ${selectedRole.description}` : ""}
            {" · "}
            {localPerms.size} permissions
            {selectedRole.isSystem && !selectedRole.isCustomized && (
              <span className="ml-2 text-amber-500 text-xs">
                (defaults — changes will be overwritten on restart unless saved)
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className="text-xs text-emerald-500">{saveMsg}</span>
            )}
            {selectedRole.isSystem && (
              <Can permission="roles.manage">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void resetPerms()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset defaults
                </button>
              </Can>
            )}
            <Can permission="roles.assign_permissions">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => void savePerms()}
                className="px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </Can>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3 font-medium w-48">Module</th>
              <th className="px-4 py-3 font-medium">Permission</th>
              <th className="px-4 py-3 font-medium w-24 text-center">
                Granted
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {byModule.map(([module, perms]) =>
              perms.map((p, idx) => (
                <tr
                  key={p.id}
                  className="hover:bg-white/40 dark:bg-slate-900/40"
                >
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-xs">
                    {idx === 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleModule(module)}
                        className="hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        title="Toggle all in module"
                      >
                        {module}
                      </button>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-slate-600 dark:text-slate-200">
                      {p.label}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {p.key}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Can
                      permission="roles.assign_permissions"
                      fallback={
                        localPerms.has(p.key) ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-600">
                            —
                          </span>
                        )
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggle(p.key)}
                        className={`w-5 h-5 rounded border transition-colors ${
                          localPerms.has(p.key)
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                        }`}
                      >
                        {localPerms.has(p.key) && (
                          <span className="text-xs">✓</span>
                        )}
                      </button>
                    </Can>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sidebar Visibility Tab ── */
function SidebarVisibilityTab() {
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [configs, setConfigs] = useState<SidebarModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleList, configList] = await Promise.all([
        listRbacRoles(),
        getSidebarConfigs(),
      ]);
      setRoles(roleList);
      setConfigs(configList);
      setSelectedRoleSlug((prev) => prev ?? roleList[0]?.slug ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const configMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const c of configs) {
      if (c.roleSlug === selectedRoleSlug) {
        map.set(c.moduleKey, c.visible);
      }
    }
    return map;
  }, [configs, selectedRoleSlug]);

  const [localVisibility, setLocalVisibility] = useState<Map<string, boolean>>(
    new Map(),
  );

  useEffect(() => {
    setLocalVisibility(new Map(configMap));
    setDirty(false);
    setSaveMsg(null);
  }, [configMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleModule = (key: string) => {
    setLocalVisibility((prev) => {
      const next = new Map(prev);
      const current = next.get(key);
      // Default is visible (true). Toggle: if not set or true -> false, if false -> true
      if (current === false) next.set(key, true);
      else next.set(key, false);
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const isVisible = (key: string) => localVisibility.get(key) !== false;

  const saveConfigs = async () => {
    if (!selectedRoleSlug) return;
    setSaving(true);
    setSaveMsg(null);
    const configPayload = [...localVisibility.entries()].map(
      ([moduleKey, visible]) => ({
        roleSlug: selectedRoleSlug,
        moduleKey,
        visible,
      }),
    );
    const result = await setSidebarConfigs(configPayload);
    setSaving(false);
    if ("error" in result) {
      setSaveMsg(`Error: ${result.error}`);
      return;
    }
    setDirty(false);
    setSaveMsg("Saved");
    void load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Control which sidebar modules each role can see. Modules hidden here
        will not appear in the navigation, even if the user has the required
        permission. Routes remain accessible by URL.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedRoleSlug(r.slug)}
            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
              selectedRoleSlug === r.slug
                ? "border-[var(--brand-primary)] text-slate-900 dark:text-slate-100"
                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
            style={
              selectedRoleSlug === r.slug
                ? {
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-primary) 18%, transparent)",
                  }
                : undefined
            }
          >
            {r.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {selectedRoleSlug && (
            <span className="text-slate-600 dark:text-slate-200 font-medium">
              {selectedRoleSlug}
            </span>
          )}
          {" — "}
          {SIDEBAR_MODULES.filter((m) => isVisible(m.key)).length} of{" "}
          {SIDEBAR_MODULES.length} modules visible
        </p>
        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className="text-xs text-emerald-500">{saveMsg}</span>
          )}
          <Can permission="roles.manage">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void saveConfigs()}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </Can>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Module</th>
              <th className="px-4 py-3 font-medium w-48">Key</th>
              <th className="px-4 py-3 font-medium w-24 text-center">
                Visible
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {SIDEBAR_MODULES.map((m) => {
              const visible = isVisible(m.key);
              return (
                <tr
                  key={m.key}
                  className="hover:bg-white/40 dark:bg-slate-900/40"
                >
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                    {m.label}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-xs">
                    {m.key || "(root)"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Can
                      permission="roles.manage"
                      fallback={
                        visible ? (
                          <Eye className="h-4 w-4 text-emerald-400 inline" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-slate-500 dark:text-slate-600 inline" />
                        )
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleModule(m.key)}
                        className={`p-1.5 rounded transition-colors ${
                          visible
                            ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            : "text-slate-500 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                    </Can>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
