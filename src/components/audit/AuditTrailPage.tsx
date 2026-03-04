import { useEffect, useState, useCallback } from 'react';
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Calendar,
  User,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';

const API = '/api/audit-logs';

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorType: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/10 text-green-400',
  update: 'bg-blue-500/10 text-blue-400',
  delete: 'bg-red-500/10 text-red-400',
  publish: 'bg-purple-500/10 text-purple-400',
  status_change: 'bg-amber-500/10 text-amber-400',
  import: 'bg-cyan-500/10 text-cyan-400',
};

const ENTITY_ICONS: Record<string, string> = {
  listing: 'L',
  order: 'O',
  channel: 'C',
  inventory: 'I',
  setting: 'S',
};

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [since, setSince] = useState('');
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      if (since) params.set('since', since);

      const res = await fetch(`${API}?${params}`);
      const data = await res.json();

      if (Array.isArray(data)) {
        setLogs(data);
        setTotal(data.length >= limit ? (page + 2) * limit : page * limit + data.length);
      } else if (data.logs) {
        setLogs(data.logs);
        setTotal(data.total ?? data.logs.length);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, since]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const resetFilters = () => {
    setEntityType('');
    setAction('');
    setSince('');
    setPage(0);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Trail</h2>
        <p className="text-sm text-slate-500 mt-1">Track all system changes and actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(0);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Entities</option>
            <option value="listing">Listings</option>
            <option value="order">Orders</option>
            <option value="channel">Channels</option>
            <option value="inventory">Inventory</option>
            <option value="setting">Settings</option>
          </select>
        </div>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(0);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="publish">Publish</option>
          <option value="status_change">Status Change</option>
          <option value="import">Import</option>
        </select>
        <div className="relative">
          <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="date"
            value={since}
            onChange={(e) => {
              setSince(e.target.value);
              setPage(0);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        {(entityType || action || since) && (
          <button onClick={resetFilters} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">
            Clear filters
          </button>
        )}
      </div>

      {/* Log Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400 font-medium">No audit logs found</p>
            <p className="text-sm text-slate-500 mt-1">Logs will appear here as system actions occur.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Timestamp</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Entity</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium hidden md:table-cell">Actor</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium hidden lg:table-cell">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <AuditLogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing {page * limit + 1}–{page * limit + logs.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span>Page {page + 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={logs.length < limit}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AuditLogRow({ log }: { log: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor = ACTION_COLORS[log.action] ?? 'bg-slate-700 text-slate-300';
  const entityIcon = ENTITY_ICONS[log.entityType] ?? '?';

  return (
    <>
      <tr
        className="hover:bg-slate-800/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString()}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
              {entityIcon}
            </span>
            <div>
              <span className="text-slate-200 capitalize">{log.entityType}</span>
              <span className="text-slate-500 text-xs ml-1.5 font-mono">{log.entityId.slice(0, 8)}</span>
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${actionColor}`}>
            {log.action}
          </span>
        </td>
        <td className="py-3 px-4 text-slate-400 hidden md:table-cell">
          <div className="flex items-center gap-1">
            <User size={12} />
            <span className="capitalize">{log.actorType}</span>
            {log.actorId && <span className="text-xs font-mono text-slate-500">{log.actorId.slice(0, 8)}</span>}
          </div>
        </td>
        <td className="py-3 px-4 text-slate-500 hidden lg:table-cell">
          {log.changes ? `${Object.keys(log.changes).length} field(s)` : '—'}
        </td>
      </tr>
      {expanded && log.changes && (
        <tr>
          <td colSpan={5} className="px-4 pb-3">
            <div className="bg-slate-800/50 rounded-lg p-3 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left py-1 pr-4">Field</th>
                    <th className="text-left py-1 pr-4">Old Value</th>
                    <th className="text-left py-1">New Value</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {Object.entries(log.changes).map(([field, vals]) => (
                    <tr key={field}>
                      <td className="py-1 pr-4 font-medium text-slate-400">{field}</td>
                      <td className="py-1 pr-4 text-red-400/70 font-mono">
                        {typeof vals.old === 'object' ? JSON.stringify(vals.old) : String(vals.old ?? '—')}
                      </td>
                      <td className="py-1 text-green-400/70 font-mono">
                        {typeof vals.new === 'object' ? JSON.stringify(vals.new) : String(vals.new ?? '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {log.ipAddress && <p className="mt-2 text-slate-500">IP: {log.ipAddress}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
