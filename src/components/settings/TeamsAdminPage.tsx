import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, Plus, Users } from 'lucide-react';
import Can from '../auth/Can';
import ProtectedRoute from '../auth/ProtectedRoute';
import {
  createTeam,
  getTeamMembers,
  listTeams,
  setTeamMembers,
  type TeamSummary,
} from '../../lib/teamsApi';
import { listRbacUsers, type RbacUser } from '../../lib/rbacApi';

export default function TeamsAdminPage() {
  return (
    <ProtectedRoute permissions={['teams.manage']}>
      <TeamsAdmin />
    </ProtectedRoute>
  );
}

function TeamsAdmin() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [users, setUsers] = useState<RbacUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [membersTeam, setMembersTeam] = useState<TeamSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamList, userList] = await Promise.all([listTeams(), listRbacUsers()]);
      setTeams(teamList);
      setUsers(userList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load teams');
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
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Teams</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create teams and assign users. Uploads and catalog rows inherit the selected team.
          </p>
        </div>
        <Can permission="teams.manage">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Create team
          </button>
        </Can>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Members</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {teams.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                  No teams yet. Create one to enable team-scoped pipeline uploads.
                </td>
              </tr>
            ) : (
              teams.map((team) => (
                <tr key={team.id} className="bg-white dark:bg-slate-900">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="font-medium text-slate-900 dark:text-slate-100">{team.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{team.memberCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        team.active
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {team.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setMembersTeam(team)}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Members
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateTeamModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      )}

      {membersTeam && (
        <MembersModal
          team={membersTeam}
          users={users}
          onClose={() => setMembersTeam(null)}
          onSaved={() => {
            setMembersTeam(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTeam({ name: name.trim(), color });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Create team" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MembersModal({
  team,
  users,
  onClose,
  onSaved,
}: {
  team: TeamSummary;
  users: RbacUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const ids = await getTeamMembers(team.id);
        setSelected(new Set(ids));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load members');
      } finally {
        setLoading(false);
      }
    })();
  }, [team.id]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setTeamMembers(team.id, Array.from(selected));
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save members');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${team.name} — members`} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {users.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <input
                type="checkbox"
                checked={selected.has(u.id)}
                onChange={() => toggle(u.id)}
                className="rounded border-slate-300"
              />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{u.name || u.email}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
