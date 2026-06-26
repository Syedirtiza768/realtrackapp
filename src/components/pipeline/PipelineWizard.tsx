import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  XCircle,
  Loader2,
  Workflow,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  useUploadPipelineFile,
  usePipelineJob,
  usePipelineJobs,
  usePipelineStats,
  useRetryPipelineJob,
  useCancelPipelineJob,
  downloadPipelineFile,
} from '../../lib/pipelineApi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PipelineJob, PipelineJobStatus } from '../../types/pipeline';
import { PIPELINE_STAGES } from '../../types/pipeline';
import ImageEnrichmentPanel from './ImageEnrichmentPanel';
import EnrichmentStatusPanel from './EnrichmentStatusPanel';
import OptimizationStatusPanel, { useOptimizationDownloadGate } from './OptimizationStatusPanel';

type WizardStep = 'upload' | 'processing' | 'complete' | 'history';

/* -- Status helpers ----------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  uploading: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  vin_decode: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  category_mapping: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  enrichment: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  validation: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  output_generation: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  completed: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  failed: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  cancelled: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
};

function statusBadge(status: string) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
      {(status ?? '').replace(/_/g, ' ')}
    </span>
  );
}

function isTerminal(status: PipelineJobStatus) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Compute a synthetic progress % from stage position when no part counts are available */
function stageProgress(status: PipelineJobStatus): number {
  const stageWeights: Record<string, number> = {
    pending: 0,
    uploading: 5,
    vin_decode: 15,
    category_mapping: 30,
    enrichment: 55,
    validation: 85,
    output_generation: 95,
    completed: 100,
  };
  return stageWeights[status] ?? 0;
}

/* -------------------------------------------------------------
 *  MAIN COMPONENT
 * ------------------------------------------------------------- */

export default function PipelineWizard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState<WizardStep>('upload');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    const jobParam = searchParams.get('job');
    if (jobParam) {
      setActiveJobId(jobParam);
      setStep('processing');
    }
  }, [searchParams]);

  const handleJobCreated = useCallback(
    (job: PipelineJob) => {
      setActiveJobId(job.id);
      setStep('processing');
      setSearchParams({ job: job.id }, { replace: true });
    },
    [setSearchParams],
  );

  const handleViewJob = useCallback(
    (id: string) => {
      setActiveJobId(id);
      setStep('processing');
      setSearchParams({ job: id }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Workflow className="h-7 w-7 text-blue-400" />
            Enrichment Pipeline
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Upload an Excel file with VIN/parts data and generate enriched eBay listings (US, AU, DE)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setStep('upload');
              setActiveJobId(null);
              setSearchParams({}, { replace: true });
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              step === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            New Job
          </button>
          <button
            onClick={() => setStep('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              step === 'history' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Stats */}
      <PipelineStatsBar />

      {/* Step content */}
      {step === 'upload' && <UploadStep onJobCreated={handleJobCreated} />}
      {step === 'processing' && activeJobId && (
        <ProcessingStep jobId={activeJobId} onBack={() => setStep('history')} />
      )}
      {step === 'history' && <HistoryStep onViewJob={handleViewJob} />}
    </div>
  );
}

/* -------------------------------------------------------------
 *  STATS BAR
 * ------------------------------------------------------------- */

function PipelineStatsBar() {
  const { data: stats } = usePipelineStats();
  if (!stats) return null;

  const items = [
    { label: 'Total', value: stats.total, color: 'text-slate-900 dark:text-slate-100' },
    { label: 'Processing', value: stats.processing, color: 'text-blue-400' },
    { label: 'Completed', value: stats.completed, color: 'text-green-400' },
    { label: 'Failed', value: stats.failed, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------
 *  UPLOAD STEP
 * ------------------------------------------------------------- */

function UploadStep({ onJobCreated }: { onJobCreated: (job: PipelineJob) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { upload, uploading, progress, error } = useUploadPipelineFile();

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        alert('Please upload an Excel (.xlsx/.xls) or CSV file');
        return;
      }
      try {
        const result = await upload(file);
        if (result?.job) onJobCreated(result.job);
      } catch {
        // error state is handled by the hook
      }
    },
    [upload, onJobCreated],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-400" />
          Upload Parts File
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition
            ${dragOver
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-slate-300 dark:border-slate-600 hover:border-slate-500 hover:bg-slate-200/50 dark:bg-slate-700/50'
            }
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
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
            <div className="space-y-3">
              <Loader2 className="h-10 w-10 text-blue-400 animate-spin mx-auto" />
              <p className="text-slate-600 dark:text-slate-300">Uploading... {progress}%</p>
              <div className="w-64 mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <FileSpreadsheet className="h-12 w-12 text-slate-500 dark:text-slate-400 mx-auto" />
              <div>
                <p className="text-slate-700 dark:text-slate-200 font-medium">Drop your Excel or CSV file here</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Supports .xlsx, .xls, .csv � VIN Report / Parts Inventory
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------
 *  PROCESSING STEP
 * ------------------------------------------------------------- */

function ProcessingStep({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const { data } = usePipelineJob(jobId);
  const retryMutation = useRetryPipelineJob();
  const cancelMutation = useCancelPipelineJob();
  const navigate = useNavigate();
  const job = data?.job;
  const { canDownload: optimizationAllowsDownload } = useOptimizationDownloadGate(job);
  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!job) return;
    if (isTerminal(job.status)) return;
    const start = new Date(job.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job?.createdAt, job?.status]);

  if (!job) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
          <p className="text-slate-500 dark:text-slate-400 mt-2">Loading job...</p>
        </CardContent>
      </Card>
    );
  }

  const terminal = isTerminal(job.status);
  const isQueued = job.status === 'pending';
  const hasPartCounts = job.totalParts > 0;
  const progressPct = isQueued
    ? 0
    : hasPartCounts
      ? Math.round((job.processedParts / job.totalParts) * 100)
      : stageProgress(job.status);

  const secondsSinceUpdate = job.updatedAt
    ? Math.floor((Date.now() - new Date(job.updatedAt).getTime()) / 1000)
    : 0;
  const progressLooksStale = !terminal && !isQueued && secondsSinceUpdate > 180;

  // Current stage description
  const currentStage = PIPELINE_STAGES.find((s) => s.key === job.status);
  const statusLabel = isQueued
    ? 'Queued � waiting for the pipeline worker (one job runs at a time)'
    : hasPartCounts
      ? `${job.processedParts} / ${job.totalParts} parts`
      : currentStage?.description ?? 'Processing...';

  return (
    <div className="space-y-4">
      {/* Job header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              {!terminal && <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />}
              {job.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-400" />}
              {job.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-400" />}
              {job.originalFilename}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!terminal && (
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  {formatElapsed(elapsed)}
                </span>
              )}
              {statusBadge(job.status)}
              {job.status === 'failed' && (
                <button
                  onClick={() => retryMutation.mutate(jobId)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded-lg transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              )}
              {!terminal && (
                <button
                  onClick={() => cancelMutation.mutate(jobId)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600/80 hover:bg-red-500 text-white text-xs rounded-lg transition"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar � always shown during processing */}
          {!terminal && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                <span>{statusLabel}</span>
                <span>{isQueued ? 'queued' : `${progressPct}%`}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    hasPartCounts ? 'bg-blue-500' : 'bg-blue-500/70 animate-pulse'
                  }`}
                  style={{ width: `${Math.max(progressPct, 2)}%` }}
                />
              </div>
              {!isQueued && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Last update {formatElapsed(secondsSinceUpdate)} ago
                  {progressLooksStale && ' � AI batches can pause for several minutes on slow OpenRouter responses'}
                </p>
              )}
            </div>
          )}

          {progressLooksStale && (
            <p className="text-sm text-amber-400/90 mb-3">
              No progress updates for a while. If this persists, cancel and retry from History, or check backend logs
              (`docker compose logs backend`).
            </p>
          )}

          {/* Stage stepper */}
          {isQueued && (
            <p className="text-sm text-yellow-400/90 mb-3">
              Your file is uploaded. It will start automatically when the current job finishes.
            </p>
          )}

          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const stageIdx = isQueued
                ? -1
                : PIPELINE_STAGES.findIndex((s) => s.key === job.status);
              const thisIdx = i;
              const isDone = job.status === 'completed' || thisIdx < stageIdx;
              const isActive = thisIdx === stageIdx && !terminal;
              const isFailed = job.status === 'failed' && thisIdx === stageIdx;

              return (
                <div key={stage.key} className="flex items-center">
                  {i > 0 && (
                    <ChevronRight className={`h-4 w-4 mx-1 ${isDone ? 'text-green-500' : 'text-slate-300 dark:text-slate-600'}`} />
                  )}
                  <div
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
                      ${isDone ? 'bg-green-500/20 text-green-400' : ''}
                      ${isActive ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' : ''}
                      ${isFailed ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50' : ''}
                      ${!isDone && !isActive && !isFailed ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400' : ''}
                    `}
                  >
                    {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isFailed && <AlertCircle className="h-3.5 w-3.5" />}
                    {stage.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error message */}
          {job.lastError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
              {job.lastError}
            </div>
          )}

          {/* Input file download � always available */}
          {job.storedFilePath && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Original input file</span>
              <DownloadButton label={job.originalFilename} template="input" jobId={job.id} variant="subtle" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="VIN Decoded" value={job.vinDecodeSuccess} sub={`${job.vinDecodeFailed} failed`} />
        <StatCard
          label="Categories"
          value={job.categoryApiCount}
          sub={
            job.categoryApiCount === 0 && job.categoryFallbackCount > 0
              ? `${job.categoryFallbackCount} fallback (Taxonomy API skipped or rate-limited)`
              : `${job.categoryFallbackCount} fallback`
          }
          subClassName={
            job.categoryApiCount === 0 && job.categoryFallbackCount > 0
              ? 'text-amber-400'
              : undefined
          }
        />
        <StatCard label="Enriched" value={job.enrichedCount} sub={`${job.fallbackCount} fallback`} />
        <StatCard label="AI Tokens" value={job.openaiTokensUsed.toLocaleString()} sub={`$${(job.openaiCostUsd ?? 0).toFixed(4)}`} />
      </div>

      <EnrichmentStatusPanel job={job} />

      {job.status === 'completed' && <OptimizationStatusPanel job={job} />}

      {job.status === 'completed' && (
        <Card className={!optimizationAllowsDownload ? 'opacity-60' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-green-400" />
              Download Output Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!optimizationAllowsDownload && (
              <p className="text-xs text-amber-400 mb-3">
                Exports unlock after automatic Max SEO optimization finishes for this job.
              </p>
            )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {job.outputUsPath && optimizationAllowsDownload && (
                <DownloadButton label="US Motors Template" template="us" jobId={job.id} />
              )}
              {job.outputAuPath && optimizationAllowsDownload && (
                <DownloadButton label="AU Category Template" template="au" jobId={job.id} />
              )}
              {job.outputDePath && optimizationAllowsDownload && (
                <DownloadButton label="DE Category Template" template="de" jobId={job.id} />
              )}
              {job.reportPath && optimizationAllowsDownload && (
                <DownloadButton label="Enrichment Report" template="report" jobId={job.id} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Enrichment */}
      <ImageEnrichmentPanel
        jobId={job.id}
        jobStatus={job.status}
        parts={job.status === 'completed' && job.totalParts > 0 ? Array.from({ length: Math.min(job.totalParts, 50) }, (_, i) => ({
          partNumber: `PART-${job.id.slice(0, 6)}-${i + 1}`,
          title: `${job.originalFilename} Part #${i + 1}`,
        })) : undefined}
      />

      <button onClick={onBack} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition">
        &larr; Back to history
      </button>

      {job.status === 'completed' && (
        <button
          onClick={() => navigate(`/catalog?pipelineJobIds=${job.id}`)}
          className="ml-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition inline-flex items-center gap-1"
        >
          View in Catalog &rarr;
        </button>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  subClassName,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        {sub && (
          <p className={`text-xs mt-0.5 ${subClassName ?? 'text-slate-500 dark:text-slate-400'}`}>{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DownloadButton({ label, template, jobId, variant = 'default' }: { label: string; template: 'us' | 'au' | 'de' | 'report' | 'input'; jobId: string; variant?: 'default' | 'subtle' }) {
  return (
    <button
      onClick={() => downloadPipelineFile(jobId, template)}
      className={`flex items-center gap-2 p-3 border rounded-lg transition text-left ${
        variant === 'subtle'
          ? 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 border-slate-200 dark:border-slate-700'
          : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600/50 border-slate-200 dark:border-slate-600'
      }`}
    >
      <Download className={`h-4 w-4 flex-shrink-0 ${variant === 'subtle' ? 'text-slate-500 dark:text-slate-400' : 'text-green-500 dark:text-green-400'}`} />
      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------
 *  HISTORY STEP
 * ------------------------------------------------------------- */

function HistoryStep({ onViewJob }: { onViewJob: (id: string) => void }) {
  const { data, isLoading } = usePipelineJobs();
  const jobs = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">No pipeline jobs yet. Upload a file to get started.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => onViewJob(job.id)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:bg-slate-700/50 rounded-lg transition text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{job.originalFilename}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(job.createdAt).toLocaleString()} &middot; {formatBytes(job.fileSizeBytes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {job.totalParts > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{job.processedParts}/{job.totalParts} parts</span>
                  )}
                  {statusBadge(job.status)}
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPipelineFile(job.id, 'input'); }}
                    title="Download original input file"
                    className="p-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition rounded"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
