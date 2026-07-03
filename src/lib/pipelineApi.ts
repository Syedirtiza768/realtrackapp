/* ─── Pipeline API ────────────────────────────────────────
 *  Frontend API layer for the VIN-to-listing enrichment pipeline.
 *  Provides fetch functions + React Query hooks for:
 *    - File upload with progress
 *    - Job listing / detail with polling
 *    - Job control (retry, cancel)
 *    - Stats & file downloads
 * ────────────────────────────────────────────────────────── */

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authHeaders, fetchDownloadResponse, fetchWithAuth } from './authApi';
import type {
  CombinedOptimizationResult,
  EnterpriseOptimizationResult,
  JobOptimizationStatus,
  ListingQualityProfile,
  PipelineJob,
  PipelineStats,
  ProductOptimizationSummary,
} from '../types/pipeline';

const API = '/api';

type PipelineJobApi = Omit<
  PipelineJob,
  | 'fileSizeBytes'
  | 'totalParts'
  | 'processedParts'
  | 'vinDecodeSuccess'
  | 'vinDecodeFailed'
  | 'categoryApiCount'
  | 'categoryFallbackCount'
  | 'enrichedCount'
  | 'fallbackCount'
  | 'openaiTokensUsed'
  | 'openaiCostUsd'
  | 'optimizationProcessed'
  | 'optimizationTotal'
  | 'optimizationPassCount'
  | 'optimizationReviewCount'
  | 'optimizationBlockCount'
> & {
  storedFilePath?: string | null;
  fileSizeBytes: number | string | null;
  totalParts: number | string | null;
  processedParts: number | string | null;
  vinDecodeSuccess: number | string | null;
  vinDecodeFailed: number | string | null;
  categoryApiCount: number | string | null;
  categoryFallbackCount: number | string | null;
  enrichedCount: number | string | null;
  fallbackCount: number | string | null;
  openaiTokensUsed: number | string | null;
  openaiCostUsd: number | string | null;
  optimizationProcessed?: number | string | null;
  optimizationTotal?: number | string | null;
  optimizationPassCount?: number | string | null;
  optimizationReviewCount?: number | string | null;
  optimizationBlockCount?: number | string | null;
};

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizePipelineJob(job: PipelineJobApi): PipelineJob {
  return {
    ...job,
    fileSizeBytes: toNumber(job.fileSizeBytes),
    totalParts: toNumber(job.totalParts),
    processedParts: toNumber(job.processedParts),
    vinDecodeSuccess: toNumber(job.vinDecodeSuccess),
    vinDecodeFailed: toNumber(job.vinDecodeFailed),
    categoryApiCount: toNumber(job.categoryApiCount),
    categoryFallbackCount: toNumber(job.categoryFallbackCount),
    enrichedCount: toNumber(job.enrichedCount),
    fallbackCount: toNumber(job.fallbackCount),
    openaiTokensUsed: toNumber(job.openaiTokensUsed),
    openaiCostUsd: toNumber(job.openaiCostUsd),
    optimizationProcessed: toNumber(job.optimizationProcessed),
    optimizationTotal: toNumber(job.optimizationTotal),
    optimizationPassCount: toNumber(job.optimizationPassCount),
    optimizationReviewCount: toNumber(job.optimizationReviewCount),
    optimizationBlockCount: toNumber(job.optimizationBlockCount),
    optimizationStatus: job.optimizationStatus ?? 'pending',
  };
}

/* ── Helpers ──────────────────────────────────────────────── */

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return fetchWithAuth<T>(`${API}${path}`, { signal });
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return fetchWithAuth<T>(`${API}${path}`, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  UPLOAD
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useUploadPipelineFile() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ job: PipelineJob } | null>(null);
  const qc = useQueryClient();

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      setError(null);
      setResult(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await new Promise<{ job: PipelineJob }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API}/pipeline/upload`);
          const auth = authHeaders();
          if (auth.Authorization) {
            xhr.setRequestHeader('Authorization', auth.Authorization);
          }

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const payload = JSON.parse(xhr.responseText) as { job: PipelineJobApi };
              resolve({ job: normalizePipelineJob(payload.job) });
            } else {
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error('Upload failed: network error'));
          xhr.send(formData);
        });

        setResult(response);
        setProgress(100);
        qc.invalidateQueries({ queryKey: ['pipeline-jobs'] });
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [qc],
  );

  return { upload, uploading, progress, error, result };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  SINGLE LISTING
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export interface SingleListingInput {
  sku?: string;
  brand?: string;
  model?: string;
  vin?: string;
  category?: string;
  partNumber?: string;
  partName?: string;
  note?: string;
  price?: number;
  quantity?: number;
  imageUrls?: string;
  uploadedAssetIds?: string[];
}

export interface PartLookupResult {
  partName?: string;
  brand?: string;
  model?: string;
  category?: string;
  note?: string;
  partNumber?: string;
  confidence?: 'high' | 'medium' | 'low';
  mvlMatched?: boolean;
  source: 'oem_text' | 'vision';
  aiModel: string;
  visionModel?: string;
  estimatedCostUsd: number;
  fallbackUsed: boolean;
}

export interface PartLookupPricingEstimate {
  oemModel: string;
  visionModel: string;
  recommendedStack: string;
  assumptions: {
    oemPromptTokens: number;
    oemCompletionTokens: number;
    visionPromptTokens: number;
    visionCompletionTokens: number;
    visionFallbackRate: number;
  };
  perLookupUsd: {
    oemTextOnly: number;
    visionFallback: number;
    oemPlusVision: number;
  };
  bulk15000PartsUsd: {
    allOemSuccess: number;
    typicalWithVisionFallback: number;
    worstCase: number;
  };
}

export function useSingleListingBrands() {
  return useQuery({
    queryKey: ['single-listing-brands'],
    queryFn: ({ signal }) =>
      fetchJson<{ brands: string[] }>('/pipeline/single-listing/brands', signal),
    staleTime: 5 * 60_000,
  });
}

export function usePartLookupPricing() {
  return useQuery({
    queryKey: ['single-listing-lookup-pricing'],
    queryFn: ({ signal }) =>
      fetchJson<PartLookupPricingEstimate>('/pipeline/single-listing/lookup-pricing', signal),
    staleTime: 60 * 60_000,
  });
}

export function usePartLookup() {
  return useMutation({
    mutationFn: (input: {
      partNumber: string;
      brand?: string;
      vin?: string;
      imageUrls?: string[];
    }) => postJson<PartLookupResult>('/pipeline/single-listing/part-lookup', input),
  });
}

export function useAddIntakePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sku?: string;
      partNumber: string;
      brand: string;
      partType: 'OEM' | 'Aftermarket' | 'Salvage';
      conditionId: string;
      vehicleMake?: string;
      price: number;
      quantity?: number;
      imageUrls?: string[];
      uploadedAssetIds?: string[];
      title?: string;
      categoryName?: string;
      description?: string;
    }) =>
      postJson<{ listing: { id: string; customLabelSku: string | null } }>(
        '/pipeline/single-listing/add-part',
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
    },
  });
}

export function useCreateSingleListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SingleListingInput) =>
      postJson<{ job: PipelineJobApi }>('/pipeline/single', input)
        .then((res) => ({ job: normalizePipelineJob(res.job) })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-jobs'] });
      qc.invalidateQueries({ queryKey: ['pipeline-stats'] });
    },
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  JOBS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function usePipelineJobs(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return useQuery<{ data: PipelineJob[]; total: number }>({
    queryKey: ['pipeline-jobs', status],
    queryFn: async ({ signal }) => {
      const response = await fetchJson<{ jobs: PipelineJobApi[]; total: number }>(`/pipeline/jobs${qs}`, signal);
      return {
        data: response.jobs.map(normalizePipelineJob),
        total: toNumber(response.total),
      };
    },
    refetchInterval: 5000,
  });
}

export function usePipelineJob(id: string | null) {
  return useQuery<{ job: PipelineJob }>({
    queryKey: ['pipeline-job', id],
    queryFn: async ({ signal }) => {
      const response = await fetchJson<{ job: PipelineJobApi }>(`/pipeline/jobs/${id}`, signal);
      return { job: normalizePipelineJob(response.job) };
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      if (!job) return 3000;
      const status = job.status;
      const optStatus = job.optimizationStatus;
      if (status === 'failed' || status === 'cancelled') return false;
      if (status !== 'completed') return 2000;
      if (optStatus === 'pending' || optStatus === 'running') return 2000;
      return false;
    },
  });
}

export function useJobOptimization(jobId: string | null, enabled = true, marketplace?: string) {
  const qs = marketplace ? `?marketplace=${marketplace}` : '';
  return useQuery<JobOptimizationStatus>({
    queryKey: ['pipeline-optimization', jobId, marketplace ?? 'all'],
    queryFn: ({ signal }) => fetchJson(`/pipeline/jobs/${jobId}/optimization${qs}`, signal),
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.optimizationStatus;
      if (status === 'pending' || status === 'running') return 2000;
      return false;
    },
  });
}

export function usePipelineStats() {
  return useQuery<PipelineStats>({
    queryKey: ['pipeline-stats'],
    queryFn: ({ signal }) => fetchJson('/pipeline/stats', signal),
    refetchInterval: 10000,
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  JOB CONTROLS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useRetryPipelineJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postJson<{ job: PipelineJob }>(`/pipeline/jobs/${id}/retry`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['pipeline-job', id] });
      qc.invalidateQueries({ queryKey: ['pipeline-jobs'] });
    },
  });
}

export function useCancelPipelineJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postJson<{ job: PipelineJob }>(`/pipeline/jobs/${id}/cancel`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['pipeline-job', id] });
      qc.invalidateQueries({ queryKey: ['pipeline-jobs'] });
    },
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  DOWNLOADS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function getDownloadUrl(jobId: string, template: 'us' | 'au' | 'de' | 'report' | 'input'): string {
  return `${API}/pipeline/jobs/${jobId}/download/${template}`;
}

export async function downloadPipelineFile(jobId: string, template: 'us' | 'au' | 'de' | 'report' | 'input'): Promise<void> {
  const url = getDownloadUrl(jobId, template);
  const res = await fetchDownloadResponse(url);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const disp = res.headers.get('Content-Disposition');
  a.download = disp?.match(/filename="(.+)"/)?.[1] || `${jobId}-${template}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export async function generateEnterpriseOptimization(
  jobId: string,
  marketplace: 'US' | 'DE' | 'AU' = 'US',
  limit = 250,
  listingQualityProfile: ListingQualityProfile = 'max_seo_comprehensive',
): Promise<EnterpriseOptimizationResult> {
  return postJson<EnterpriseOptimizationResult>(`/pipeline/jobs/${jobId}/enterprise-optimize`, {
    marketplace,
    limit,
    listingQualityProfile,
  });
}

/** Admin/debug: force re-run mandatory optimization for entire job */
export async function rerunJobOptimization(
  jobId: string,
  marketplace: 'US' | 'DE' | 'AU' = 'US',
): Promise<CombinedOptimizationResult> {
  return postJson<CombinedOptimizationResult>(`/pipeline/jobs/${jobId}/optimize-all`, {
    marketplace,
    listingQualityProfile: 'max_seo_comprehensive',
  });
}

export async function fetchProductOptimization(
  jobId: string,
  productId: string,
): Promise<ProductOptimizationSummary & { fitmentRows?: unknown; fitmentData?: unknown; optimizationPayload?: unknown }> {
  return fetchJson(`/pipeline/jobs/${jobId}/products/${productId}/optimization`);
}

export async function markProductManualReview(
  jobId: string,
  productId: string,
  enabled = true,
): Promise<void> {
  await postJson(`/pipeline/jobs/${jobId}/products/${productId}/manual-review`, { enabled });
}

export async function rerunProductOptimization(
  jobId: string,
  productId: string,
  marketplace: 'US' | 'DE' | 'AU' = 'US',
): Promise<void> {
  await postJson(`/pipeline/jobs/${jobId}/products/${productId}/rerun-optimization`, {
    marketplace,
  });
}

export async function bypassJobOptimization(jobId: string): Promise<{ updatedCount: number }> {
  return postJson(`/pipeline/jobs/${jobId}/bypass-optimization`);
}
