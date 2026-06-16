import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  XCircle,
  Loader2,
  ChevronRight,
  Clock,
  Plus,
  ArrowLeft,
  Workflow,
  Image,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  useCreateSingleListing,
  usePipelineJob,
  useRetryPipelineJob,
  useCancelPipelineJob,
  downloadPipelineFile,
} from '../../lib/pipelineApi';
import type { PipelineJob, PipelineJobStatus } from '../../types/pipeline';
import { PIPELINE_STAGES } from '../../types/pipeline';
import EnrichmentStatusPanel from '../pipeline/EnrichmentStatusPanel';
import OptimizationStatusPanel, { useOptimizationDownloadGate } from '../pipeline/OptimizationStatusPanel';
import ImageUploadZone from './ImageUploadZone';
import type { UploadedImage } from '../../lib/storageApi';

/* ── Status helpers (shared with PipelineWizard) ────────── */

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

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

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

/* ── Form field definitions ─────────────────────────────── */

interface FormField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'number' | 'textarea';
  required?: boolean;
  helpText?: string;
  colSpan?: 1 | 2;
}

const FORM_FIELDS: FormField[] = [
  { key: 'partName', label: 'Part Name', placeholder: 'e.g. Door Handle Left, Alternator Assembly', type: 'text', required: true, colSpan: 2 },
  { key: 'partNumber', label: 'Part Number / OEM Number', placeholder: 'e.g. 27060-0V210, A12345678', type: 'text', required: true },
  { key: 'sku', label: 'SKU', placeholder: 'e.g. SKU-001', type: 'text' },
  { key: 'brand', label: 'Brand / Make', placeholder: 'e.g. Toyota, BMW, Bosch', type: 'text' },
  { key: 'vin', label: 'VIN', placeholder: '17-character Vehicle Identification Number', type: 'text', helpText: 'Triggers NHTSA VIN decoding for year/make/model/engine' },
  { key: 'model', label: 'Model', placeholder: 'e.g. Camry, 3 Series, Golf', type: 'text' },
  { key: 'category', label: 'Category', placeholder: 'e.g. Auto Parts & Accessories', type: 'text', helpText: 'Hint for eBay category mapping' },
  { key: 'price', label: 'Price', placeholder: '49.99', type: 'number' },
  { key: 'quantity', label: 'Quantity', placeholder: '1', type: 'number' },
  { key: 'note', label: 'Notes / Additional Details', placeholder: 'OEM condition, removed from 2021 model, tested working...', type: 'textarea', colSpan: 2, helpText: 'Used by AI enrichment to generate detailed listing content' },
];

/* ═════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ═════════════════════════════════════════════════════════════ */

export default function SingleListingPipeline() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'form' | 'processing'>('form');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleJobCreated = useCallback((job: PipelineJob) => {
    setActiveJobId(job.id);
    setPhase('processing');
  }, []);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-8">
      {/* Header */}
      <div className="min-w-0 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:text-slate-200 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Workflow className="h-7 w-7 text-blue-400" />
            New Listing
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Enter part details to run through the enrichment pipeline
          </p>
        </div>
      </div>

      {phase === 'form' && <SingleListingForm onJobCreated={handleJobCreated} />}
      {phase === 'processing' && activeJobId && (
        <ProcessingMonitor jobId={activeJobId} onBack={() => setPhase('form')} />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
 *  FORM PHASE
 * ═════════════════════════════════════════════════════════════ */

function SingleListingForm({ onJobCreated }: { onJobCreated: (job: PipelineJob) => void }) {
  const createMutation = useCreateSingleListing();
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const setValue = useCallback((key: string, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleImagesChange = useCallback((images: UploadedImage[]) => {
    setUploadedImages(images);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const partName = formState.partName?.trim();
      const partNumber = formState.partNumber?.trim();
      if (!partName && !partNumber) {
        setError('Provide at least a Part Name or Part Number');
        return;
      }

      try {
        // Collect manually entered URLs
        const manualUrls = (formState.imageUrls ?? '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

        // Collect CDN URLs from uploaded images
        const uploadedUrls = uploadedImages.map((img) => img.cdnUrl);

        // Merge: uploaded images first, then manual URLs
        const allImageUrls = [...uploadedUrls, ...manualUrls];

        // Collect asset IDs from uploaded images for backend linking
        const uploadedAssetIds = uploadedImages.map((img) => img.assetId);

        const result = await createMutation.mutateAsync({
          sku: formState.sku?.trim() || undefined,
          brand: formState.brand?.trim() || undefined,
          model: formState.model?.trim() || undefined,
          vin: formState.vin?.trim() || undefined,
          category: formState.category?.trim() || undefined,
          partNumber: partNumber || undefined,
          partName: partName || undefined,
          note: formState.note?.trim() || undefined,
          price: formState.price ? parseFloat(formState.price) : undefined,
          quantity: formState.quantity ? parseInt(formState.quantity, 10) : undefined,
          imageUrls: allImageUrls.length > 0 ? allImageUrls.join('|') : undefined,
          uploadedAssetIds: uploadedAssetIds.length > 0 ? uploadedAssetIds : undefined,
        });

        onJobCreated(result.job);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit listing');
      }
    },
    [formState, uploadedImages, createMutation, onJobCreated],
  );

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-400" />
            Part Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FORM_FIELDS.map((field) => (
              <div key={field.key} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={formState[field.key] ?? ''}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none font-sans text-sm"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={formState[field.key] ?? ''}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                )}
                {field.helpText && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>

          {/* ── Image Upload Section ─────────────────────────── */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Image className="h-4 w-4" />
                Listing Images
              </span>
            </label>
            <ImageUploadZone onImagesChange={handleImagesChange} maxImages={12} />
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Or paste image URLs (one per line)
              </label>
              <textarea
                value={formState.imageUrls ?? ''}
                onChange={(e) => setValue('imageUrls', e.target.value)}
                placeholder={'https://example.com/image1.jpg\nhttps://example.com/image2.jpg'}
                rows={2}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none font-sans text-sm"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Uploaded images and pasted URLs will both be used. Up to 12 images total (eBay limit).
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting to Pipeline...
              </>
            ) : (
              <>
                <Workflow size={16} />
                Run Enrichment Pipeline
              </>
            )}
          </button>
        </CardContent>
      </Card>
    </form>
  );
}

/* ═════════════════════════════════════════════════════════════
 *  PROCESSING MONITOR
 * ═════════════════════════════════════════════════════════════ */

function ProcessingMonitor({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const { data } = usePipelineJob(jobId);
  const retryMutation = useRetryPipelineJob();
  const cancelMutation = useCancelPipelineJob();
  const job = data?.job;
  const { canDownload: optimizationAllowsDownload } = useOptimizationDownloadGate(job);

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

  const currentStage = PIPELINE_STAGES.find((s) => s.key === job.status);
  const statusLabel = isQueued
    ? 'Queued — waiting for the pipeline worker'
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
          {/* Progress bar */}
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
                  {progressLooksStale && ' — AI batches can pause on slow responses'}
                </p>
              )}
            </div>
          )}

          {progressLooksStale && (
            <p className="text-sm text-amber-400/90 mb-3">
              No progress updates for a while. If this persists, cancel and retry.
            </p>
          )}

          {isQueued && (
            <p className="text-sm text-yellow-400/90 mb-3">
              Your listing is queued. It will start automatically when the current job finishes.
            </p>
          )}

          {/* Stage stepper */}
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
              ? `${job.categoryFallbackCount} fallback`
              : `${job.categoryFallbackCount} fallback`
          }
        />
        <StatCard label="Enriched" value={job.enrichedCount} sub={`${job.fallbackCount} fallback`} />
        <StatCard label="AI Tokens" value={job.openaiTokensUsed.toLocaleString()} sub={`$${(job.openaiCostUsd ?? 0).toFixed(4)}`} />
      </div>

      <EnrichmentStatusPanel job={job} />

      {job.status === 'completed' && <OptimizationStatusPanel job={job} />}

      {/* Download + catalog link */}
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
                Exports unlock after automatic optimization finishes.
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

            {optimizationAllowsDownload && (
              <button
                onClick={() => navigate(`/catalog?pipelineJobIds=${job.id}`)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                View in Catalog
                <ChevronRight size={16} />
              </button>
            )}
          </CardContent>
        </Card>
      )}

      <button
        onClick={onBack}
        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition"
      >
        &larr; Submit another listing
      </button>
    </div>
  );
}

/* ── Helper components ──────────────────────────────────── */

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        {sub && <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DownloadButton({ label, template, jobId }: { label: string; template: 'us' | 'au' | 'de' | 'report' | 'input'; jobId: string }) {
  return (
    <button
      onClick={() => downloadPipelineFile(jobId, template)}
      className="flex items-center gap-2 p-3 border rounded-lg transition text-left bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600/50 border-slate-200 dark:border-slate-600"
    >
      <Download className="h-4 w-4 flex-shrink-0 text-green-500 dark:text-green-400" />
      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
    </button>
  );
}
