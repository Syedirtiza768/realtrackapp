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

export async function uploadFashionPhotos(files: File[], organizationId?: string | null) {
  const body = new FormData();
  for (const file of files) body.append('files', file, file.name);
  return fetchWithAuth<{ uploaded: FashionPhotoUpload[]; errors: string[] }>(withOrg(`${base}/listings/photos`, organizationId), { method: 'POST', body });
}

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
