import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import type {
  EbayCategoryTree,
  EbayCategorySubtree,
  EbayCategorySuggestion,
  EbayAspect,
  EbayCompatibilityProperty,
} from './ebay-api.types.js';

/**
 * EbayTaxonomyApiService — Typed client for the eBay Taxonomy API v1.
 *
 * Covers:
 *  - Category tree retrieval (default tree and specific nodes)
 *  - Category suggestions based on product keywords
 *  - Item aspects / category aspects for listing compliance
 *  - Compatibility properties for vehicle fitment (Parts & Accessories)
 *
 * Uses Application Token (client_credentials) since Taxonomy API
 * doesn't require user-level authorization.
 *
 * @see https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html
 */
@Injectable()
export class EbayTaxonomyApiService {
  private readonly logger = new Logger(EbayTaxonomyApiService.name);
  private readonly http: AxiosInstance;

  /** eBay Motors Parts & Accessories category tree ID (US) */
  static readonly EBAY_US_TREE_ID = '0';
  /** eBay US marketplace ID for taxonomy calls */
  static readonly EBAY_US_MARKETPLACE = 'EBAY_US';

  constructor(private readonly auth: EbayAuthService) {
    const config = this.auth.getApiConfig();
    this.http = axios.create({
      baseURL: `${config.baseUrl}/commerce/taxonomy/v1`,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ──────────────────────────── helpers ────────────────────────────

  private async appHeaders(): Promise<AxiosRequestConfig> {
    const token = await this.auth.getApplicationToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  // ──────────────────────────── Category Trees ────────────────────

  /**
   * Get the default category tree ID for a marketplace.
   */
  async getDefaultCategoryTreeId(
    marketplace = EbayTaxonomyApiService.EBAY_US_MARKETPLACE,
  ): Promise<string> {
    const cfg = await this.appHeaders();
    const { data } = await this.http.get(`/get_default_category_tree_id`, {
      ...cfg,
      params: { marketplace_id: marketplace },
    });
    return data.categoryTreeId;
  }

  /**
   * Get the full category tree.
   */
  async getCategoryTree(treeId?: string): Promise<EbayCategoryTree> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    const cfg = await this.appHeaders();
    const { data } = await this.http.get<EbayCategoryTree>(
      `/category_tree/${id}`,
      cfg,
    );
    return data;
  }

  /**
   * Get a category subtree (a specific node and all its descendants).
   */
  async getCategorySubtree(
    categoryId: string,
    treeId?: string,
  ): Promise<EbayCategorySubtree> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    const cfg = await this.appHeaders();
    const { data } = await this.http.get<EbayCategorySubtree>(
      `/category_tree/${id}/get_category_subtree`,
      { ...cfg, params: { category_id: categoryId } },
    );
    return data;
  }

  // ──────────────────────────── Category Suggestions ──────────────

  /**
   * Get category suggestions based on product keywords.
   * Returns ranked list of matching categories.
   */
  async getCategorySuggestions(
    query: string,
    treeId?: string,
  ): Promise<EbayCategorySuggestion[]> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    const cfg = await this.appHeaders();
    const { data } = await this.http.get(
      `/category_tree/${id}/get_category_suggestions`,
      { ...cfg, params: { q: query } },
    );
    return data.categorySuggestions ?? [];
  }

  // ──────────────────────────── Item Aspects ──────────────────────

  /**
   * Get the item aspects for a specific category.
   * These define the required/recommended item specifics for listings.
   */
  async getItemAspectsForCategory(
    categoryId: string,
    treeId?: string,
  ): Promise<EbayAspect[]> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    const cfg = await this.appHeaders();
    const { data } = await this.http.get(
      `/category_tree/${id}/get_item_aspects_for_category`,
      { ...cfg, params: { category_id: categoryId } },
    );
    return data.aspects ?? [];
  }

  // ──────────────────────────── Compatibility Properties ──────────

  /**
   * Get the compatibility properties for a given category.
   * Used for vehicle fitment — returns properties like Make, Model, Year, Trim, Engine.
   */
  async getCompatibilityProperties(
    categoryTreeId: string,
    categoryId: string,
  ): Promise<EbayCompatibilityProperty[]> {
    const cfg = await this.appHeaders();
    const { data } = await this.http.get(
      `/category_tree/${categoryTreeId}/get_compatibility_properties`,
      { ...cfg, params: { category_id: categoryId } },
    );
    return data.compatibilityProperties ?? [];
  }

  /**
   * Get the compatibility property values for a given property.
   * e.g. given "Make" property, returns "Toyota", "Ford", etc.
   *
   * Supports optional filter to narrow results (e.g. pass Make=Toyota to filter Models).
   */
  async getCompatibilityPropertyValues(
    categoryTreeId: string,
    categoryId: string,
    compatibilityPropertyName: string,
    filter?: Record<string, string>,
  ): Promise<{ value: string; applicableProperties?: Record<string, string> }[]> {
    const cfg = await this.appHeaders();
    const params: Record<string, string> = {
      category_id: categoryId,
      compatibility_property: compatibilityPropertyName,
    };

    // Build filter string: {"propertyName":"value","propertyName2":"value2"}
    if (filter && Object.keys(filter).length > 0) {
      params.filter = Object.entries(filter)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
    }

    const { data } = await this.http.get(
      `/category_tree/${categoryTreeId}/get_compatibility_property_values`,
      { ...cfg, params },
    );
    return data.compatibilityPropertyValues ?? [];
  }

  // ──────────────────────────── Convenience Methods ───────────────

  /**
   * Get vehicle compatibility chain for Parts & Accessories:
   * Year → Make → Model → Trim → Engine
   *
   * Returns all available values for the given level, optionally
   * filtered by parent selections.
   */
  async getVehicleValues(
    level: 'Year' | 'Make' | 'Model' | 'Trim' | 'Engine',
    categoryId: string,
    parentSelections?: Record<string, string>,
    treeId?: string,
  ): Promise<string[]> {
    const id = treeId ?? EbayTaxonomyApiService.EBAY_US_TREE_ID;
    const values = await this.getCompatibilityPropertyValues(
      id,
      categoryId,
      level,
      parentSelections,
    );
    return values.map((v) => v.value).sort();
  }
}
