import { useCallback, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  Info,
  Users,
  Filter,
  Shield,
  List,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useUploadPipelineFile, usePipelineJobs, downloadPipelineFile } from '../../lib/pipelineApi';
import type { PipelineDisplayStatus, PipelineJobListItem } from '../../lib/pipelineApi';
import { listTeams, PIPELINE_CONDITIONS, type PipelineConditionLabel } from '../../lib/teamsApi';
import { ProcessingStep } from './PipelineWizard';

const PAGE_SIZE = 10;

const DISPLAY_STATUS_OPTIONS: { value: '' | PipelineDisplayStatus; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'processing', label: 'Processing' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
];

function StatusBadge({ status }: { status: PipelineDisplayStatus }) {
  const config: Record<PipelineDisplayStatus, { label: string; className: string; icon: React.ReactNode }> = {
    uploaded: {
      label: 'Uploaded',
      className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    processing: {
      label: 'Processing',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    queued: {
      label: 'Queued',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
      icon: <Clock className="h-3 w-3" />,
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

export default function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeJobId = searchParams.get('job');
  const [page, setPage] = useState(0);
  const [displayStatus, setDisplayStatus] = useState<'' | PipelineDisplayStatus>('');

  const { data, isLoading, refetch } = usePipelineJobs({
    displayStatus: displayStatus || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const jobs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const closeJob = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const openJob = useCallback(
    (id: string) => {
      setSearchParams({ job: id }, { replace: true });
    },
    [setSearchParams],
  );

  if (activeJobId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Job processing detail</p>
        </div>
        <ProcessingStep jobId={activeJobId} onBack={closeJob} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader onRefresh={() => void refetch()} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BulkUploadCard onJobCreated={openJob} />
        <BulkUploadRulesCard />
      </div>

      <PipelineQueueTable
        jobs={jobs}
        loading={isLoading}
        displayStatus={displayStatus}
        onDisplayStatusChange={(v) => {
          setDisplayStatus(v);
          setPage(0);
        }}
        onRefresh={() => void refetch()}
        onOpenJob={openJob}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}

function PageHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pipeline</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Bulk upload parts, assign teams, and push inventory into the catalog.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Clock className="h-4 w-4" />
          Upload History
        </button>
        <a
          href="/pipeline-template.csv"
          download
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Download Template
        </a>
      </div>
    </div>
  );
}

function BulkUploadCard({ onJobCreated }: { onJobCreated: (jobId: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [condition, setCondition] = useState<PipelineConditionLabel>('Used');
  const [teamId, setTeamId] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const { upload, uploading, progress, error } = useUploadPipelineFile();

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: ({ signal }) => listTeams(signal),
  });

  const selectedTeamId = teamId || teams[0]?.id || '';

  const submitUpload = useCallback(
    async (file: File) => {
      if (!selectedTeamId) {
        alert('Select a team before uploading.');
        return;
      }
      try {
        const result = await upload(file, selectedTeamId, condition);
        if (result?.job?.id) onJobCreated(result.job.id);
      } catch {
        // hook sets error
      }
    },
    [upload, selectedTeamId, condition, onJobCreated],
  );

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        alert('Please upload a CSV or XLSX file');
        return;
      }
      setPendingFile(file);
    },
    [],
  );

  const startUpload = () => {
    if (pendingFile) void submitUpload(pendingFile);
    else fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Bulk Upload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Condition</span>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as PipelineConditionLabel)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              {PIPELINE_CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Team</span>
            <select
              value={selectedTeamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={teamsLoading || teams.length === 0}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
            >
              {teams.length === 0 ? (
                <option value="">No teams available</option>
              ) : (
                teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))
              )}
            </select>
          </label>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-400'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Uploading… {progress}%</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {pendingFile ? pendingFile.name : 'Drag and drop your file here or click to browse'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">CSV or XLSX files up to 50MB</p>
            </>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>The selected team will be assigned to every part in this upload.</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={startUpload}
          disabled={uploading || !selectedTeamId || teams.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          Start Upload
        </button>
      </CardContent>
    </Card>
  );
}

function BulkUploadRulesCard() {
  const rules = [
    {
      icon: Users,
      title: 'Team Assignment',
      body: 'The team you select is assigned to every part in the uploaded sheet.',
    },
    {
      icon: Filter,
      title: 'Catalog Filtering',
      body: 'Uploaded parts can be filtered by team in the Catalog for focused review.',
    },
    {
      icon: Shield,
      title: 'Policy Editing',
      body: 'Bulk policy changes respect the active team filter for accuracy and consistency.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Bulk Upload Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {rules.map((rule) => (
          <div key={rule.title} className="flex gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <rule.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{rule.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{rule.body}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PipelineQueueTable({
  jobs,
  loading,
  displayStatus,
  onDisplayStatusChange,
  onRefresh,
  onOpenJob,
  page,
  totalPages,
  total,
  onPageChange,
}: {
  jobs: PipelineJobListItem[];
  loading: boolean;
  displayStatus: '' | PipelineDisplayStatus;
  onDisplayStatusChange: (v: '' | PipelineDisplayStatus) => void;
  onRefresh: () => void;
  onOpenJob: (id: string) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const navigate = useNavigate();
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-base font-semibold inline-flex items-center gap-2">
          <List className="h-4 w-4 text-slate-500" />
          Pipeline Queue
        </CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={displayStatus}
            onChange={(e) => onDisplayStatusChange(e.target.value as '' | PipelineDisplayStatus)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs"
          >
            {DISPLAY_STATUS_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Upload ID</th>
                <th className="px-4 py-3 font-medium">File Name</th>
                <th className="px-4 py-3 font-medium">Records</th>
                <th className="px-4 py-3 font-medium">Condition</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Uploaded By</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No uploads yet. Start your first bulk upload above.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => onOpenJob(job.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {job.uploadCode ?? job.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate text-slate-900 dark:text-slate-100">{job.originalFilename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {job.totalParts > 0 ? job.totalParts.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{job.conditionLabel ?? '—'}</td>
                    <td className="px-4 py-3">
                      {job.team ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: job.team.color }} />
                          {job.team.name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{job.uploadedBy?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {new Date(job.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.displayStatus} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        job={job}
                        onView={() => onOpenJob(job.id)}
                        onCatalog={() => {
                          const params = new URLSearchParams({ pipelineJobIds: job.id });
                          if (job.team?.id) params.set('teamIds', job.team.id);
                          navigate(`/catalog?${params.toString()}`);
                        }}
                        onDownload={() => downloadPipelineFile(job.id, 'input')}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing {start} to {end} of {total} uploads
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => onPageChange(page - 1)}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => i).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`px-2.5 py-1 rounded border text-xs ${
                  p === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-200 dark:border-slate-600'
                }`}
              >
                {p + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40"
            >
              ›
            </button>
            <span className="ml-2">{PAGE_SIZE} / page</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RowActions({
  onView,
  onCatalog,
  onDownload,
}: {
  job: PipelineJobListItem;
  onView: () => void;
  onCatalog: () => void;
  onDownload: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg py-1 text-xs">
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { setOpen(false); onView(); }}>View job</button>
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { setOpen(false); onCatalog(); }}>Open in catalog</button>
            <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => { setOpen(false); onDownload(); }}>Download file</button>
          </div>
        </>
      )}
    </div>
  );
}
