import { AlertTriangle, Bot, CheckCircle2, Download, FolderTree, ShieldAlert, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { PipelineEnrichmentSummary, PipelineJob } from '../../types/pipeline';
import { downloadPipelineFile } from '../../lib/pipelineApi';

function parseEnrichmentSummary(job: PipelineJob): PipelineEnrichmentSummary | null {
  const raw = job.stageDetails;
  if (!raw || typeof raw !== 'object') return null;

  const s = raw as Record<string, unknown>;
  const categoryMapping = s.categoryMapping as PipelineEnrichmentSummary['categoryMapping'];
  const hasCategoryIssues =
    Boolean(s.categoryTaxonomyBackoff) ||
    (((categoryMapping?.fallbackMapped ?? 0) > 0 && (categoryMapping?.apiMapped ?? 0) === 0));

  if (
    s.enrichmentMode == null &&
    !Array.isArray(s.openRouterProbeErrors) &&
    !Array.isArray(s.enrichmentErrors) &&
    !hasCategoryIssues
  ) {
    return null;
  }

  return {
    enrichmentMode: s.enrichmentMode as PipelineEnrichmentSummary['enrichmentMode'],
    totalAiEnriched: typeof s.totalAiEnriched === 'number' ? s.totalAiEnriched : job.enrichedCount,
    totalFallbackEnrichment:
      typeof s.totalFallbackEnrichment === 'number' ? s.totalFallbackEnrichment : job.fallbackCount,
    totalListingsGenerated:
      typeof s.totalListingsGenerated === 'number' ? s.totalListingsGenerated : undefined,
    openRouterModel: typeof s.openRouterModel === 'string' ? s.openRouterModel : undefined,
    openRouterProbeErrors: Array.isArray(s.openRouterProbeErrors)
      ? (s.openRouterProbeErrors as PipelineEnrichmentSummary['openRouterProbeErrors'])
      : [],
    enrichmentErrors: Array.isArray(s.enrichmentErrors)
      ? (s.enrichmentErrors as PipelineEnrichmentSummary['enrichmentErrors'])
      : [],
    categoryMapping: categoryMapping ?? undefined,
    categoryTaxonomyBackoff: Boolean(s.categoryTaxonomyBackoff),
    localization: s.localization as PipelineEnrichmentSummary['localization'],
  };
}

const MODE_META: Record<
  NonNullable<PipelineEnrichmentSummary['enrichmentMode']>,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'muted'; description: string }
> = {
  ai: {
    label: 'AI enrichment',
    tone: 'success',
    description: 'OpenRouter validated and listings were enriched with AI.',
  },
  mixed: {
    label: 'Mixed enrichment',
    tone: 'warning',
    description: 'Some parts used AI enrichment; others fell back to rule-based copy.',
  },
  fallback: {
    label: 'Fallback enrichment',
    tone: 'danger',
    description: 'OpenRouter was unavailable — all listings used rule-based fallback copy.',
  },
  none: {
    label: 'No enrichment',
    tone: 'muted',
    description: 'No parts were enriched in this run.',
  },
};

function toneClasses(tone: 'success' | 'warning' | 'danger' | 'muted') {
  switch (tone) {
    case 'success':
      return 'border-green-200 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300';
    case 'warning':
      return 'border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200';
    case 'danger':
      return 'border-red-200 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200';
    default:
      return 'border-slate-200 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-300';
  }
}

export default function EnrichmentStatusPanel({ job }: { job: PipelineJob }) {
  const summary = parseEnrichmentSummary(job);
  if (!summary) return null;

  const mode = summary.enrichmentMode ?? 'none';
  const meta = MODE_META[mode] ?? MODE_META.none;
  const probeErrors = summary.openRouterProbeErrors ?? [];
  const taxonomyErrors = summary.categoryMapping?.taxonomyErrors ?? [];
  const categoryFallbackOnly =
    (summary.categoryMapping?.apiMapped ?? job.categoryApiCount) === 0 &&
    (summary.categoryMapping?.fallbackMapped ?? job.categoryFallbackCount) > 0;
  const otherErrors = (summary.enrichmentErrors ?? []).filter(
    (e) => e.type !== 'openai' && e.type !== 'taxonomy',
  );
  const showAlert =
    mode === 'fallback' ||
    mode === 'mixed' ||
    probeErrors.length > 0 ||
    categoryFallbackOnly ||
    taxonomyErrors.length > 0 ||
    summary.categoryTaxonomyBackoff;

  return (
    <Card className={showAlert ? 'ring-1 ring-amber-500/30' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {mode === 'ai' ? (
            <Sparkles className="h-5 w-5 text-green-400" />
          ) : mode === 'fallback' ? (
            <ShieldAlert className="h-5 w-5 text-red-400" />
          ) : (
            <Bot className="h-5 w-5 text-amber-400" />
          )}
          Enrichment status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-lg border px-4 py-3 ${toneClasses(meta.tone)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{meta.label}</p>
            {summary.openRouterModel && (
              <span className="text-xs opacity-80">Model: {summary.openRouterModel}</span>
            )}
          </div>
          <p className="text-sm mt-1 opacity-90">{meta.description}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">AI enriched</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{summary.totalAiEnriched ?? 0}</p>
          </div>
          <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fallback</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{summary.totalFallbackEnrichment ?? 0}</p>
          </div>
          {summary.localization && (
            <>
              <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">AU localized</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {summary.localization.auAiTranslated ?? 0}
                  {(summary.localization.auRuleOnly ?? 0) > 0 && (
                    <span className="text-xs text-amber-400 ml-1">
                      (+{summary.localization.auRuleOnly} rule-only)
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">DE localized</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {summary.localization.deAiTranslated ?? 0}
                  {(summary.localization.deRuleOnly ?? 0) > 0 && (
                    <span className="text-xs text-amber-400 ml-1">
                      (+{summary.localization.deRuleOnly} rule-only)
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {(summary.categoryMapping || categoryFallbackOnly) && (
          <div
            className={`rounded-lg border px-4 py-3 ${
              categoryFallbackOnly || taxonomyErrors.length > 0
                ? 'border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-100'
                : 'border-slate-200 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <FolderTree className="h-4 w-4 flex-shrink-0" />
              eBay category mapping
            </div>
            <p className="text-sm mt-2">
              {summary.categoryMapping?.apiMapped ?? job.categoryApiCount} via Taxonomy API,{' '}
              {summary.categoryMapping?.fallbackMapped ?? job.categoryFallbackCount} keyword fallback
              {summary.categoryMapping?.apiRate ? ` (${summary.categoryMapping.apiRate} API rate)` : ''}
            </p>
            {summary.categoryMapping?.treeCacheHit && (
              <p className="text-xs mt-1 opacity-80">
                Category tree loaded from {summary.categoryMapping.treeCacheSource ?? 'disk'} cache.
              </p>
            )}
            {summary.categoryMapping?.apiSkippedReason && (
              <p className="text-xs mt-2 text-amber-200/90 font-mono break-words whitespace-pre-wrap">
                API skipped: {summary.categoryMapping.apiSkippedReason}
              </p>
            )}
            {categoryFallbackOnly && taxonomyErrors.length === 0 && !summary.categoryMapping?.apiSkippedReason && (
              <p className="text-xs mt-2 opacity-90">
                All categories used keyword fallback. Check eBay credentials and Taxonomy API rate limits.
              </p>
            )}
          </div>
        )}

        {taxonomyErrors.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-200 font-medium">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              eBay Taxonomy API issues
            </div>
            <ul className="space-y-2 text-sm text-amber-600 dark:text-amber-100/90">
              {taxonomyErrors.slice(0, 5).map((err, i) => (
                <li key={i} className="font-mono text-xs break-words whitespace-pre-wrap">
                  {err.source ? `[${err.source}] ` : ''}
                  {err.message}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-600 dark:text-amber-200/80">
              The pipeline caches the Motors category tree on disk and backs off after rate limits. Wait for the retry window, then re-run the job.
            </p>
          </div>
        )}

        {probeErrors.length > 0 && (
          <div className="rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-300 font-medium">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              OpenRouter probe failed
            </div>
            <ul className="space-y-2 text-sm text-red-500 dark:text-red-200/90">
              {probeErrors.map((err, i) => (
                <li key={i} className="font-mono text-xs break-words whitespace-pre-wrap">
                  {err.message}
                </li>
              ))}
            </ul>
            <p className="text-xs text-red-500 dark:text-red-300/80">
              Check `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and model env vars. Re-run after fixing credentials.
            </p>
          </div>
        )}

        {otherErrors.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-4 space-y-2">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-200">Other pipeline errors</p>
            <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-100/90 font-mono">
              {otherErrors.slice(0, 5).map((err, i) => (
                <li key={i}>
                  [{err.type}] {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'ai' && probeErrors.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            OpenRouter validated successfully for this job.
          </div>
        )}

        {job.reportPath && (
          <button
            type="button"
            onClick={() => downloadPipelineFile(job.id, 'report')}
            className="inline-flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition"
          >
            <Download className="h-3.5 w-3.5" />
            Download full enrichment report (JSON)
          </button>
        )}
      </CardContent>
    </Card>
  );
}
