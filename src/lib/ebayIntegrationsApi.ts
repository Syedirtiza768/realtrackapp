/**
 * Authenticated client for org-scoped eBay integrations (/api/integrations/ebay, /api/ebay).
 */
import { fetchWithAuth } from './authApi';

const API = '/api';

export type WorkspaceContext = {
  organizationId: string;
  organizationName: string;
  organizations: {
    organizationId: string;
    name: string;
    slug: string;
    role: string;
  }[];
};

export async function getEbayWorkspace(): Promise<WorkspaceContext> {
  return fetchWithAuth(`${API}/integrations/ebay/workspace`);
}

export type EbayAccountSummary = {
  id: string;
  accountDisplayName: string;
  ebayUserId: string;
  environment: string;
  connectionStatus: string;
  connectionSource?: 'native_oauth' | 'sellerpundit';
  sellerpunditTokenId?: number | null;
  sellerpunditAccountName?: string | null;
  sellerpunditLastSyncAt?: string | null;
  sellerpunditLastPolicySyncAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastListingsFetchedCount?: number;
  lastPoliciesFetchedCount?: number;
  lastErrorMessage?: string | null;
  marketplaces: {
    marketplaceId: string;
    enabled: boolean;
    defaultPaymentPolicyId?: string | null;
    defaultReturnPolicyId?: string | null;
    defaultFulfillmentPolicyId?: string | null;
    defaultInventoryLocationKey?: string | null;
  }[];
};

function orgQuery(organizationId?: string): string {
  return organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : '';
}

export async function listEbayAccounts(
  organizationId?: string,
): Promise<EbayAccountSummary[]> {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts${orgQuery(organizationId)}`,
  );
}

export async function getEbayAccount(
  accountId: string,
  organizationId?: string,
): Promise<EbayAccountSummary> {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}${orgQuery(organizationId)}`,
  );
}

export async function startEbayOAuth(body: {
  organizationId?: string;
  marketplaceId: string;
  environment: 'sandbox' | 'production';
  accountDisplayName?: string;
  internalStoreId?: string;
}): Promise<{ authUrl: string; state: string }> {
  return fetchWithAuth(`${API}/integrations/ebay/oauth/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function syncEbayPolicies(
  accountId: string,
  organizationId?: string,
): Promise<{ ok: boolean; synced: number; message: string }> {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}/sync-policies${orgQuery(organizationId)}`,
    { method: 'POST' },
  );
}

export async function syncEbayListings(
  accountId: string,
  organizationId?: string,
  marketplaceId?: string,
): Promise<{ jobId: string; syncLogId: string }> {
  const base = orgQuery(organizationId);
  const mp = marketplaceId
    ? `${base ? '&' : '?'}marketplaceId=${encodeURIComponent(marketplaceId)}`
    : '';
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}/sync-listings${base}${mp}`,
    { method: 'POST' },
  );
}

export async function disconnectEbayAccount(
  accountId: string,
  organizationId?: string,
): Promise<{ ok: boolean }> {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}/disconnect${orgQuery(organizationId)}`,
    { method: 'POST' },
  );
}

export async function syncEbayOrders(
  accountId: string,
  organizationId?: string,
): Promise<{ jobId: string }> {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}/sync-orders${orgQuery(organizationId)}`,
    { method: 'POST' },
  );
}

export async function validateEbayListing(body: {
  organizationId?: string;
  catalogProductId: string;
  targets: { ebayAccountId: string; marketplaceId: string }[];
}) {
  return fetchWithAuth(`${API}/ebay/listings/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function publishEbayListing(body: {
  organizationId?: string;
  catalogProductId: string;
  targets: { ebayAccountId: string; marketplaceId: string }[];
  idempotencyKey?: string;
}) {
  return fetchWithAuth(`${API}/ebay/listings/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getEbayListingJob(
  jobId: string,
  organizationId?: string,
) {
  return fetchWithAuth(
    `${API}/ebay/listing-jobs/${jobId}${orgQuery(organizationId)}`,
  );
}

export type EbayListingJobTargetRow = {
  id: string;
  catalogProductId: string;
  ebayAccountId: string;
  marketplaceId: string;
  status: string;
  resultPayload?: {
    offerId?: string;
    listingId?: string;
    warnings?: string[];
    sellerPundit?: unknown;
  } | null;
  errorPayload?: {
    source?: string;
    stage?: string;
    message?: string;
    errors?: string[];
    warnings?: string[];
    sellerPundit?: unknown;
  } | null;
};

export async function getEbayListingJobTargets(
  jobId: string,
  organizationId?: string,
): Promise<EbayListingJobTargetRow[]> {
  return fetchWithAuth(
    `${API}/ebay/listing-jobs/${jobId}/targets${orgQuery(organizationId)}`,
  );
}

export async function listEbaySyncLogs(
  accountId: string,
  organizationId?: string,
) {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}/sync-logs${orgQuery(organizationId)}`,
  );
}

export async function getEbayAccountPolicies(
  accountId: string,
  organizationId?: string,
): Promise<{ account: unknown; policies: unknown[] }> {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}/policies${orgQuery(organizationId)}`,
  );
}

export async function patchEbayDefaultPolicies(
  accountId: string,
  organizationId: string | undefined,
  body: {
    marketplaceId: string;
    defaultPaymentPolicyId: string | null;
    defaultReturnPolicyId: string | null;
    defaultFulfillmentPolicyId: string | null;
    defaultInventoryLocationKey: string | null;
  },
) {
  return fetchWithAuth(
    `${API}/integrations/ebay/accounts/${accountId}/default-policies${orgQuery(organizationId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}
