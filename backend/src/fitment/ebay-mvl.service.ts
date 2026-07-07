import { Injectable, Logger } from '@nestjs/common';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import {
  parseFitmentEntry,
  serializeValidatedFitmentRow,
  type ParsedFitmentRow,
} from './fitment-mvl.util.js';
import { resolveMvlMarketplaceFromTreeId } from './ebay-mvl-marketplace.util.js';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';

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

export type MvlRowStatus = 'valid' | 'needs_review' | 'rejected';

export interface MvlValidatedRow {
  row: ParsedFitmentRow;
  status: MvlRowStatus;
  rejectedReason?: string;
  serialized: Record<string, unknown>;
}

export interface MvlValidationSummary {
  accepted: Record<string, unknown>[];
  rejectedCount: number;
  needsReviewCount: number;
  validCount: number;
  apiUnavailable: boolean;
}

class MvlValueCache {
  private makes = new Map<string, Set<string>>();
  private models = new Map<string, Set<string>>();
  private years = new Map<string, Set<string>>();

  private makeKey(categoryId: string) {
    return categoryId;
  }

  private modelKey(categoryId: string, make: string) {
    return `${categoryId}|${make.toLowerCase()}`;
  }

  private yearKey(categoryId: string, make: string, model: string) {
    return `${categoryId}|${make.toLowerCase()}|${model.toLowerCase()}`;
  }

  hasMakeList(categoryId: string) {
    return this.makes.has(this.makeKey(categoryId));
  }

  hasModelList(categoryId: string, make: string) {
    return this.models.has(this.modelKey(categoryId, make));
  }

  hasYearList(categoryId: string, make: string, model: string) {
    return this.years.has(this.yearKey(categoryId, make, model));
  }

  setMakes(categoryId: string, values: string[]) {
    this.makes.set(
      this.makeKey(categoryId),
      new Set(values.map((v) => v.toLowerCase())),
    );
  }

  setModels(categoryId: string, make: string, values: string[]) {
    this.models.set(
      this.modelKey(categoryId, make),
      new Set(values.map((v) => v.toLowerCase())),
    );
  }

  setYears(categoryId: string, make: string, model: string, values: string[]) {
    this.years.set(this.yearKey(categoryId, make, model), new Set(values));
  }

  hasMake(categoryId: string, make: string) {
    return (
      this.makes.get(this.makeKey(categoryId))?.has(make.toLowerCase()) ?? false
    );
  }

  hasModel(categoryId: string, make: string, model: string) {
    return (
      this.models
        .get(this.modelKey(categoryId, make))
        ?.has(model.toLowerCase()) ?? false
    );
  }

  hasYear(categoryId: string, make: string, model: string, year: string) {
    return (
      this.years.get(this.yearKey(categoryId, make, model))?.has(year) ?? false
    );
  }
}

/**
 * EbayMvlService — eBay Master Vehicle List integration.
 *
 * Uses imported official MVL reference data (DB-first) with eBay Taxonomy API
 * compatibility endpoints as fallback when no local release is active.
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
    private readonly store: EbayMvlStoreService,
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

    const marketplace = resolveMvlMarketplaceFromTreeId(treeId);
    if (await this.store.hasActiveRelease(marketplace)) {
      return this.store.getPropertyValues(
        marketplace,
        propertyName,
        filters,
        query,
        limit,
        offset,
      );
    }

    return this.getPropertyValuesFromApi(
      categoryId,
      propertyName,
      filters,
      query,
      limit,
      offset,
      treeId,
    );
  }

  private async getPropertyValuesFromApi(
    categoryId: string,
    propertyName: string,
    filters: Record<string, string> = {},
    query?: string,
    limit = 100,
    offset = 0,
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    const rawValues = await this.taxonomyApi.getCompatibilityPropertyValues(
      treeId,
      categoryId,
      propertyName,
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    let options: PropertyValueOption[] = rawValues.map((v) => ({
      label: v.value,
      value: v.value,
    }));

    if (query) {
      const q = query.toLowerCase();
      options = options.filter((o) => o.label.toLowerCase().includes(q));
    }

    options.sort((a, b) => {
      const aNum = Number(a.value);
      const bNum = Number(b.value);
      if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
      return a.label.localeCompare(b.label);
    });

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
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    return this.getPropertyValues(
      categoryId,
      'Make',
      {},
      query,
      limit,
      offset,
      treeId,
    );
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
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    return this.getPropertyValues(
      categoryId,
      'Model',
      { Make: make },
      query,
      limit,
      offset,
      treeId,
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
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<{ options: PropertyValueOption[]; hasMore: boolean }> {
    return this.getPropertyValues(
      categoryId,
      'Year',
      {
        Make: make,
        Model: model,
      },
      undefined,
      100,
      0,
      treeId,
    );
  }

  /* ─── MVL validation & canonicalization ─── */

  /**
   * Match free-text make/model to canonical eBay MVL spellings (case-insensitive).
   */
  async resolveCanonicalMakeModel(
    categoryId: string,
    make: string,
    model?: string,
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<{ make?: string; model?: string; mvlMatched: boolean }> {
    const makeQuery = make.trim();
    if (!makeQuery) return { mvlMatched: false };

    const marketplace = resolveMvlMarketplaceFromTreeId(treeId);
    try {
      if (await this.store.hasActiveRelease(marketplace)) {
        return this.store.resolveCanonicalMakeModel(
          marketplace,
          makeQuery,
          model,
        );
      }

      const makes = await this.getMakes(categoryId, makeQuery, 100, 0, treeId);
      const canonicalMake = this.pickCanonical(makes.options, makeQuery);
      if (!canonicalMake) return { mvlMatched: false };

      if (!model?.trim()) {
        return { make: canonicalMake, mvlMatched: true };
      }

      const models = await this.getModels(
        categoryId,
        canonicalMake,
        model.trim(),
        100,
        0,
        treeId,
      );
      const canonicalModel = this.pickCanonical(models.options, model.trim());
      return {
        make: canonicalMake,
        model: canonicalModel ?? model.trim(),
        mvlMatched: Boolean(canonicalModel),
      };
    } catch (err) {
      this.logger.debug(
        `MVL canonicalization skipped: ${err instanceof Error ? err.message : err}`,
      );
      return { make: makeQuery, model: model?.trim(), mvlMatched: false };
    }
  }

  /**
   * Validate fitment rows against live eBay MVL (Taxonomy API).
   * Rejected rows are dropped from `accepted`; needs_review rows are kept with MvlStatus tag.
   */
  async validateFitmentData(
    fitmentData: Record<string, unknown>[] | null | undefined,
    categoryId: string,
    options?: { keepNeedsReview?: boolean; treeId?: string },
  ): Promise<MvlValidationSummary> {
    const empty: MvlValidationSummary = {
      accepted: [],
      rejectedCount: 0,
      needsReviewCount: 0,
      validCount: 0,
      apiUnavailable: false,
    };
    if (!Array.isArray(fitmentData) || fitmentData.length === 0) return empty;

    const parsedRows: ParsedFitmentRow[] = [];
    let parseRejected = 0;
    for (const raw of fitmentData) {
      const parsed = parseFitmentEntry(raw);
      if (parsed) parsedRows.push(parsed);
      else parseRejected++;
    }

    const keepNeedsReview = options?.keepNeedsReview !== false;
    const treeId = options?.treeId ?? EbayMvlService.DEFAULT_TREE_ID;
    const validated = await this.validateParsedRows(
      parsedRows,
      categoryId,
      treeId,
    );

    const accepted: Record<string, unknown>[] = [];
    let rejectedCount = parseRejected;
    let needsReviewCount = 0;
    let validCount = 0;
    const apiUnavailable = validated.some(
      (v) => v.rejectedReason === 'eBay MVL API unavailable',
    );

    for (const result of validated) {
      if (result.status === 'rejected') {
        rejectedCount++;
        continue;
      }
      if (result.status === 'needs_review') {
        needsReviewCount++;
        if (!keepNeedsReview) continue;
      } else {
        validCount++;
      }
      accepted.push(result.serialized);
    }

    return {
      accepted,
      rejectedCount,
      needsReviewCount,
      validCount,
      apiUnavailable,
    };
  }

  /** Validate parsed rows; returns one result per input row (preserves order). */
  async validateParsedRows(
    rows: ParsedFitmentRow[],
    categoryId: string,
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<MvlValidatedRow[]> {
    if (rows.length === 0) return [];

    const marketplace = resolveMvlMarketplaceFromTreeId(treeId);
    if (await this.store.hasActiveRelease(marketplace)) {
      return this.validateParsedRowsFromStore(rows, marketplace);
    }

    const cache = new MvlValueCache();
    const results: MvlValidatedRow[] = [];
    let consecutiveApiFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    let apiDisabled = false;

    for (const parsed of rows) {
      if (apiDisabled) {
        results.push({
          row: parsed,
          status: 'needs_review',
          rejectedReason: 'eBay MVL API unavailable',
          serialized: serializeValidatedFitmentRow(parsed, 'needs_review', {
            MvlRejectedReason: 'eBay MVL API unavailable',
          }),
        });
        continue;
      }

      try {
        results.push(
          await this.validateSingleRowFromApi(parsed, categoryId, cache, treeId),
        );
        consecutiveApiFailures = 0;
      } catch (err) {
        consecutiveApiFailures++;
        this.logger.warn(
          `MVL validation unavailable for ${parsed.make} ${parsed.model}: ${err instanceof Error ? err.message : err}`,
        );

        if (consecutiveApiFailures >= MAX_CONSECUTIVE_FAILURES) {
          apiDisabled = true;
          this.logger.warn(
            `MVL circuit breaker triggered after ${consecutiveApiFailures} consecutive failures — skipping remaining rows`,
          );
        }

        results.push({
          row: parsed,
          status: 'needs_review',
          rejectedReason: 'eBay MVL API unavailable',
          serialized: serializeValidatedFitmentRow(parsed, 'needs_review', {
            MvlRejectedReason: 'eBay MVL API unavailable',
          }),
        });
      }
    }

    return results;
  }

  private async validateSingleRowFromStore(
    parsed: ParsedFitmentRow,
    marketplace: ReturnType<typeof resolveMvlMarketplaceFromTreeId>,
  ): Promise<MvlValidatedRow> {
    let row = parsed;

    if (!(await this.store.hasMake(marketplace, row.make))) {
      const canonical = await this.store.resolveCanonicalMakeModel(
        marketplace,
        row.make,
      );
      if (canonical.make) row = { ...row, make: canonical.make };
    }

    if (!(await this.store.hasMake(marketplace, row.make))) {
      return {
        row,
        status: 'rejected',
        rejectedReason: `Make "${row.make}" not found in eBay MVL`,
        serialized: serializeValidatedFitmentRow(row, 'rejected', {
          MvlRejectedReason: `Make "${row.make}" not found in eBay MVL`,
          MvlSource: 'database',
        }),
      };
    }

    if (!(await this.store.hasModel(marketplace, row.make, row.model))) {
      const resolved = await this.store.resolveCanonicalMakeModel(
        marketplace,
        row.make,
        row.model,
      );
      if (resolved.model) row = { ...row, model: resolved.model };
    }

    if (!(await this.store.hasModel(marketplace, row.make, row.model))) {
      return {
        row,
        status: 'rejected',
        rejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
        serialized: serializeValidatedFitmentRow(row, 'rejected', {
          MvlRejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
          MvlSource: 'database',
        }),
      };
    }

    if (!(await this.store.hasYear(marketplace, row.make, row.model, row.year))) {
      return {
        row,
        status: 'needs_review',
        rejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
        serialized: serializeValidatedFitmentRow(row, 'needs_review', {
          MvlRejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
          MvlSource: 'database',
        }),
      };
    }

    return {
      row,
      status: 'valid',
      serialized: serializeValidatedFitmentRow(row, 'valid', {
        MvlSource: 'database',
      }),
    };
  }

  /**
   * Phased batched validation against the local MVL store.
   *
   * Semantically equivalent to calling validateSingleRowFromStore() per row,
   * but reorganizes the make → model → year cascade into three batched
   * phases so that ~16k per-row COUNT queries collapse to ~3-5 batched
   * queries plus a small number of canonicalization lookups for non-matching
   * makes/models. Result order is preserved.
   *
   * Phases:
   *  1. Batch-check make existence → identify makes needing canonicalization
   *  2. Canonicalize non-matching makes (concurrency-limited) → re-check
   *  3. Batch-check (make, model) existence → identify models needing canonicalization
   *  4. Canonicalize non-matching models (concurrency-limited) → re-check
   *  5. Batch-check (make, model, year) existence → mark needs_review
   */
  private async validateParsedRowsFromStore(
    rows: ParsedFitmentRow[],
    marketplace: ReturnType<typeof resolveMvlMarketplaceFromTreeId>,
  ): Promise<MvlValidatedRow[]> {
    const concurrency = Math.max(
      1,
      Number(process.env.MVL_VALIDATION_CONCURRENCY ?? '6') || 6,
    );

    // Mutable per-row working state (make/model may be canonicalized)
    const makes = rows.map((r) => r.make);
    const models = rows.map((r) => r.model);
    const years = rows.map((r) => r.year);
    const statuses: MvlRowStatus[] = new Array(rows.length).fill('valid');
    const reasons: string[] = new Array(rows.length).fill('');

    // ── Phase 1: batch make existence ──
    const uniqueMakes = [
      ...new Set(makes.map((m) => m.trim()).filter((m) => m.length > 0)),
    ];
    const existingMakes = await this.store.batchExistingMakes(
      marketplace,
      uniqueMakes,
    );

    // ── Phase 2: canonicalize non-matching makes (parallel) ──
    const makesNeedingCanonical = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const mkLower = makes[i].trim().toLowerCase();
      if (mkLower && !existingMakes.has(mkLower)) {
        makesNeedingCanonical.add(makes[i].trim());
      }
    }
    if (makesNeedingCanonical.size > 0) {
      const canonicalResults = await this.mapWithConcurrency(
        [...makesNeedingCanonical],
        concurrency,
        async (make) => {
          const result = await this.store.resolveCanonicalMakeModel(
            marketplace,
            make,
          );
          return { original: make, canonical: result.make };
        },
      );
      for (const { original, canonical } of canonicalResults) {
        if (!canonical) continue;
        for (let i = 0; i < rows.length; i++) {
          if (makes[i].trim().toLowerCase() === original.toLowerCase()) {
            makes[i] = canonical;
          }
        }
      }
      // Re-check existence for newly canonicalized makes
      const recheckMakes = [
        ...new Set(
          makes
            .map((m) => m.trim())
            .filter((m) => m.length > 0 && !existingMakes.has(m.toLowerCase())),
        ),
      ];
      if (recheckMakes.length > 0) {
        const additional = await this.store.batchExistingMakes(
          marketplace,
          recheckMakes,
        );
        for (const m of additional) existingMakes.add(m);
      }
    }

    // Mark make rejects
    for (let i = 0; i < rows.length; i++) {
      const mkLower = makes[i].trim().toLowerCase();
      if (!mkLower || !existingMakes.has(mkLower)) {
        statuses[i] = 'rejected';
        reasons[i] = `Make "${makes[i]}" not found in eBay MVL`;
      }
    }

    // ── Phase 3: batch (make, model) existence — only rows that passed make ──
    const modelCheckIdx = rows
      .map((_, i) => i)
      .filter((i) => statuses[i] === 'valid');
    const uniquePairs: Array<{ make: string; model: string }> = [];
    const seenPairs = new Set<string>();
    for (const i of modelCheckIdx) {
      const make = makes[i].trim();
      const model = models[i].trim();
      if (!make || !model) continue;
      const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        uniquePairs.push({ make, model });
      }
    }
    const existingModels = await this.store.batchExistingModels(
      marketplace,
      uniquePairs,
    );

    // ── Phase 4: canonicalize non-matching models (parallel) ──
    const modelsNeedingCanonical = new Set<string>();
    for (const i of modelCheckIdx) {
      const make = makes[i].trim();
      const model = models[i].trim();
      if (!make || !model) continue;
      const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
      if (!existingModels.has(key)) {
        modelsNeedingCanonical.add(`${make}|${model}`);
      }
    }
    if (modelsNeedingCanonical.size > 0) {
      const canonicalResults = await this.mapWithConcurrency(
        [...modelsNeedingCanonical],
        concurrency,
        async (pair) => {
          const [make, model] = pair.split('|');
          const result = await this.store.resolveCanonicalMakeModel(
            marketplace,
            make,
            model,
          );
          return { pair, canonicalModel: result.model, canonicalMake: result.make };
        },
      );
      for (const { pair, canonicalModel, canonicalMake } of canonicalResults) {
        if (!canonicalModel) continue;
        const [origMake, origModel] = pair.split('|');
        for (const i of modelCheckIdx) {
          if (
            makes[i].trim().toLowerCase() === origMake.toLowerCase() &&
            models[i].trim().toLowerCase() === origModel.toLowerCase()
          ) {
            models[i] = canonicalModel;
            if (canonicalMake) makes[i] = canonicalMake;
          }
        }
      }
      // Re-check existence for newly canonicalized pairs
      const recheckPairs: Array<{ make: string; model: string }> = [];
      const recheckSeen = new Set<string>();
      for (const i of modelCheckIdx) {
        const make = makes[i].trim();
        const model = models[i].trim();
        if (!make || !model) continue;
        const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
        if (!existingModels.has(key) && !recheckSeen.has(key)) {
          recheckSeen.add(key);
          recheckPairs.push({ make, model });
        }
      }
      if (recheckPairs.length > 0) {
        const additional = await this.store.batchExistingModels(
          marketplace,
          recheckPairs,
        );
        for (const m of additional) existingModels.add(m);
      }
    }

    // Mark model rejects
    for (const i of modelCheckIdx) {
      const make = makes[i].trim();
      const model = models[i].trim();
      const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
      if (!make || !model || !existingModels.has(key)) {
        statuses[i] = 'rejected';
        reasons[i] = `Model "${models[i]}" not valid for Make "${makes[i]}" on eBay MVL`;
      }
    }

    // ── Phase 5: batch (make, model, year) existence — only rows that passed model ──
    const yearCheckIdx = modelCheckIdx.filter((i) => statuses[i] === 'valid');
    const uniqueTriples: Array<{ make: string; model: string; year: string }> = [];
    const seenTriples = new Set<string>();
    for (const i of yearCheckIdx) {
      const make = makes[i].trim();
      const model = models[i].trim();
      const year = years[i];
      const key = `${make.toLowerCase()}|${model.toLowerCase()}|${year}`;
      if (!seenTriples.has(key)) {
        seenTriples.add(key);
        uniqueTriples.push({ make, model, year });
      }
    }
    const existingYears = await this.store.batchExistingYears(
      marketplace,
      uniqueTriples,
    );

    for (const i of yearCheckIdx) {
      const make = makes[i].trim();
      const model = models[i].trim();
      const key = `${make.toLowerCase()}|${model.toLowerCase()}|${years[i]}`;
      if (!existingYears.has(key)) {
        statuses[i] = 'needs_review';
        reasons[i] = `Year ${years[i]} not listed for ${makes[i]} ${models[i]} on eBay MVL`;
      }
    }

    // Build results in original order
    return rows.map((original, i) => {
      const row: ParsedFitmentRow = {
        ...original,
        make: makes[i],
        model: models[i],
      };
      const extra: Record<string, unknown> = { MvlSource: 'database' };
      if (reasons[i]) extra.MvlRejectedReason = reasons[i];
      return {
        row,
        status: statuses[i],
        rejectedReason: reasons[i] || undefined,
        serialized: serializeValidatedFitmentRow(row, statuses[i], extra),
      };
    });
  }

  /** Run an async mapper over items with bounded concurrency, preserving order. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const i = nextIndex++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
    );
    return results;
  }

  private async validateSingleRowFromApi(
    parsed: ParsedFitmentRow,
    categoryId: string,
    cache: MvlValueCache,
    treeId = EbayMvlService.DEFAULT_TREE_ID,
  ): Promise<MvlValidatedRow> {
    if (!cache.hasMakeList(categoryId)) {
      const makes = await this.getMakes(categoryId, undefined, 5000, 0, treeId);
      cache.setMakes(
        categoryId,
        makes.options.map((o) => o.value),
      );
    }

    let row = parsed;
    if (!cache.hasMake(categoryId, row.make)) {
      const canonical = await this.resolveCanonicalMakeModel(
        categoryId,
        row.make,
        undefined,
        treeId,
      );
      if (canonical.make) row = { ...row, make: canonical.make };
    }

    if (!cache.hasMake(categoryId, row.make)) {
      return {
        row,
        status: 'rejected',
        rejectedReason: `Make "${row.make}" not found in eBay MVL`,
        serialized: serializeValidatedFitmentRow(row, 'rejected', {
          MvlRejectedReason: `Make "${row.make}" not found in eBay MVL`,
        }),
      };
    }

    if (!cache.hasModelList(categoryId, row.make)) {
      const models = await this.getModels(
        categoryId,
        row.make,
        undefined,
        5000,
        0,
        treeId,
      );
      cache.setModels(
        categoryId,
        row.make,
        models.options.map((o) => o.value),
      );
    }

    if (!cache.hasModel(categoryId, row.make, row.model)) {
      const resolved = await this.resolveCanonicalMakeModel(
        categoryId,
        row.make,
        row.model,
        treeId,
      );
      if (resolved.model) row = { ...row, model: resolved.model };
    }

    if (!cache.hasModel(categoryId, row.make, row.model)) {
      return {
        row,
        status: 'rejected',
        rejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
        serialized: serializeValidatedFitmentRow(row, 'rejected', {
          MvlRejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
        }),
      };
    }

    if (!cache.hasYearList(categoryId, row.make, row.model)) {
      const years = await this.getYears(
        categoryId,
        row.make,
        row.model,
        treeId,
      );
      cache.setYears(
        categoryId,
        row.make,
        row.model,
        years.options.map((o) => o.value),
      );
    }

    if (!cache.hasYear(categoryId, row.make, row.model, row.year)) {
      return {
        row,
        status: 'needs_review',
        rejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
        serialized: serializeValidatedFitmentRow(row, 'needs_review', {
          MvlRejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
        }),
      };
    }

    return {
      row,
      status: 'valid',
      serialized: serializeValidatedFitmentRow(row, 'valid'),
    };
  }

  private pickCanonical(
    options: PropertyValueOption[],
    query: string,
  ): string | undefined {
    const q = query.toLowerCase();
    const exact = options.find((o) => o.value.toLowerCase() === q);
    if (exact) return exact.value;
    const prefix = options.find((o) => o.value.toLowerCase().startsWith(q));
    if (prefix) return prefix.value;
    const contains = options.find((o) => o.value.toLowerCase().includes(q));
    return contains?.value;
  }
}
