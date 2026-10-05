import { fetchWithAuth } from './authApi';

export type ProductVertical = 'automotive' | 'business_industrial' | 'fashion';

export interface VerticalConfig {
  enabledVerticals: ProductVertical[];
  defaultVertical: ProductVertical;
  workflows: Record<string, Record<string, unknown>>;
}

export interface VerticalStore {
  id: string;
  storeName: string;
  channel: string;
  verticalConfig: VerticalConfig;
}

export async function listVerticalStores(organizationId: string): Promise<VerticalStore[]> {
  return fetchWithAuth<VerticalStore[]>(
    `/api/verticals/stores?organizationId=${encodeURIComponent(organizationId)}`,
  );
}

export async function updateVerticalStoreConfig(
  storeId: string,
  organizationId: string,
  config: Partial<VerticalConfig>,
): Promise<VerticalConfig> {
  return fetchWithAuth<VerticalConfig>(
    `/api/verticals/stores/${encodeURIComponent(storeId)}/config?organizationId=${encodeURIComponent(organizationId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    },
  );
}
