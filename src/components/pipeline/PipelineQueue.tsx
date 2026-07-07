import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  List,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
  Download,
  RotateCcw,
  Ban,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import TeamBadge from '../catalog/TeamBadge';
import {
  downloadPipelineFile,
  useCancelPipelineJob,
  usePipelineJobs,
  useRetryPipelineJob,
  type PipelineDisplayStatus,
  type PipelineJobListItem,
} from '../../lib/pipelineApi';

const STATUS_OPTIONS: { value: '' | PipelineDisplayStatus; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'failed', label: 'Failed' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function formatUploadDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DisplayStatusBadge({ status }: { status: PipelineDisplayStatus }) {
  switch (status) {
    case 'uploaded':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Uploaded
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    case 'queued':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          Queued
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {status}
        </span>
      );
  }
}

function JobActionsMenu({
  job,
  onViewJob,
}: {
  job: PipelineJobListItem;
  onViewJob: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const retry = useRetryPipelineJob();
  const cancel = useCancelPipelineJob();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const canRetry = job.displayStatus === 'failed';
  const canCancel = job.displayStatus === 'queued' || job.displayStatus === 'processing';
  const canViewCatalog = job.displayStatus === 'uploaded';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <MenuItem
            icon={Eye}
            label="View job"
            onClick={() => {
              setOpen(false);
              onViewJob(job.id);
            }}
          />
          <MenuItem
            icon={Download}
            label="Download file"
            onClick={() => {
              setOpen(false);
              void downloadPipelineFile(job.id, 'input');
            }}
          />
          {canViewCatalog && (
            <MenuItem
              icon={ExternalLink}
              label="View in catalog"
              onClick={() => {
                setOpen(false);
                navigate(`/catalog?pipelineJobIds=${job.id}`);
              }}
            />
          )}
          {canRetry && (
            <MenuItem
              icon={RotateCcw}
              label="Retry"
              onClick={() => {
                setOpen(false);
                void retry.mutateAsync(job.id);
              }}
            />
          )}
          {canCancel && (
            <MenuItem
              icon={Ban}
              label="Cancel"
              destructive
              onClick={() => {
                setOpen(false);
                void cancel.mutateAsync(job.id);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
        destructive ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      {label}
    </button>
  );
}

interface Props {
  onViewJob: (id: string) => void;
}

export default function PipelineQueue({ onViewJob }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'' | PipelineDisplayStatus>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isFetching } = usePipelineJobs({
    displayStatus: statusFilter || undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  const jobs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: ['pipeline-jobs'] });
    } finally {
      setRefreshing(false);
    }
  };

  const handleStatusChange = (value: '' | PipelineDisplayStatus) => {
    setStatusFilter(value);
    setPage(0);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(0);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <List className="h-4 w-4 text-slate-500" />
          Pipeline Queue
        </CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as '' | PipelineDisplayStatus)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing || isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing || isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No uploads yet. Start a bulk upload to see jobs here.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Upload ID</th>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3 text-right">Records</th>
                    <th className="px-4 py-3">Marketplace</th>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Uploaded By</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => onViewJob(job.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {job.uploadCode ?? job.id.slice(0, 8)}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {job.originalFilename}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {job.totalParts > 0 ? job.totalParts.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {job.marketplace ?? '—'}
                      </td>
                      <td className="max-w-[9rem] truncate px-4 py-3 text-slate-600 dark:text-slate-300" title={job.store?.storeName}>
                        {job.store?.storeName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {job.conditionLabel ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <TeamBadge name={job.team?.name} color={job.team?.color} />
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {job.uploadedBy?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatUploadDate(job.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <DisplayStatusBadge status={job.displayStatus} />
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <JobActionsMenu job={job} onViewJob={onViewJob} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {from} to {to} of {total.toLocaleString()} uploads
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[4rem] text-center text-sm text-slate-600 dark:text-slate-300">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
