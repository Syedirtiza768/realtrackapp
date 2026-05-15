import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

export interface EbayPolicyListItem {
  ebayPolicyId: string;
  name: string;
  isDefault: boolean;
  raw: Record<string, unknown>;
}

/**
 * Thin HTTP client for eBay Sell Account + Inventory location list endpoints.
 * Callers supply access token and API base URL (sandbox vs production).
 */
@Injectable()
export class EbaySellAccountApiService {
  private readonly logger = new Logger(EbaySellAccountApiService.name);

  private client(baseUrl: string): AxiosInstance {
    return axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: 45_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async listFulfillmentPolicies(
    accessToken: string,
    baseUrl: string,
    marketplaceId: string,
  ): Promise<EbayPolicyListItem[]> {
    return this.listPaged<EbayPolicyListItem>(
      accessToken,
      baseUrl,
      '/sell/account/v1/fulfillment_policy',
      marketplaceId,
      (data) => {
        const policies = (data as { fulfillmentPolicies?: unknown[] }).fulfillmentPolicies ?? [];
        return policies.map((p) => {
          const row = p as Record<string, unknown>;
          const id = String(row.fulfillmentPolicyId ?? row.fulfillment_policy_id ?? '');
          const name = String(row.name ?? id);
          const isDefault = this.readDefaultFlag(row);
          return { ebayPolicyId: id, name, isDefault, raw: row as Record<string, unknown> };
        });
      },
    );
  }

  async listPaymentPolicies(
    accessToken: string,
    baseUrl: string,
    marketplaceId: string,
  ): Promise<EbayPolicyListItem[]> {
    return this.listPaged<EbayPolicyListItem>(
      accessToken,
      baseUrl,
      '/sell/account/v1/payment_policy',
      marketplaceId,
      (data) => {
        const policies = (data as { paymentPolicies?: unknown[] }).paymentPolicies ?? [];
        return policies.map((p) => {
          const row = p as Record<string, unknown>;
          const id = String(row.paymentPolicyId ?? row.payment_policy_id ?? '');
          const name = String(row.name ?? id);
          const isDefault = this.readDefaultFlag(row);
          return { ebayPolicyId: id, name, isDefault, raw: row as Record<string, unknown> };
        });
      },
    );
  }

  async listReturnPolicies(
    accessToken: string,
    baseUrl: string,
    marketplaceId: string,
  ): Promise<EbayPolicyListItem[]> {
    return this.listPaged<EbayPolicyListItem>(
      accessToken,
      baseUrl,
      '/sell/account/v1/return_policy',
      marketplaceId,
      (data) => {
        const policies = (data as { returnPolicies?: unknown[] }).returnPolicies ?? [];
        return policies.map((p) => {
          const row = p as Record<string, unknown>;
          const id = String(row.returnPolicyId ?? row.return_policy_id ?? '');
          const name = String(row.name ?? id);
          const isDefault = this.readDefaultFlag(row);
          return { ebayPolicyId: id, name, isDefault, raw: row as Record<string, unknown> };
        });
      },
    );
  }

  /**
   * Merchant inventory locations (for merchantLocationKey on offers).
   */
  async listInventoryLocations(
    accessToken: string,
    baseUrl: string,
    marketplaceId: string,
  ): Promise<{ merchantLocationKey: string; name: string; raw: Record<string, unknown> }[]> {
    const http = this.client(baseUrl);
    const out: { merchantLocationKey: string; name: string; raw: Record<string, unknown> }[] = [];
    let offset = 0;
    const limit = 50;
    for (;;) {
      const { data } = await http.get('/sell/inventory/v1/location', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
        params: { limit, offset },
      });
      const locs = (data as { locations?: unknown[] }).locations ?? [];
      for (const l of locs) {
        const row = l as Record<string, unknown>;
        const key = String(row.merchantLocationKey ?? '');
        if (!key) continue;
        const name = String(row.name ?? key);
        out.push({ merchantLocationKey: key, name, raw: row as Record<string, unknown> });
      }
      if (locs.length < limit) break;
      offset += limit;
    }
    return out;
  }

  private readDefaultFlag(row: Record<string, unknown>): boolean {
    const labels = row.label;
    if (Array.isArray(labels)) {
      return labels.some((l) => String(l).toUpperCase().includes('DEFAULT'));
    }
    return false;
  }

  private async listPaged<T extends EbayPolicyListItem>(
    accessToken: string,
    baseUrl: string,
    path: string,
    marketplaceId: string,
    mapPage: (data: unknown) => T[],
  ): Promise<T[]> {
    const http = this.client(baseUrl);
    const out: T[] = [];
    let offset = 0;
    const limit = 20;
    for (;;) {
      try {
        const { data } = await http.get(path, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
          },
          params: {
            marketplace_id: marketplaceId,
            limit,
            offset,
          },
        });
        const batch = mapPage(data).filter((p) => p.ebayPolicyId);
        out.push(...batch);
        if (batch.length < limit) break;
        offset += limit;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`eBay policy list failed ${path} mp=${marketplaceId} offset=${offset}: ${msg}`);
        throw err;
      }
    }
    return out;
  }
}
