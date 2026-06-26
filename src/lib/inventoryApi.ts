import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from './authApi';
import type { PipelineJob } from '../types/pipeline';
import { normalizePipelineJob } from './pipelineApi';

const API = '/api';

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return fetchWithAuth<T>(`${API}${path}`, { signal });
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return fetchWithAuth<T>(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface InventoryMarketplaceVariant {
  listingId: string;
  marketplace: string | null;
  status: string;
  ebayListingId?: string;
  pipelineJobId?: string;
}

export interface InventoryListingItem {
  id: string;
  sku: string;
  title: string;
  brand: string;
  price: number;
  quantity: number;
  condition: string;
  imageUrl: string;
  imageUrls: string[];
  categoryName: string;
  status: 'draft' | 'ready' | 'publishing' | 'published' | 'error';
  ebayListingId?: string;
  fitmentCount: number;
  missingFields: string[];
  errorMessage?: string;
  pipelineJobId?: string;
  pipelineJobStatus?: string;
  hasCompletedPipelineJob: boolean;
  intakeSource?: boolean;
  marketplaceVariants: InventoryMarketplaceVariant[];
  importedAt?: string;
}

export interface InventoryRequeueWarning {
  listingId: string;
  sku: string;
  jobId: string;
  completedAt: string | null;
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

export interface InventoryListingDetail {
  listing: Record<string, unknown>;
  fitments: Array<{
    id: string;
    make: string | null;
    model: string | null;
    submodel: string | null;
    engine: string | null;
    yearStart: number;
    yearEnd: number;
    source: string;
    confidence: number | null;
    verified: boolean;
    notes: string | null;
  }>;
  marketplaceVariants: Array<{
    listingId: string;
    marketplace: string | null;
    status: string;
    ebayListingId: string | null;
    pipelineJobId: string | null;
    title: string | null;
    importedAt: string;
  }>;
  pipelineJob: {
    id: string;
    status: string;
    originalFilename: string;
    completedAt: string | null;
    createdAt: string;
    totalParts: number;
    enrichedCount: number;
  } | null;
  priorCompletedJobs: Array<{
    jobId: string;
    completedAt: string | null;
    listingId: string;
  }>;
  missingFields: string[];
  imageUrls: string[];
}

export function useInventoryListings(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  missingImages?: boolean;
  enabled?: boolean;
}) {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.missingImages) qs.set('missingImages', 'true');

  return useQuery({
    queryKey: ['inventory-listings', params],
    queryFn: ({ signal }) =>
      fetchJson<{ items: InventoryListingItem[]; total: number }>(
        `/inventory/listings?${qs.toString()}`,
        signal,
      ),
    enabled: params.enabled !== false,
  });
}

export function useInventoryDetail(listingId: string | null) {
  return useQuery({
    queryKey: ['inventory-detail', listingId],
    queryFn: ({ signal }) =>
      fetchJson<InventoryListingDetail>(`/inventory/listings/${listingId}/detail`, signal),
    enabled: Boolean(listingId),
  });
}

export function useInventoryPartLookup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) =>
      postJson<{ listing: unknown; lookup: PartLookupResult }>('/inventory/part-lookup', {
        listingId,
      }),
    onSuccess: (_data, listingId) => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['inventory-detail', listingId] });
    },
  });
}

export function useInventoryBulkPartLookup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingIds: string[]) =>
      postJson<{
        results: Array<{
          listingId: string;
          success: boolean;
          lookup?: PartLookupResult;
          error?: string;
        }>;
      }>('/inventory/part-lookup/bulk', { listingIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['inventory-detail'] });
    },
  });
}

export function useSendToPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingIds: string[]) =>
      postJson<{ job: PipelineJob; warnings: InventoryRequeueWarning[] }>(
        '/inventory/send-to-pipeline',
        { listingIds },
      ).then((res) => ({
        job: normalizePipelineJob(res.job as Parameters<typeof normalizePipelineJob>[0]),
        warnings: res.warnings,
      })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['pipeline-jobs'] });
    },
  });
}

/** @deprecated Use useSendToPipeline */
export function useInventoryEnrich() {
  return useSendToPipeline();
}
