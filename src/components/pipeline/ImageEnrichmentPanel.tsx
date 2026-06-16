/* -- Image Enrichment Panel --------------------------------
 *  Shows image enrichment status & controls within the pipeline view.
 *  Rendered inside PipelineWizard when a job is active.
 * ---------------------------------------------------------- */

import { useCallback, useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Star,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { authPost, fetchWithAuth } from '../../lib/authApi';

/* -- Types -------------------------------------------------- */

interface ImageCandidate {
  url: string;
  source: string;
  width: number;
  height: number;
  format: string;
  relevanceScore: number;
  qualityScore: number;
  hasWatermark: boolean;
}

interface PartImageResult {
  partNumber: string;
  title: string;
  primaryImage: ImageCandidate | null;
  galleryImages: ImageCandidate[];
  confidenceScore: number;
  searchQueries: string[];
  sourceAttribution: Array<{ url: string; source: string }>;
  skipped: boolean;
  skipReason?: string;
}

interface ImageEnrichmentProgress {
  totalParts: number;
  processedParts: number;
  enrichedParts: number;
  skippedParts: number;
  failedParts: number;
  totalImagesFound: number;
  cacheHits: number;
  openaiTokensUsed: number;
}

/* -- API helpers -------------------------------------------- */

async function fetchImageStatus(jobId: string): Promise<ImageEnrichmentProgress | null> {
  try {
    const data = await fetchWithAuth<{ progress?: ImageEnrichmentProgress | null }>(
      `/api/pipeline/images/${jobId}/status`,
    );
    return data.progress ?? null;
  } catch {
    return null;
  }
}

async function enrichImages(
  parts: Array<{ partNumber: string; title: string; brand?: string; mpn?: string }>,
  jobId?: string,
): Promise<{ results: PartImageResult[]; progress: ImageEnrichmentProgress }> {
  return authPost('/api/pipeline/images/enrich', { parts, jobId });
}

/* -- Main Component ----------------------------------------- */

export default function ImageEnrichmentPanel({
  jobId,
  jobStatus,
  parts,
}: {
  jobId: string;
  jobStatus: string;
  parts?: Array<{ partNumber: string; title: string; brand?: string; mpn?: string }>;
}) {
  const [progress, setProgress] = useState<ImageEnrichmentProgress | null>(null);
  const [results, setResults] = useState<PartImageResult[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<PartImageResult | null>(null);

  // Poll for image enrichment status on the job
  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      const status = await fetchImageStatus(jobId);
      if (status) setProgress(status);
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  const handleStartEnrichment = useCallback(async () => {
    if (!parts?.length) return;
    setEnriching(true);
    setError(null);
    try {
      const { results: enrichResults, progress: enrichProgress } = await enrichImages(parts, jobId);
      setResults(enrichResults);
      setProgress(enrichProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  }, [parts, jobId]);

  const enrichedCount = results.filter((r) => r.primaryImage).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const failedCount = results.filter((r) => !r.primaryImage && !r.skipped).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Image Enrichment
              {progress && (
                <Badge variant="secondary">
                  {progress.enrichedParts}/{progress.totalParts} enriched
                </Badge>
              )}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
          </CardTitle>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-4">
            {/* Progress stats */}
            {progress && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Processed" value={`${progress.processedParts}/${progress.totalParts}`} color="text-slate-600 dark:text-slate-200" />
                <MiniStat label="Enriched" value={String(progress.enrichedParts)} color="text-green-400" />
                <MiniStat label="Images Found" value={String(progress.totalImagesFound)} color="text-blue-400" />
                <MiniStat label="Cache Hits" value={String(progress.cacheHits)} color="text-purple-400" />
              </div>
            )}

            {/* Progress bar when enriching */}
            {enriching && progress && (
              <div>
                <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                  <span>Enriching images...</span>
                  <span>{Math.round((progress.processedParts / Math.max(progress.totalParts, 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all animate-pulse"
                    style={{ width: `${(progress.processedParts / Math.max(progress.totalParts, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action button */}
            {parts && parts.length > 0 && !enriching && jobStatus === 'completed' && (
              <button
                onClick={handleStartEnrichment}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition"
              >
                <Search className="h-4 w-4" />
                Enrich Images ({parts.length} parts)
              </button>
            )}

            {enriching && (
              <div className="flex items-center gap-2 text-purple-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching for the best images across OEM catalogs and marketplaces...
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <XCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Results summary badges */}
            {results.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {enrichedCount} enriched
                </Badge>
                {skippedCount > 0 && (
                  <Badge variant="secondary">
                    {skippedCount} skipped (already have images)
                  </Badge>
                )}
                {failedCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {failedCount} no images found
                  </Badge>
                )}
              </div>
            )}

            {/* Results list */}
            {results.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result) => (
                  <ImageResultRow
                    key={result.partNumber}
                    result={result}
                    onPreview={(url) => setPreviewUrl(url)}
                    onSelect={() => setSelectedResult(selectedResult?.partNumber === result.partNumber ? null : result)}
                    isSelected={selectedResult?.partNumber === result.partNumber}
                  />
                ))}
              </div>
            )}

            {/* No parts available */}
            {(!parts || parts.length === 0) && jobStatus !== 'completed' && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Image enrichment is available after the pipeline completes.</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Detail panel for selected result */}
      {selectedResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-400" />
              {selectedResult.partNumber} � Image Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Confidence</p>
                <p className="text-slate-700 dark:text-slate-200 font-medium">{(selectedResult.confidenceScore * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Total Images</p>
                <p className="text-slate-700 dark:text-slate-200 font-medium">{(selectedResult.primaryImage ? 1 : 0) + selectedResult.galleryImages.length}</p>
              </div>
            </div>

            {/* Search queries used */}
            {selectedResult.searchQueries.length > 0 && (
              <div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-1">Search Queries Used</p>
                <div className="flex flex-wrap gap-1">
                  {selectedResult.searchQueries.map((q, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">{q}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Primary image */}
            {selectedResult.primaryImage && (
              <div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-400" /> Primary Image (Hero)
                </p>
                <ImageCandidateCard image={selectedResult.primaryImage} />
              </div>
            )}

            {/* Gallery images */}
            {selectedResult.galleryImages.length > 0 && (
              <div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-1">Gallery Images</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedResult.galleryImages.map((img, i) => (
                    <ImageCandidateCard key={i} image={img} compact />
                  ))}
                </div>
              </div>
            )}

            {/* Source attribution */}
            {selectedResult.sourceAttribution.length > 0 && (
              <div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-1">Sources</p>
                <div className="space-y-1">
                  {selectedResult.sourceAttribution.map((src, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{src.source}</Badge>
                      <span className="text-slate-500 dark:text-slate-400 truncate">{src.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Image preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = ''; setPreviewUrl(null); }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* -- Sub-components ----------------------------------------- */

function ImageResultRow({
  result,
  onPreview,
  onSelect,
  isSelected,
}: {
  result: PartImageResult;
  onPreview: (url: string) => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const imageCount = (result.primaryImage ? 1 : 0) + result.galleryImages.length;
  const hasImages = !!result.primaryImage;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition ${
        isSelected ? 'bg-purple-50 dark:bg-purple-500/10 ring-1 ring-purple-200 dark:ring-purple-500/30' : 'bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:bg-slate-700/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Thumbnail or placeholder */}
        <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
          {hasImages ? (
            <ImageIcon className="h-5 w-5 text-green-400" />
          ) : result.skipped ? (
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{result.partNumber}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{result.title}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {result.skipped ? (
          <Badge variant="secondary">Skipped</Badge>
        ) : hasImages ? (
          <>
            <span className="text-xs text-slate-500 dark:text-slate-400">{imageCount} img</span>
            <ConfidenceBadge score={result.confidenceScore} />
          </>
        ) : (
          <Badge variant="destructive">No images</Badge>
        )}
        {hasImages && result.primaryImage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview(result.primaryImage!.url);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </button>
  );
}

function ImageCandidateCard({ image, compact }: { image: ImageCandidate; compact?: boolean }) {
  return (
    <div className={`bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600/50 ${compact ? 'p-2' : 'p-3'}`}>
      <div className="flex items-center justify-between mb-1">
        <Badge variant="secondary">{image.source}</Badge>
        <span className="text-xs text-slate-500 dark:text-slate-400">{image.width}�{image.height}</span>
      </div>
      <div className={`grid grid-cols-2 gap-1 text-xs ${compact ? '' : 'mt-2'}`}>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Relevance:</span>{' '}
          <span className={image.relevanceScore >= 0.8 ? 'text-green-400' : image.relevanceScore >= 0.6 ? 'text-yellow-400' : 'text-red-400'}>
            {(image.relevanceScore * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Quality:</span>{' '}
          <span className={image.qualityScore >= 0.8 ? 'text-green-400' : image.qualityScore >= 0.6 ? 'text-yellow-400' : 'text-red-400'}>
            {(image.qualityScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      {image.hasWatermark && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle className="h-3 w-3" /> Watermark detected
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-2 rounded bg-slate-50 dark:bg-slate-700/40">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
