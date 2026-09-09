import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';

export type EbayCategoryPolicies = {
  supportedConditions: string[];
  supportsVariations: boolean | null;
};

/**
 * Small Sell Metadata API client used by non-Motors category validation.
 * Conditions and listing-structure policies are seller/marketplace scoped,
 * so this client intentionally uses the store's user token rather than the
 * application token used by Taxonomy.
 */
@Injectable()
export class EbaySellingMetadataService {
  constructor(private readonly auth: EbayAuthService) {}

  async getCategoryPolicies(
    storeId: string,
    marketplaceId: string,
    categoryId: string,
  ): Promise<EbayCategoryPolicies> {
    const token = await this.auth.getAccessToken(storeId);
    const baseUrl = await this.auth.getApiBaseUrlForStore(storeId);
    const http: AxiosInstance = axios.create({
      baseURL: `${baseUrl}/sell/metadata/v1`,
      timeout: 20_000,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const [conditions, structures] = await Promise.all([
      http.get(`/marketplace/${encodeURIComponent(marketplaceId)}/get_item_condition_policies`, {
        params: { category_ids: categoryId },
      }),
      http.get(`/marketplace/${encodeURIComponent(marketplaceId)}/get_listing_structure_policies`, {
        params: { category_ids: categoryId },
      }),
    ]);

    const conditionPolicies = Array.isArray(conditions.data?.itemConditionPolicies)
      ? conditions.data.itemConditionPolicies
      : [];
    const categoryPolicy = conditionPolicies.find(
      (policy: Record<string, unknown>) => String(policy.categoryId ?? '') === categoryId,
    ) ?? conditionPolicies[0];
    const supportedConditions = Array.isArray(categoryPolicy?.conditionIdValues)
      ? categoryPolicy.conditionIdValues.map((value: Record<string, unknown>) => String(value.conditionId ?? value.id ?? '')).filter(Boolean)
      : [];

    const structurePolicies = Array.isArray(structures.data?.listingStructurePolicies)
      ? structures.data.listingStructurePolicies
      : [];
    const structure = structurePolicies.find(
      (policy: Record<string, unknown>) => String(policy.categoryId ?? '') === categoryId,
    ) ?? structurePolicies[0];
    const supportsVariations = typeof structure?.variationsSupported === 'boolean'
      ? structure.variationsSupported
      : typeof structure?.listingStructure === 'string'
        ? /variation/i.test(structure.listingStructure)
        : null;

    return { supportedConditions, supportsVariations };
  }
}
