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

export type EnrichmentStatus =
  | 'idle'
  | 'ready'
  | 'enriching'
  | 'completed'
  | 'needs_review'
  | 'failed';

export interface InventoryMarketplaceVariant {
  listingId: string;
  marketplace: string | null;
  status: string;
  ebayListingId?: string;
  pipelineJobId?: string;
}

export interface InventoryStoreListing {
  storeId: string;
  storeName: string;
  marketplaceId: string;
  offerId: string | null;
  ebayListingId: string | null;
  listingUrl: string | null;
  price: number | null;
  quantity: number | null;
  status: string;
  publishedAt: string | null;
  lastSyncedAt: string | null;
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
  enrichmentStatus: EnrichmentStatus;
  enrichmentStage?: string | null;
  intakeSource?: boolean;
  marketplaceVariants: InventoryMarketplaceVariant[];
  storeListings: InventoryStoreListing[];
  location?: string;
  version?: number;
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
  enrichmentStatus: EnrichmentStatus;
  priorCompletedJobs: Array<{
    jobId: string;
    completedAt: string | null;
    listingId: string;
  }>;
  missingFields: string[];
  imageUrls: string[];
  storeListings: InventoryStoreListing[];
}

export function useInventoryListings(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  missingImages?: boolean;
  dateAddedFrom?: string;
  dateAddedTo?: string;
  brand?: string;
  make?: string;
  model?: string;
  category?: string;
  enabled?: boolean;
}) {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.missingImages) qs.set('missingImages', 'true');
  if (params.dateAddedFrom) qs.set('dateAddedFrom', params.dateAddedFrom);
  if (params.dateAddedTo) qs.set('dateAddedTo', params.dateAddedTo);
  if (params.brand) qs.set('brand', params.brand);
  if (params.make) qs.set('make', params.make);
  if (params.model) qs.set('model', params.model);
  if (params.category) qs.set('category', params.category);

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

/**
 * Poll enrichment status for a single listing.
 * Returns { status, stage } — stage tracks inline enrichment progress.
 * Auto-polls every 3s when status is 'ready' or 'enriching', stops when 'completed' or 'failed'.
 */
export function useEnrichmentStatus(listingId: string | null) {
  return useQuery({
    queryKey: ['enrichment-status', listingId],
    queryFn: ({ signal }) =>
      fetchJson<{ status: EnrichmentStatus; stage: string | null }>(
        `/inventory/listings/${listingId}/enrichment-status`,
        signal,
      ),
    enabled: Boolean(listingId),
    refetchInterval: (query) => {
      const data = query.state.data?.status;
      if (data === 'ready' || data === 'enriching') return 3000;
      return false;
    },
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

export interface InlineEnrichEnqueueResult {
  listingId: string;
  queued: boolean;
  reason?: string;
}

export function useInlineEnrichListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { listingId: string; force?: boolean }) => {
      const listingId = typeof args === 'string' ? args : args.listingId;
      const force = typeof args === 'string' ? undefined : args.force;
      return postJson<InlineEnrichEnqueueResult>('/inventory/inline-enrich', {
        listingId,
        force,
      });
    },
    onSuccess: (_data, args) => {
      const listingId = typeof args === 'string' ? args : args.listingId;
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['inventory-detail', listingId] });
      qc.invalidateQueries({ queryKey: ['inventory-enrichment-status', listingId] });
    },
  });
}

export function useRetryInventoryEnrichment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) =>
      postJson<InlineEnrichEnqueueResult>(
        `/inventory/listings/${listingId}/retry-enrichment`,
        {},
      ),
    onSuccess: (_data, listingId) => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['inventory-detail', listingId] });
      qc.invalidateQueries({ queryKey: ['inventory-enrichment-status', listingId] });
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

export function useUpdateInventoryImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      listingId: string;
      imageUrls: string[];
      uploadedAssetIds?: string[];
    }) =>
      fetchWithAuth<InventoryListingDetail>(
        `${API}/inventory/listings/${input.listingId}/images`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrls: input.imageUrls,
            uploadedAssetIds: input.uploadedAssetIds,
          }),
        },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['inventory-detail', vars.listingId] });
    },
  });
}

export function useReorderInventoryImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listingId: string; imageUrls: string[] }) =>
      fetchWithAuth<InventoryListingDetail>(
        `${API}/inventory/listings/${input.listingId}/images/reorder`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrls: input.imageUrls }),
        },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['inventory-detail', vars.listingId] });
    },
  });
}

/* ─── Filter metadata hooks ─── */

export function useFilterBrands() {
  return useQuery({
    queryKey: ['inventory-filter-brands'],
    queryFn: ({ signal }) => fetchJson<string[]>('/inventory/filters/brands', signal),
    staleTime: 60_000,
  });
}

export function useFilterMakes() {
  return useQuery({
    queryKey: ['inventory-filter-makes'],
    queryFn: ({ signal }) => fetchJson<string[]>('/inventory/filters/makes', signal),
    staleTime: 60_000,
  });
}

export function useFilterModels(make?: string) {
  return useQuery({
    queryKey: ['inventory-filter-models', make],
    queryFn: ({ signal }) => {
      const qs = make ? `?make=${encodeURIComponent(make)}` : '';
      return fetchJson<string[]>(`/inventory/filters/models${qs}`, signal);
    },
    staleTime: 60_000,
  });
}

export function useFilterCategories() {
  return useQuery({
    queryKey: ['inventory-filter-categories'],
    queryFn: ({ signal }) => fetchJson<string[]>('/inventory/filters/categories', signal),
    staleTime: 60_000,
  });
}

/* ─── Send to Catalog ─── */

export function useSendToCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingIds: string[]) =>
      postJson<{
        results: Array<{
          listingId: string;
          sku: string;
          catalogProductId: string | null;
          success: boolean;
          error?: string;
        }>;
      }>('/inventory/send-to-catalog', { listingIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      qc.invalidateQueries({ queryKey: ['catalog-products'] });
    },
  });
}

/* ─── Editor types & hooks ─── */

export interface EditorPolicyOption {
  id: string;
  ebayPolicyId: string;
  name: string;
  policyType: 'payment' | 'return' | 'fulfillment';
  marketplaceId: string;
}

export interface EditorStoreMarketplace {
  marketplaceId: string;
  label: string;
  defaultPaymentPolicyId: string | null;
  defaultReturnPolicyId: string | null;
  defaultFulfillmentPolicyId: string | null;
  defaultInventoryLocationKey: string | null;
  policies: {
    payment: EditorPolicyOption[];
    return: EditorPolicyOption[];
    fulfillment: EditorPolicyOption[];
  };
}

export interface EditorStore {
  id: string;
  name: string;
  ebayAccountId: string;
  ebayUserId: string;
  marketplaces: EditorStoreMarketplace[];
}

export interface EditorListingInfo {
  id: string;
  sku: string;
  title: string | null;
  brand: string | null;
  partType: string | null;
  mpn: string | null;
  oemNumber: string | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrls: string[];
  fitmentCount: number;
  status: string;
}

export interface EditorMarketplaceVersion {
  marketplace: 'US' | 'AU' | 'DE';
  title: string;
  description: string;
  price: number | null;
  quantity: number | null;
  conditionId: string;
  conditionDescription: string | null;
  itemSpecifics: Record<string, string>;
  fitmentSummary: string | null;
  seoScore: number | null;
  readinessScore: number | null;
}

export interface EditorResponse {
  listing: EditorListingInfo;
  marketplaceVersions: EditorMarketplaceVersion[];
  stores: EditorStore[];
}

export function useListingEditor(id: string | null) {
  return useQuery({
    queryKey: ['inventory-editor', id],
    queryFn: ({ signal }) =>
      fetchJson<EditorResponse>(`/inventory/${id}/editor`, signal),
    enabled: Boolean(id),
  });
}

export function useSaveListingEditor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      listingId: string;
      marketplaceVersions: Array<{
        marketplace: string;
        title: string;
        description: string;
        price?: number | null;
        quantity?: number | null;
        conditionId: string;
        conditionDescription?: string | null;
        itemSpecifics?: Record<string, string>;
      }>;
    }) =>
      fetchWithAuth<{ ok: boolean }>(`${API}/inventory/${input.listingId}/editor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceVersions: input.marketplaceVersions,
        }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['inventory-editor', vars.listingId] });
      qc.invalidateQueries({ queryKey: ['inventory-detail', vars.listingId] });
    },
  });
}
