import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CatalogImport,
  ImportStats,
  ImportVerificationSummary,
  UploadResponse,
  ImportListResponse,
  ImportRowListResponse,
} from '../types/catalogImport';

const API_BASE = '/api';

/* ── Helper ───────────────────────────────────────────────── */

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ── Upload CSV ───────────────────────────────────────────── */

export function useUploadCsv() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  const upload = useCallback(
    async (file: File, columnMapping?: Record<string, string>) => {
      setUploading(true);
      setProgress(0);
      setError(null);
      setResult(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (columnMapping) {
          formData.append('columnMapping', JSON.stringify(columnMapping));
        }

        // Use XMLHttpRequest for upload progress tracking
        const response = await new Promise<UploadResponse>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/catalog-import/upload`);

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
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return { upload, uploading, progress, error, result, reset };
}

/* ── Start import ─────────────────────────────────────────── */

export async function startImport(
  importId: string,
  columnMapping?: Record<string, string>,
): Promise<{ import: CatalogImport }> {
  return apiFetch<{ import: CatalogImport }>('/catalog-import/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ importId, columnMapping }),
  });
}

/* ── List imports ─────────────────────────────────────────── */

export function useImportList(status?: string, limit = 20, offset = 0) {
  const [data, setData] = useState<ImportListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const qs = params.toString();
      const result = await apiFetch<ImportListResponse>(
        `/catalog-import${qs ? `?${qs}` : ''}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load imports');
    } finally {
      setLoading(false);
    }
  }, [status, limit, offset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/* ── Get single import ────────────────────────────────────── */

export function useImportDetail(importId: string | null) {
  const [data, setData] = useState<CatalogImport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!importId) return;
    setLoading(true);
    try {
      const result = await apiFetch<{ import: CatalogImport; verification: ImportVerificationSummary | null }>(
        `/catalog-import/${importId}`,
      );
      setData({
        ...result.import,
        verification: result.verification,
      });

      // Stop polling if terminal state
      if (
        result.import.status === 'completed' ||
        result.import.status === 'failed' ||
        result.import.status === 'cancelled'
      ) {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load import');
    } finally {
      setLoading(false);
    }
  }, [importId]);

  // Auto-poll while processing
  useEffect(() => {
    if (!importId) return;
    void refresh();

    intervalRef.current = window.setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [importId, refresh]);

  return { data, loading, error, refresh };
}

/* ── Get import rows ──────────────────────────────────────── */

export function useImportRows(
  importId: string | null,
  status?: string,
  limit = 50,
  offset = 0,
) {
  const [data, setData] = useState<ImportRowListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!importId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const qs = params.toString();
      const result = await apiFetch<ImportRowListResponse>(
        `/catalog-import/${importId}/rows${qs ? `?${qs}` : ''}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rows');
    } finally {
      setLoading(false);
    }
  }, [importId, status, limit, offset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

/* ── Import stats ─────────────────────────────────────────── */

export function useImportStats() {
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<ImportStats>('/catalog-import/stats');
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

/* ── Cancel import ────────────────────────────────────────── */

export async function cancelImport(id: string): Promise<{ import: CatalogImport }> {
  return apiFetch<{ import: CatalogImport }>(`/catalog-import/${id}/cancel`, {
    method: 'POST',
  });
}

/* ── Retry import ─────────────────────────────────────────── */

export async function retryImport(id: string): Promise<{ import: CatalogImport }> {
  return apiFetch<{ import: CatalogImport }>(`/catalog-import/${id}/retry`, {
    method: 'POST',
  });
}

/* ── Get catalog fields ───────────────────────────────────── */

export async function getCatalogFields() {
  return apiFetch<{ fields: Array<{ field: string; label: string; required: boolean }> }>(
    '/catalog-import/fields',
  );
}
