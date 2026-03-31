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
              resolve(JSON.parse(xhr.responseText));
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
    queryFn: ({ signal }) => fetchJson(`/pipeline/jobs${qs}`, signal),
    refetchInterval: 5000,
  });
}

export function usePipelineJob(id: string | null) {
  return useQuery<{ job: PipelineJob }>({
    queryKey: ['pipeline-job', id],
    queryFn: ({ signal }) => fetchJson(`/pipeline/jobs/${id}`, signal),
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
