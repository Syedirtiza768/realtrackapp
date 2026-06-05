/**
 * SellerPundit bridge under /api/integrations/ebay/sellerpundit
 */
import { fetchWithAuth } from './authApi';

const API = '/api';

function orgQuery(organizationId?: string): string {
  return organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : '';
}

export type SellerpunditConfigView = {
  enabled: boolean;
  configured: boolean;
  hasOrgCredentials: boolean;
  lastJwtRefreshAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

export async function getSellerpunditConfig(
  organizationId?: string,
): Promise<SellerpunditConfigView> {
  return fetchWithAuth(
    `${API}/integrations/ebay/sellerpundit/config${orgQuery(organizationId)}`,
  );
}

export async function updateSellerpunditConfig(
  body: { email?: string; password?: string; enabled?: boolean },
  organizationId?: string,
): Promise<SellerpunditConfigView> {
  return fetchWithAuth(
    `${API}/integrations/ebay/sellerpundit/config${orgQuery(organizationId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export async function testSellerpunditConnection(
  organizationId?: string,
): Promise<{ ok: boolean; storeCount: number }> {
  return fetchWithAuth(
    `${API}/integrations/ebay/sellerpundit/test-connection${orgQuery(organizationId)}`,
    { method: 'POST' },
  );
}

export async function syncSellerpunditStores(
  organizationId?: string,
): Promise<{
  imported: number;
  updated: number;
  skipped: number;
  accounts: string[];
}> {
  return fetchWithAuth(
    `${API}/integrations/ebay/sellerpundit/sync/stores${orgQuery(organizationId)}`,
    { method: 'POST' },
  );
}

export async function syncSellerpunditPolicies(
  organizationId?: string,
  accountId?: string,
): Promise<unknown> {
  const base = orgQuery(organizationId);
  const q =
    accountId && base
      ? `${base}&accountId=${encodeURIComponent(accountId)}`
      : accountId
        ? `?accountId=${encodeURIComponent(accountId)}`
        : base;
  return fetchWithAuth(
    `${API}/integrations/ebay/sellerpundit/sync/policies${q}`,
    { method: 'POST' },
  );
}

export async function syncSellerpunditAll(
  organizationId?: string,
): Promise<{ stores: unknown; policies: unknown }> {
  return fetchWithAuth(
    `${API}/integrations/ebay/sellerpundit/sync/all${orgQuery(organizationId)}`,
    { method: 'POST' },
  );
}
