import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Loader2,
  RefreshCw,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import {
  useReviewTasks,
  useReviewStats,
  useResolveReviewTask,
} from '../../lib/motorsApi';
import type { ReviewTaskStatus, ReviewTaskPriority, ReviewReason, ReviewTask, ReviewTaskQuery } from '../../types/motors';

/* ── Formatting helpers ───────────────────────────────────── */

const PRIORITY_CONFIG: Record<ReviewTaskPriority, { label: string; color: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: AlertTriangle },
  medium:   { label: 'Medium',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Clock },
  low:      { label: 'Low',      color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: Clock },
};

const STATUS_CONFIG: Record<ReviewTaskStatus, { label: string; color: string }> = {
  open:          { label: 'Open',          color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  in_progress:   { label: 'In Progress',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  approved:      { label: 'Approved',      color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  rejected:      { label: 'Rejected',      color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' },
  deferred:      { label: 'Deferred',      color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  auto_resolved: { label: 'Auto-Resolved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
};

function formatReason(reason: ReviewReason): string {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── Stats bar ────────────────────────────────────────────── */

function ReviewStatsBar() {
  const { data: stats, isLoading } = useReviewStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Pending', value: stats.totalPending, color: 'text-yellow-600', icon: Clock },
    { label: 'Critical', value: stats.byPriority?.critical || 0, color: 'text-red-600', icon: XCircle },
    { label: 'High Priority', value: stats.byPriority?.high || 0, color: 'text-orange-600', icon: AlertTriangle },
    { label: 'Avg Resolution', value: stats.avgResolutionTimeMinutes ? `${Math.round(stats.avgResolutionTimeMinutes)}m` : 'N/A', color: 'text-blue-600', icon: CheckCircle },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{c.label}</p>
              </div>
              <c.icon className={`w-8 h-8 ${c.color} opacity-60`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Task row ─────────────────────────────────────────────── */

function TaskRow({ task }: { task: ReviewTask }) {
  const resolveTask = useResolveReviewTask();
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.open;
  const PriorityIcon = priorityCfg.icon;

  return (
    <tr className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PriorityIcon className={`w-4 h-4 ${task.priority === 'critical' ? 'text-red-500' : task.priority === 'high' ? 'text-orange-500' : 'text-gray-400'}`} />
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityCfg.color}`}>
            {priorityCfg.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium">{formatReason(task.reason)}</p>
          {task.reasonDetails && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-48">{task.reasonDetails}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {task.assignedTo ? (
          <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <User className="w-3 h-3" />
            {task.assignedTo}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
        {relativeTime(task.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {task.status === 'open' || task.status === 'in_progress' ? (
            <>
              <button
                onClick={() => resolveTask.mutate({ id: task.id, action: 'approve', resolution: 'Approved by reviewer' })}
                disabled={resolveTask.isPending}
                className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition-colors"
                title="Approve"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => resolveTask.mutate({ id: task.id, action: 'reject', resolution: 'Rejected by reviewer' })}
                disabled={resolveTask.isPending}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
                title="Reject"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          ) : null}
          <Link
            to={`/motors/${task.motorsProductId}`}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors"
            title="View product"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function ReviewQueue() {
  const [query, setQuery] = useState<ReviewTaskQuery>({ page: 1, limit: 25 });
  const { data, isLoading, refetch } = useReviewTasks(query);

  const statusFilters: (ReviewTaskStatus | '')[] = ['', 'open', 'in_progress', 'approved', 'rejected', 'deferred'];
  const priorityFilters: (ReviewTaskPriority | '')[] = ['', 'critical', 'high', 'medium', 'low'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-orange-500" />
            Review Queue
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 ml-9">
            Human-in-the-loop review for Motors Intelligence
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <ReviewStatsBar />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
              value={query.status || ''}
              onChange={(e) => setQuery({ ...query, status: e.target.value as any || undefined, page: 1 })}
            >
              {statusFilters.map((s) => (
                <option key={s} value={s}>{s ? STATUS_CONFIG[s].label : 'All Statuses'}</option>
              ))}
            </select>
            <select
              className="rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
              value={query.priority || ''}
              onChange={(e) => setQuery({ ...query, priority: e.target.value as any || undefined, page: 1 })}
            >
              {priorityFilters.map((p) => (
                <option key={p} value={p}>{p ? PRIORITY_CONFIG[p].label : 'All Priorities'}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3 w-28">Priority</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 w-28">Status</th>
                <th className="px-4 py-3 hidden md:table-cell w-28">Assigned</th>
                <th className="px-4 py-3 hidden lg:table-cell w-24">Created</th>
                <th className="px-4 py-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">Loading tasks…</p>
                  </td>
                </tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <CheckCircle className="w-8 h-8 mx-auto text-green-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No review tasks - all caught up!</p>
                  </td>
                </tr>
              ) : (
                data.items.map((t) => <TaskRow key={t.id} task={t} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > (query.limit || 25) && (
          <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-700">
            <p className="text-xs text-gray-500">
              Showing {((query.page || 1) - 1) * (query.limit || 25) + 1}–
              {Math.min((query.page || 1) * (query.limit || 25), data.total)} of {data.total}
            </p>
            <div className="flex gap-1">
              <button
                disabled={(query.page || 1) <= 1}
                onClick={() => setQuery({ ...query, page: (query.page || 1) - 1 })}
                className="px-3 py-1 rounded text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={(query.page || 1) * (query.limit || 25) >= data.total}
                onClick={() => setQuery({ ...query, page: (query.page || 1) + 1 })}
                className="px-3 py-1 rounded text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
