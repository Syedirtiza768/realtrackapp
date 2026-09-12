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
const post = <T>(path: string, body: unknown) => fetchWithAuth<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const listFashionListings = (signal?: AbortSignal) => fetchWithAuth<FashionListing[]>(`${base}/listings?limit=200`, { signal });
export const getFashionListing = (id: string, signal?: AbortSignal) => fetchWithAuth<FashionListing>(`${base}/listings/${encoded(id)}`, { signal });
export const saveFashionListing = (draft: FashionDraft, id?: string) => fetchWithAuth<FashionListing>(`${base}/listings${id ? `/${encoded(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(draft) });
export const listFashionAccounts = (signal?: AbortSignal) => fetchWithAuth<FashionAccount[]>(`${base}/ebay/accounts`, { signal });
export const searchFashionCategories = (accountId: string, marketplaceId: string, q: string, signal?: AbortSignal) => fetchWithAuth<FashionCategory[]>(`${base}/ebay/accounts/${encoded(accountId)}/categories?${new URLSearchParams({ marketplaceId, q })}`, { signal });
export const getFashionMetadata = (accountId: string, marketplaceId: string, categoryId: string, signal?: AbortSignal) => fetchWithAuth<FashionMetadata>(`${base}/ebay/accounts/${encoded(accountId)}/categories/${encoded(categoryId)}/metadata?${new URLSearchParams({ marketplaceId })}`, { signal });
export const validateFashionListing = (id: string, account: FashionAccount) => post<{ results: FashionValidation[] }>(`${base}/ebay/listings/validate`, { catalogProductId: id, targets: [{ ebayAccountId: account.id, marketplaceId: account.marketplaceId }] });
export const publishFashionListing = (id: string, account: FashionAccount, idempotencyKey: string) => post<FashionPublishResult>(`${base}/ebay/listings/publish`, { catalogProductId: id, targets: [{ ebayAccountId: account.id, marketplaceId: account.marketplaceId }], idempotencyKey });
export const fashionError = (error: unknown) => error instanceof Error ? error.message : 'The request failed. Please try again.';
export const fashionAttributeKey = (key: string) => key.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_match, ch: string) => ch.toUpperCase());
export const fashionAttributeText = (value: FashionAttributes[string] | undefined) => Array.isArray(value) ? value.join(' | ') : String(value ?? '');
export const isFashionImageUrl = (value: string) => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
