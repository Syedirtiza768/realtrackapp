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
import type { PipelineJob, PipelineStats } from '../types/pipeline';

const API = '/api';

type PipelineJobApi = Omit<PipelineJob, 'fileSizeBytes' | 'totalParts' | 'processedParts' | 'vinDecodeSuccess' | 'vinDecodeFailed' | 'categoryApiCount' | 'categoryFallbackCount' | 'enrichedCount' | 'fallbackCount' | 'openaiTokensUsed' | 'openaiCostUsd'> & {
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

function normalizePipelineJob(job: PipelineJobApi): PipelineJob {
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
  };
}

/* ── Helpers ──────────────────────────────────────────────── */

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}: ${res.statusText}`), { body });
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}: ${res.statusText}`), { body: errBody });
  }
  return res.json() as Promise<T>;
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
      const status = query.state.data?.job?.status;
      if (!status) return 3000;
      // Stop polling once terminal
      if (status === 'completed' || status === 'failed' || status === 'cancelled') return false;
      return 2000; // Poll every 2s while processing
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

export function getDownloadUrl(jobId: string, template: 'us' | 'au' | 'de' | 'report'): string {
  return `${API}/pipeline/jobs/${jobId}/download/${template}`;
}

export async function downloadPipelineFile(jobId: string, template: 'us' | 'au' | 'de' | 'report'): Promise<void> {
  const url = getDownloadUrl(jobId, template);
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
