import { Injectable, Logger } from '@nestjs/common';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';

/* ── Types ── */

export interface CompatibilityProperty {
  propertyName: string;
  localizedPropertyName: string;
}

export interface CompatibilityTree {
  categoryId: string;
  categoryTreeId: string;
  properties: CompatibilityProperty[];
}

export interface PropertyValueOption {
  label: string;
  value: string;
}

export interface FitmentSelection {
  make: string;
  model: string;
  year: string;
  trim?: string;
  engine?: string;
  notes?: string;
}

export interface EbayCompatibilityEntry {
  compatibilityProperties: Array<{ name: string; value: string }>;
  notes?: string;
}

/**
 * EbayMvlService — eBay Master Vehicle List integration.
 *
 * Uses the eBay Taxonomy API compatibility endpoints to:
 * 1. Fetch the compatibility property tree for a category
 * 2. Cascade: Make → Model → Year → Trim → Engine values
 * 3. Build eBay-format compatibility arrays from user selections
 *
 * Designed for use with async SearchableSelect frontend components
 * that fetch each cascade level independently.
 */
@Injectable()
export class EbayMvlService {
  private readonly logger = new Logger(EbayMvlService.name);

  /** Default category tree ID for eBay US */
  private static readonly DEFAULT_TREE_ID = '0';

  /** eBay Motors Parts & Accessories root category */
  static readonly MOTORS_PARTS_CATEGORY = '6000';

  constructor(
    private readonly taxonomyApi: EbayTaxonomyApiService,
  ) {}

  /* ─── Compatibility Tree ─── */

  /**
   * Fetch the compatibility property tree for a given eBay category.
   * Returns the ordered list of property names (Make, Model, Year, etc.)
   * available for the category.
   */
  async fetchCompatibilityTree(
    categoryId: string,
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<CompatibilityTree> {
    this.logger.debug(`Fetching compatibility tree for category ${categoryId}`);

    const rawProps = await this.taxonomyApi.getCompatibilityProperties(
      treeId,
      categoryId,
    );

    const properties: CompatibilityProperty[] = rawProps.map((p) => ({
      propertyName: p.propertyName,
      localizedPropertyName: p.localizedPropertyName ?? p.propertyName,
    }));

    return {
      categoryId,
      categoryTreeId: treeId,
      properties,
    };
  }

  /* ─── Cascading Property Values ─── */

  /**
   * Get the available values for a compatibility property,
   * optionally filtered by parent selections (cascading).
   *
   * Example:
   *   getPropertyValues('6000', 'Model', { Make: 'Toyota' })
   *   → [{ label: 'Camry', value: 'Camry' }, ...]
   *
   * @param categoryId  eBay category ID
   * @param propertyName  e.g. 'Make', 'Model', 'Year', 'Trim', 'Engine'
   * @param filters  Parent property filters for cascading
   * @param query  Optional text filter for search-as-you-type
   * @param limit  Max results to return (default 100)
   * @param offset  Pagination offset (default 0)
   * @param treeId  Category tree ID (default '0' for US)
   */
  async getPropertyValues(
    categoryId: string,
    propertyName: string,
    filters: Record<string, string> = {},
    query?: string,
    limit = 100,
    offset = 0,
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    this.logger.debug(
      `Fetching ${propertyName} values for category ${categoryId} with filters: ${JSON.stringify(filters)}`,
    );

    const rawValues = await this.taxonomyApi.getCompatibilityPropertyValues(
      treeId,
      categoryId,
      propertyName,
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    // Map raw values to label/value pairs
    let options: PropertyValueOption[] = rawValues.map((v) => ({
      label: v.value,
      value: v.value,
    }));

    // Apply text filter if provided (client-side filter over eBay results)
    if (query) {
      const q = query.toLowerCase();
      options = options.filter((o) => o.label.toLowerCase().includes(q));
    }

    // Sort alphabetically, with numeric values (years) sorted descending
    options.sort((a, b) => {
      const aNum = Number(a.value);
      const bNum = Number(b.value);
      if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum; // Years descending
      return a.label.localeCompare(b.label);
    });

    // Apply pagination
    const paginated = options.slice(offset, offset + limit);

    return {
      options: paginated,
      hasMore: offset + limit < options.length,
    };
  }

  /* ─── Build eBay Compatibility Array ─── */

  /**
   * Convert user fitment selections into the eBay-format compatibility
   * array required by the Inventory API createOrReplaceInventoryItem
   * and createOffer endpoints.
   *
   * @see https://developer.ebay.com/api-docs/sell/inventory/types/sel:Compatibility
   */
  buildCompatibilityArray(
    selections: FitmentSelection[],
  ): EbayCompatibilityEntry[] {
    return selections.map((s) => {
      const properties: Array<{ name: string; value: string }> = [
        { name: 'Make', value: s.make },
        { name: 'Model', value: s.model },
        { name: 'Year', value: s.year },
      ];

      if (s.trim) {
        properties.push({ name: 'Trim', value: s.trim });
      }
      if (s.engine) {
        properties.push({ name: 'Engine', value: s.engine });
      }

      return {
        compatibilityProperties: properties,
        ...(s.notes ? { notes: s.notes } : {}),
      };
    });
  }

  /* ─── Convenience: Get Makes ─── */

  /**
   * Shorthand to fetch available Makes for a category.
   */
  async getMakes(
    categoryId: string,
    query?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    return this.getPropertyValues(categoryId, 'Make', {}, query, limit, offset);
  }

  /* ─── Convenience: Get Models ─── */

  /**
   * Shorthand to fetch Models filtered by Make.
   */
  async getModels(
    categoryId: string,
    make: string,
    query?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    return this.getPropertyValues(
      categoryId,
      'Model',
      { Make: make },
      query,
      limit,
      offset,
    );
  }

  /* ─── Convenience: Get Years ─── */

  /**
   * Shorthand to fetch Years filtered by Make + Model.
   */
  async getYears(
    categoryId: string,
    make: string,
    model: string,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    return this.getPropertyValues(categoryId, 'Year', {
      Make: make,
      Model: model,
    });
  }
}
