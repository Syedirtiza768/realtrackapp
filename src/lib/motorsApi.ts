/* ─── Motors Intelligence API ──────────────────────────────
 *  Frontend API layer for the Motors Intelligence pipeline.
 *  Provides fetch functions + React Query hooks for:
 *    - Product CRUD
 *    - Pipeline execution
 *    - Review queue
 *    - Analytics
 * ────────────────────────────────────────────────────────── */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MotorsProduct,
  ReviewTask,
  MotorsProductQuery,
  ReviewTaskQuery,
  PipelineResult,
  MotorsStats,
  ReviewStats,
  ImageUploadRequest,
  ImageUploadResponse,
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  PipelineProgress,
} from '../types/motors';

const API = '/api';

/* ── Helpers ──────────────────────────────────────────────── */

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}: ${res.statusText}`), { body: errBody });
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
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

async function patchJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}: ${res.statusText}`), { body: errBody });
  }
  return res.json() as Promise<T>;
}

async function deleteJson(path: string): Promise<void> {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  RAW API FUNCTIONS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function buildQueryString(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/* ── Products ─────────────────────────────────────────────── */

export async function getMotorsProducts(
  query: MotorsProductQuery = {},
  signal?: AbortSignal,
): Promise<{ items: MotorsProduct[]; total: number }> {
  return fetchJson(`/motors-intelligence/products${buildQueryString(query as Record<string, unknown>)}`, signal);
}

export async function getMotorsProduct(id: string, signal?: AbortSignal): Promise<MotorsProduct> {
  return fetchJson(`/motors-intelligence/products/${id}`, signal);
}

export async function createMotorsProduct(data: Partial<MotorsProduct>): Promise<MotorsProduct> {
  return postJson('/motors-intelligence/products', data);
}

export async function batchCreateMotorsProducts(products: Partial<MotorsProduct>[]): Promise<MotorsProduct[]> {
  return postJson('/motors-intelligence/products/batch', { products });
}

export async function updateMotorsProduct(id: string, data: Partial<MotorsProduct>): Promise<MotorsProduct> {
  return patchJson(`/motors-intelligence/products/${id}`, data);
}

export async function deleteMotorsProduct(id: string): Promise<void> {
  return deleteJson(`/motors-intelligence/products/${id}`);
}

/* ── Pipeline ─────────────────────────────────────────────── */

export async function runPipeline(id: string): Promise<PipelineResult> {
  return postJson(`/motors-intelligence/products/${id}/run-pipeline`);
}

export async function publishMotorsProduct(id: string, connectionId: string): Promise<{ success: boolean; error?: string }> {
  return postJson(`/motors-intelligence/products/${id}/publish`, { connectionId });
}

/* ── Review Queue ─────────────────────────────────────────── */

export async function getReviewTasks(
  query: ReviewTaskQuery = {},
  signal?: AbortSignal,
): Promise<{ items: ReviewTask[]; total: number }> {
  return fetchJson(`/motors-intelligence/review/tasks${buildQueryString(query as Record<string, unknown>)}`, signal);
}

export async function getReviewTask(id: string, signal?: AbortSignal): Promise<ReviewTask> {
  return fetchJson(`/motors-intelligence/review/tasks/${id}`, signal);
}

export async function assignReviewTask(id: string, assignedTo: string): Promise<ReviewTask> {
  return patchJson(`/motors-intelligence/review/tasks/${id}/assign`, { assignedTo });
}

export async function resolveReviewTask(
  id: string,
  data: { resolution: string; resolutionData?: Record<string, unknown>; action: 'approve' | 'reject' | 'defer' },
): Promise<ReviewTask> {
  return postJson(`/motors-intelligence/review/tasks/${id}/resolve`, data);
}

/* ── Analytics ────────────────────────────────────────────── */

export async function getMotorsStats(signal?: AbortSignal): Promise<MotorsStats> {
  return fetchJson('/motors-intelligence/stats', signal);
}

export async function getReviewStats(signal?: AbortSignal): Promise<ReviewStats> {
  return fetchJson('/motors-intelligence/review/stats', signal);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  REACT QUERY HOOKS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const KEYS = {
  products: ['motors-products'] as const,
  product: (id: string) => ['motors-products', id] as const,
  reviewTasks: ['motors-review-tasks'] as const,
  reviewTask: (id: string) => ['motors-review-tasks', id] as const,
  stats: ['motors-stats'] as const,
  reviewStats: ['motors-review-stats'] as const,
};

/* ── Product hooks ────────────────────────────────────────── */

export function useMotorsProducts(query: MotorsProductQuery = {}) {
  return useQuery({
    queryKey: [...KEYS.products, query],
    queryFn: ({ signal }) => getMotorsProducts(query, signal),
    staleTime: 15_000,
  });
}

export function useMotorsProduct(id: string | null) {
  return useQuery({
    queryKey: KEYS.product(id!),
    queryFn: ({ signal }) => getMotorsProduct(id!, signal),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateMotorsProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MotorsProduct>) => createMotorsProduct(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.products }),
  });
}

export function useBatchCreateMotorsProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (products: Partial<MotorsProduct>[]) => batchCreateMotorsProducts(products),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.products }),
  });
}

export function useUpdateMotorsProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MotorsProduct> }) =>
      updateMotorsProduct(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.products });
      qc.invalidateQueries({ queryKey: KEYS.product(id) });
    },
  });
}

export function useDeleteMotorsProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMotorsProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.products }),
  });
}

/* ── Pipeline hooks ───────────────────────────────────────── */

export function useRunPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => runPipeline(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.products });
      qc.invalidateQueries({ queryKey: KEYS.stats });
    },
  });
}

export function usePublishMotorsProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, connectionId }: { id: string; connectionId: string }) =>
      publishMotorsProduct(id, connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.products });
      qc.invalidateQueries({ queryKey: KEYS.stats });
    },
  });
}

/* ── Review hooks ─────────────────────────────────────────── */

export function useReviewTasks(query: ReviewTaskQuery = {}) {
  return useQuery({
    queryKey: [...KEYS.reviewTasks, query],
    queryFn: ({ signal }) => getReviewTasks(query, signal),
    staleTime: 10_000,
  });
}

export function useReviewTask(id: string | null) {
  return useQuery({
    queryKey: KEYS.reviewTask(id!),
    queryFn: ({ signal }) => getReviewTask(id!, signal),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useAssignReviewTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      assignReviewTask(id, assignedTo),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.reviewTasks }),
  });
}

export function useResolveReviewTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      resolution: string;
      resolutionData?: Record<string, unknown>;
      action: 'approve' | 'reject' | 'defer';
    }) => resolveReviewTask(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.reviewTasks });
      qc.invalidateQueries({ queryKey: KEYS.products });
      qc.invalidateQueries({ queryKey: KEYS.stats });
      qc.invalidateQueries({ queryKey: KEYS.reviewStats });
    },
  });
}

/* ── Stats hooks ──────────────────────────────────────────── */

export function useMotorsStats() {
  return useQuery({
    queryKey: KEYS.stats,
    queryFn: ({ signal }) => getMotorsStats(signal),
    staleTime: 30_000,
  });
}

export function useReviewStats() {
  return useQuery({
    queryKey: KEYS.reviewStats,
    queryFn: ({ signal }) => getReviewStats(signal),
    staleTime: 30_000,
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  IMAGE UPLOAD API
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export async function requestImageUpload(data: ImageUploadRequest): Promise<ImageUploadResponse> {
  return postJson('/motors-intelligence/products/upload-images', data);
}

export async function confirmImageUpload(
  motorsProductId: string,
  data: ConfirmUploadRequest,
): Promise<ConfirmUploadResponse> {
  return postJson(`/motors-intelligence/products/${motorsProductId}/confirm-upload`, data);
}

/**
 * Upload a file directly to S3 using a presigned PUT URL.
 */
export async function uploadFileToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.send(file);
  });
}

export async function enrichMotorsProduct(id: string): Promise<Record<string, unknown>> {
  return postJson(`/motors-intelligence/products/${id}/enrich`);
}

/**
 * Subscribe to pipeline progress via Server-Sent Events.
 * Returns an EventSource that emits PipelineProgress messages.
 */
export function subscribePipelineProgress(
  motorsProductId: string,
  onProgress: (progress: PipelineProgress) => void,
  onError?: (error: Event) => void,
  onDone?: () => void,
): EventSource {
  const es = new EventSource(`${API}/motors-intelligence/products/${motorsProductId}/progress`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as PipelineProgress;
      onProgress(data);
      if (data.done) {
        es.close();
        onDone?.();
      }
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = (event) => {
    onError?.(event);
    es.close();
  };

  return es;
}

/* ── Image upload hooks ───────────────────────────────────── */

export function useRequestImageUpload() {
  return useMutation({
    mutationFn: (data: ImageUploadRequest) => requestImageUpload(data),
  });
}

export function useConfirmImageUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ motorsProductId, data }: { motorsProductId: string; data: ConfirmUploadRequest }) =>
      confirmImageUpload(motorsProductId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.products });
      qc.invalidateQueries({ queryKey: KEYS.stats });
    },
  });
}

export function useEnrichMotorsProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enrichMotorsProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.products }),
  });
}
