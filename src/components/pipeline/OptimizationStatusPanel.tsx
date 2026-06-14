import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Wrench,
  Eye,
  Table,
  RotateCcw,
  Unlock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  fetchProductOptimization,
  markProductManualReview,
  rerunJobOptimization,
  rerunProductOptimization,
  bypassJobOptimization,
  useJobOptimization,
} from '../../lib/pipelineApi';
import type { JobOptimizationStatus, OptimizationStatus, PipelineJob, ProductOptimizationSummary } from '../../types/pipeline';

function optimizationBadge(status: OptimizationStatus | undefined) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'Optimization queued', className: 'bg-slate-100 dark:bg-slate-600/40 text-slate-600 dark:text-slate-300' },
    running: { label: 'Optimizing\u2026', className: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' },
    completed: { label: 'Optimization completed', className: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' },
    failed: { label: 'Blocked: unresolved errors', className: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' },
    needs_review: { label: 'Fitment needs review', className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  };
  const item = map[status ?? 'pending'] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${item.className}`}>
      {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'failed' && <AlertCircle className="h-3 w-3" />}
      {status === 'needs_review' && <ShieldAlert className="h-3 w-3" />}
      {item.label}
    </span>
  );
}

function readinessBadge(job: PipelineJob, optimization: JobOptimizationStatus | undefined) {
  const opt = optimization?.optimizationStatus ?? job.optimizationStatus;
  if (opt === 'running' || opt === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
        <Loader2 className="h-3 w-3 animate-spin" /> Preparing listings\u2026
      </span>
    );
  }
  const blocked = (optimization?.blockCount ?? job.optimizationBlockCount ?? 0) > 0;
  const review = (optimization?.reviewCount ?? job.optimizationReviewCount ?? 0) > 0;
  if (blocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
        <AlertCircle className="h-3 w-3" /> Blocked: unresolved errors
      </span>
    );
  }
  if (review || opt === 'needs_review') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
        <ShieldAlert className="h-3 w-3" /> Missing required eBay data / review
      </span>
    );
  }
  if (opt === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Ready for eBay upload
      </span>
    );
  }
  return null;
}

function ProductRow({
  jobId,
  product,
  onRefresh,
}: {
  jobId: string;
  product: ProductOptimizationSummary;
  onRefresh: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [fitmentOpen, setFitmentOpen] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchProductOptimization>> | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await fetchProductOptimization(jobId, product.productId);
      setDetail(data);
      setDetailOpen(true);
      setFitmentOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const loadFitment = async () => {
    setLoading(true);
    try {
      const data = await fetchProductOptimization(jobId, product.productId);
      setDetail(data);
      setFitmentOpen(true);
      setDetailOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-100/40 dark:bg-slate-800/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
            {product.optimizedTitle ?? product.sku ?? product.productId.slice(0, 8)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            SKU {product.sku ?? '\u2014'} \u00b7 Readiness {Math.round(product.uploadReadinessScore * 100)}%
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {optimizationBadge(product.optimizationStatus)}
          {product.fitmentStatus === 'needs_review' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
              Fitment review
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={loadDetail}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-1"
        >
          <Eye className="h-3 w-3" /> View optimization details
        </button>
        <button
          type="button"
          onClick={loadFitment}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-1"
        >
          <Table className="h-3 w-3" /> View fitment table ({product.fitmentRowCount})
        </button>
        <button
          type="button"
          onClick={async () => {
            await markProductManualReview(jobId, product.productId, true);
            onRefresh();
          }}
          className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-200"
        >
          Send to manual review
        </button>
        <button
          type="button"
          onClick={async () => {
            await rerunProductOptimization(jobId, product.productId);
            onRefresh();
          }}
          className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 flex items-center gap-1"
          title="Admin/debug only"
        >
          <RotateCcw className="h-3 w-3" /> Re-run optimization
        </button>
      </div>
      {detailOpen && detail && (
        <pre className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/80 p-2 rounded max-h-48 overflow-auto">
          {JSON.stringify(detail.optimizationPayload ?? detail, null, 2)}
        </pre>
      )}
      {fitmentOpen && detail && (
        <div className="overflow-x-auto">
          {Array.isArray(detail.fitmentRows) && (detail.fitmentRows as unknown[]).length > 0 ? (
          <table className="w-full text-xs text-left">
            <thead className="text-slate-500 dark:text-slate-500">
              <tr>
                <th className="p-1">Year</th>
                <th className="p-1">Make</th>
                <th className="p-1">Model</th>
                <th className="p-1">Trim</th>
                <th className="p-1">Engine</th>
                <th className="p-1">Source</th>
                <th className="p-1">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-slate-300">
              {(detail.fitmentRows as Array<Record<string, string>>).map((row, i) => (
                <tr key={i} className="border-t border-slate-200/50 dark:border-slate-700/50">
                  <td className="p-1">{row.year ?? row.Year}</td>
                  <td className="p-1">{row.make ?? row.Make}</td>
                  <td className="p-1">{row.model ?? row.Model}</td>
                  <td className="p-1">{row.trim ?? '\u2014'}</td>
                  <td className="p-1">{row.engine ?? '\u2014'}</td>
                  <td className="p-1">{row.source ?? row.Source ?? '\u2014'}</td>
                  <td className="p-1">{row.validationStatus ?? '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : Array.isArray(detail.fitmentData) && (detail.fitmentData as unknown[]).length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-300">
                Catalog fitment loaded \u2014 re-run optimization to validate against eBay MVL.
              </p>
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="p-1">Year</th>
                    <th className="p-1">Make</th>
                    <th className="p-1">Model</th>
                  </tr>
                </thead>
                <tbody className="text-slate-500 dark:text-slate-300">
                  {(detail.fitmentData as Array<Record<string, string>>).map((row, i) => (
                    <tr key={i} className="border-t border-slate-200/50 dark:border-slate-700/50">
                      <td className="p-1">{row.Year ?? row.year}</td>
                      <td className="p-1">{row.Make ?? row.make}</td>
                      <td className="p-1">{row.Model ?? row.model}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 rounded-md p-3 bg-white dark:bg-slate-900/50">
              Fitment data not available for this listing. Use Admin / debug \u2192 Re-run optimization for
              the job after enrichment completes, or confirm the US export includes Compatibility rows.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function useOptimizationDownloadGate(job: PipelineJob | null | undefined) {
  const jobId = job?.id ?? null;
  const jobCompleted = job?.status === 'completed';
  const { data: optimization } = useJobOptimization(jobId, jobCompleted);
  const optStatus = optimization?.optimizationStatus ?? job?.optimizationStatus ?? 'pending';
  const canDownload =
    jobCompleted &&
    optStatus !== 'pending' &&
    optStatus !== 'running';
  return { canDownload, optimization, optStatus };
}

type MktTab = 'all' | 'US' | 'AU' | 'DE';

export default function OptimizationStatusPanel({ job }: { job: PipelineJob }) {
  const enabled = job.status === 'completed';
  const [activeTab, setActiveTab] = useState<MktTab>('all');
  const { data: optimizationAll, refetch, isLoading } = useJobOptimization(job.id, enabled);
  const { data: optimizationMkt } = useJobOptimization(job.id, enabled && activeTab !== 'all', activeTab !== 'all' ? activeTab : undefined);
  const [adminRerun, setAdminRerun] = useState(false);
  const [bypassing, setBypassing] = useState(false);

  // Use marketplace-specific data when a marketplace tab is selected, otherwise use aggregate
  const optimization = activeTab !== 'all' ? (optimizationMkt ?? optimizationAll) : optimizationAll;

  const optStatus = optimization?.optimizationStatus ?? job.optimizationStatus ?? 'pending';
  const canDownload = optStatus !== 'running' && optStatus !== 'pending';

  const processed = optimization?.processed ?? job.optimizationProcessed ?? 0;
  const total = optimization?.total ?? job.optimizationTotal ?? 0;
  const optPct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const byMkt = optimizationAll?.byMarketplace ?? {};
  const tabs: MktTab[] = ['all', 'US', 'AU', 'DE'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-5 w-5 text-indigo-400" />
          Mandatory listing optimization
        </CardTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Max SEO + comprehensive optimization runs automatically after enrichment. Publish and export stay
          blocked until optimization finishes or is flagged for manual review.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Marketplace tabs */}
        {Object.keys(byMkt).length > 0 && (
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700/50 pb-1">
            {tabs.map((tab) => {
              const mktStatus = tab === 'all' ? null : byMkt[tab];
              const tabLabel = tab === 'all' ? 'All' : tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                    activeTab === tab
                      ? 'bg-slate-100 dark:bg-slate-700/50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {tabLabel}
                  {mktStatus && mktStatus.status === 'completed' && (
                    <CheckCircle2 className="inline h-3 w-3 ml-1 text-green-400" />
                  )}
                  {mktStatus && mktStatus.status === 'running' && (
                    <Loader2 className="inline h-3 w-3 ml-1 animate-spin text-indigo-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {optimizationBadge(optStatus)}
          {readinessBadge(job, optimization)}
        </div>

        {enabled && (optStatus === 'running' || optStatus === 'pending') && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Optimizing listings ({processed}/{total})</span>
              <span>{optPct}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.max(optPct, 2)}%` }}
              />
            </div>
          </div>
        )}

        {optimization && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Total" value={optimization.total} />
            <Stat label="Pass" value={optimization.passCount} />
            <Stat label="Review" value={optimization.reviewCount} />
            <Stat label="Blocked" value={optimization.blockCount} />
            <Stat label="Ready" value={optimization.products.filter((p) => p.canPublish).length} />
          </div>
        )}

        {!canDownload && job.status === 'completed' && (
          <p className="text-xs text-amber-400/90 border border-amber-500/30 rounded-md px-3 py-2 bg-amber-500/5">
            Downloads and export are available after mandatory optimization completes.
          </p>
        )}

        {isLoading && !optimization && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading optimization status\u2026
          </div>
        )}

        {enabled && !canDownload && (
          <button
            type="button"
            disabled={bypassing}
            onClick={async () => {
              setBypassing(true);
              try {
                await bypassJobOptimization(job.id);
                await refetch();
              } finally {
                setBypassing(false);
              }
            }}
            className="w-full px-3 py-2 rounded bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-700 dark:text-red-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            title="Bypass: mark all products as optimization completed to unlock downloads"
          >
            <Unlock className="h-4 w-4" />
            {bypassing ? 'Bypassing\u2026' : 'Bypass Optimization (Force Unlock Downloads)'}
          </button>
        )}

        {optimization && optimization.products.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {optimization.products.slice(0, 50).map((p) => (
              <ProductRow key={p.productId} jobId={job.id} product={p} onRefresh={() => refetch()} />
            ))}
            {optimization.products.length > 50 && (
              <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
                Showing 50 of {optimization.products.length} listings
              </p>
            )}
          </div>
        )}

        <details className="text-xs">
          <summary className="text-slate-500 dark:text-slate-500 cursor-pointer hover:text-slate-700 dark:text-slate-300">Admin / debug</summary>
          <div className="mt-2">
            <button
              type="button"
              disabled={adminRerun}
              onClick={async () => {
                setAdminRerun(true);
                try {
                  await rerunJobOptimization(job.id);
                  await refetch();
                } finally {
                  setAdminRerun(false);
                }
              }}
              className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {adminRerun ? 'Re-running\u2026' : 'Re-run optimization for entire job'}
            </button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-100/60 dark:bg-slate-800/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
