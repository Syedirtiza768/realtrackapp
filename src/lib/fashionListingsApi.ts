import { fetchWithAuth } from './authApi';

export type FashionAttributes = Record<string, string | number | boolean | string[]>;
export interface FashionDraft {
  sku: string;
  title: string;
  description?: string;
  brand?: string;
  conditionId?: string;
  price?: number;
  quantity?: number;
  imageUrls?: string[];
  categoryId?: string;
  categoryName?: string;
  verticalAttributes: FashionAttributes;
}
export interface FashionListing {
  id: string;
  sku: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  conditionId: string | null;
  price: number | string | null;
  quantity: number | null;
  imageUrls: string[] | null;
  categoryId: string | null;
  categoryName: string | null;
  verticalAttributes: FashionAttributes | null;
  verticalValidationStatus: string;
  manualReview?: boolean;
  updatedAt: string;
}
export interface FashionAccount {
  id: string;
  accountName: string;
  ebayUsername: string;
  status: string;
  marketplaceId: string;
  storeId: string;
  storeName: string;
}
export interface FashionCategory {
  category: { categoryId: string; categoryName: string };
  categoryTreeNodeAncestors?: { categoryName: string }[];
}
export interface FashionMetadata {
  aspects: {
    localizedAspectName: string;
    aspectConstraint?: { aspectRequired?: boolean; aspectMode?: string; itemToAspectCardinality?: string };
    aspectValues?: { localizedValue: string }[];
  }[];
  supportedConditions: string[];
  supportsVariations: boolean | null;
}
export interface FashionValidation {
  key: string;
  status: 'ready' | 'warnings' | 'blocked';
  errors: string[];
  warnings: string[];
  requiredActions: string[];
}
export interface FashionPublishResult {
  jobId: string;
  status: string;
  skippedTargets: { ebayAccountId: string; marketplaceId: string; errors: string[] }[];
}
const base = '/api/fashion';
const encoded = encodeURIComponent;
const withOrg = (path: string, organizationId?: string | null) => organizationId ? `${path}${path.includes('?') ? '&' : '?'}organizationId=${encoded(organizationId)}` : path;
const post = <T>(path: string, body: unknown) => fetchWithAuth<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const listFashionListings = (signal?: AbortSignal, organizationId?: string | null) => fetchWithAuth<FashionListing[]>(withOrg(`${base}/listings?limit=200`, organizationId), { signal });
export const getFashionListing = (id: string, signal?: AbortSignal, organizationId?: string | null) => fetchWithAuth<FashionListing>(withOrg(`${base}/listings/${encoded(id)}`, organizationId), { signal });
export const saveFashionListing = (draft: FashionDraft, id?: string, organizationId?: string | null) => fetchWithAuth<FashionListing>(withOrg(`${base}/listings${id ? `/${encoded(id)}` : ''}`, organizationId), { method: id ? 'PATCH' : 'POST', body: JSON.stringify(draft) });
export const listFashionAccounts = (signal?: AbortSignal, organizationId?: string | null) => fetchWithAuth<FashionAccount[]>(withOrg(`${base}/ebay/accounts`, organizationId), { signal });
export const searchFashionCategories = (accountId: string, marketplaceId: string, q: string, signal?: AbortSignal, organizationId?: string | null) => fetchWithAuth<FashionCategory[]>(withOrg(`${base}/ebay/accounts/${encoded(accountId)}/categories?${new URLSearchParams({ marketplaceId, q })}`, organizationId), { signal });
export const getFashionMetadata = (accountId: string, marketplaceId: string, categoryId: string, signal?: AbortSignal, organizationId?: string | null) => fetchWithAuth<FashionMetadata>(withOrg(`${base}/ebay/accounts/${encoded(accountId)}/categories/${encoded(categoryId)}/metadata?${new URLSearchParams({ marketplaceId })}`, organizationId), { signal });
export const validateFashionListing = (id: string, account: FashionAccount, organizationId?: string | null) => post<{ results: FashionValidation[] }>(withOrg(`${base}/ebay/listings/validate`, organizationId), { catalogProductId: id, targets: [{ ebayAccountId: account.id, marketplaceId: account.marketplaceId }] });
export const publishFashionListing = (id: string, account: FashionAccount, idempotencyKey: string, organizationId?: string | null) => post<FashionPublishResult>(withOrg(`${base}/ebay/listings/publish`, organizationId), { catalogProductId: id, targets: [{ ebayAccountId: account.id, marketplaceId: account.marketplaceId }], idempotencyKey });

export interface FashionPhotoUpload {
  url: string;
  s3Key: string;
  filename: string;
}
export interface FashionAnalysisConflict {
  key: string;
  current: string;
  suggested: string;
}
export interface FashionAnalysisResult {
  status: 'suggested' | 'failed';
  attributes: FashionAttributes;
  suggestedKeys: string[];
  conflicts: FashionAnalysisConflict[];
  warnings: string[];
  validationErrors: string[];
  multipleItems: boolean;
  reviewPhotoSet: boolean;
  category: { categoryId: string | null; categoryName: string | null; query: string | null };
  brand: string | null;
  conditionLabel: string | null;
  title: string;
  description: string;
  suggestedSku: string;
  visibleText: string[];
}

/** With a SKU, stored files are named `<SKU>-<timestamp>-<id>.webp` for traceability. */
export async function uploadFashionPhotos(files: File[], organizationId?: string | null, sku?: string) {
  const body = new FormData();
  for (const file of files) body.append('files', file, file.name);
  const path = sku?.trim() ? `${base}/listings/photos?${new URLSearchParams({ sku: sku.trim() })}` : `${base}/listings/photos`;
  return fetchWithAuth<{ uploaded: FashionPhotoUpload[]; errors: string[] }>(withOrg(path, organizationId), { method: 'POST', body });
}

/* ── Quick capture: measurement charts, warehouses, batches, intake ── */

export type FashionMeasurementUnit = 'cm' | 'in';
export interface FashionMeasurementTemplate {
  id: string;
  label: string;
  chartTitle: string;
  family: 'clothing' | 'footwear' | 'accessories';
  keywords: string[];
  points: { letter: string; key: string; label: string }[];
  /** Constant server-generated schematic; render only as an <img> data URL. */
  diagramSvg: string;
}
export interface FashionWarehouse {
  id: string;
  code: string;
  name: string;
  countryCode: string | null;
  active: boolean;
}
export interface FashionBatch {
  batch: string;
  lastNumber: number;
  itemCount: number;
  lastUsedAt: string | null;
}
export type FashionAnalysisStatus = 'queued' | 'processing' | 'suggested' | 'failed' | 'skipped';
export interface FashionIntakePayload {
  sku: string;
  batch?: string;
  warehouseCode?: string;
  ebayAccountId?: string;
  marketplaceId?: string;
  conditionId?: string;
  department?: string;
  categoryFamily?: 'clothing' | 'footwear' | 'accessories';
  labelSize?: string;
  frontImageUrl: string;
  backImageUrl: string;
  tagImageUrls: string[];
  additionalImageUrls?: string[];
  sizeChartImageUrl?: string;
  sizeChartTemplate?: string;
  measurementsUnit?: FashionMeasurementUnit;
  measurementValues?: Record<string, string>;
  price?: number;
  quantity?: number;
  identify?: boolean;
}
export interface FashionIntakeItem {
  id: string;
  sku: string | null;
  title: string;
  batch: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  accountId: string | null;
  accountName: string | null;
  marketplaceId: string | null;
  imageCount: number;
  primaryImageUrl: string | null;
  analysisStatus: FashionAnalysisStatus | null;
  validationStatus: string;
  reviewStatus: string;
  hasSizeChart: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface FashionIntakePage {
  items: FashionIntakeItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const getFashionMeasurementTemplates = (signal?: AbortSignal, organizationId?: string | null) => fetchWithAuth<FashionMeasurementTemplate[]>(withOrg(`${base}/measurement-templates`, organizationId), { signal });
export const listFashionWarehouses = (signal?: AbortSignal, organizationId?: string | null, includeInactive = false) => fetchWithAuth<FashionWarehouse[]>(withOrg(`${base}/warehouses${includeInactive ? '?includeInactive=true' : ''}`, organizationId), { signal });
export const createFashionWarehouse = (warehouse: { code: string; name: string; countryCode?: string }, organizationId?: string | null) => post<FashionWarehouse>(withOrg(`${base}/warehouses`, organizationId), warehouse);
export const updateFashionWarehouse = (id: string, patch: { name?: string; countryCode?: string; active?: boolean }, organizationId?: string | null) => fetchWithAuth<FashionWarehouse>(withOrg(`${base}/warehouses/${encoded(id)}`, organizationId), { method: 'PATCH', body: JSON.stringify(patch) });
export const listFashionBatches = (signal?: AbortSignal, organizationId?: string | null) => fetchWithAuth<FashionBatch[]>(withOrg(`${base}/intake/batches`, organizationId), { signal });
export const nextFashionSku = (batch: string, sizeSuffix?: string, organizationId?: string | null) => post<{ batch: string; number: number; sku: string }>(withOrg(`${base}/intake/sku`, organizationId), { batch, ...(sizeSuffix ? { sizeSuffix } : {}) });
export const createFashionIntake = (payload: FashionIntakePayload, organizationId?: string | null) => post<FashionListing>(withOrg(`${base}/intake`, organizationId), payload);
export const listFashionIntake = (params: { batch?: string; status?: string; q?: string; source?: 'capture' | 'all'; page?: number; pageSize?: number }, signal?: AbortSignal, organizationId?: string | null) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value));
  return fetchWithAuth<FashionIntakePage>(withOrg(`${base}/intake?${query}`, organizationId), { signal });
};
export const requestFashionIdentification = (id: string, organizationId?: string | null) => post<{ id: string; analysisStatus: FashionAnalysisStatus }>(withOrg(`${base}/listings/${encoded(id)}/identify`, organizationId), {});
export const createFashionSizeChart = (payload: { template: string; unit: FashionMeasurementUnit; values: Record<string, string>; brandName?: string; sku?: string }, organizationId?: string | null) => post<{ url: string; s3Key: string }>(withOrg(`${base}/listings/size-chart`, organizationId), payload);
export const addFashionImageBanner = (payload: { imageUrl: string; text: string; position: 'top' | 'bottom'; theme: 'dark' | 'brand' | 'light' }, organizationId?: string | null) => post<{ url: string; s3Key: string }>(withOrg(`${base}/listings/photos/banner`, organizationId), payload);
export const fashionDiagramDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const analyzeFashionImages = (payload: {
  imageUrls: string[];
  currentAttributes?: FashionAttributes;
  confirmedKeys?: string[];
  sku?: string;
  currentTitle?: string;
  currentDescription?: string;
  currentBrand?: string;
  titleConfirmed?: boolean;
  descriptionConfirmed?: boolean;
  marketplaceId?: string;
}, organizationId?: string | null) => post<FashionAnalysisResult>(withOrg(`${base}/listings/analyze-images`, organizationId), payload);

export const generateFashionListingContent = (payload: {
  verticalAttributes: FashionAttributes;
  brand?: string;
  title?: string;
  description?: string;
  conditionLabel?: string;
  titleConfirmed?: boolean;
  descriptionConfirmed?: boolean;
}, organizationId?: string | null) => post<{ title: string; description: string; attributes: FashionAttributes; errors: string[]; warnings: string[] }>(withOrg(`${base}/listings/generate-content`, organizationId), payload);
export const fashionError = (error: unknown) => error instanceof Error ? error.message : 'The request failed. Please try again.';
export const fashionAttributeKey = (key: string) => key.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_match, ch: string) => ch.toUpperCase());
export const fashionAttributeText = (value: FashionAttributes[string] | undefined) => Array.isArray(value) ? value.join(' | ') : String(value ?? '');
export const isFashionImageUrl = (value: string) => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
