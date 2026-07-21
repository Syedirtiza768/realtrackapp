import { Injectable, Logger } from '@nestjs/common';
import { EbayMvlService } from '../fitment/ebay-mvl.service.js';
import { MvlFitmentExpanderService } from '../fitment/mvl-fitment-expander.service.js';
import type { MvlValidatedRow } from '../fitment/ebay-mvl.service.js';
import type { ParsedFitmentRow } from '../fitment/fitment-mvl.util.js';
import {
  isOverExpandedFitment,
  MAX_FITMENT_YEAR_SPAN,
  pickDonorYear,
} from '../fitment/mvl-donor-scope.util.js';
import { VinDecodeService } from '../fitment/vin-decode.service.js';
import { resolveCategoryTreeId } from '../channels/ebay/ebay-marketplace-tree.util.js';
import { extractMakeModelFromTitle } from '../listings/utils/extract-make-model-from-title.js';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import type {
  FitmentRow,
  FitmentStatus,
} from './listing-optimization.types.js';

const VIN_REGEX = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export interface FitmentDiscoveryResult {
  status: FitmentStatus;
  confidence: number;
  rows: FitmentRow[];
  donorVinDecoded: Record<string, unknown> | null;
  donorVin: string | null;
  categorySupportsCompatibility: boolean;
  manualReviewReasons: string[];
  /** Category resolved from eBay catalog lookup (when no other source had a category) */
  ebayCatalogCategoryId?: string | null;
  ebayCatalogCategoryName?: string | null;
}

@Injectable()
export class FitmentDiscoveryService {
  private readonly logger = new Logger(FitmentDiscoveryService.name);

  constructor(
    private readonly vinDecode: VinDecodeService,
    private readonly mvl: EbayMvlService,
    private readonly mvlExpander: MvlFitmentExpanderService,
  ) {}

  async discover(
    product: CatalogProduct,
    options?: {
      marketplace?: string | null;
      categoryId?: string;
    },
  ): Promise<FitmentDiscoveryResult> {
    const manualReviewReasons: string[] = [];
    const donorVin = this.extractDonorVin(product);
    let donorVinDecoded: Record<string, unknown> | null = null;

    // Resolve the target marketplace's category tree + category id. Defaults
    // to the US tree + the product's own category (or the Motors P&A root).
    const treeId = resolveCategoryTreeId(options?.marketplace ?? null);
    const categoryId =
      options?.categoryId ??
      product.categoryId ??
      EbayMvlService.MOTORS_PARTS_CATEGORY;
    // eBay Motors P&A categories always support vehicle compatibility.
    // No need to call the Taxonomy API — the MVL database provides the
    // authoritative vehicle data and the fitment pipeline uses it directly.
    let categorySupportsCompatibility = true;

    const candidates: FitmentRow[] = [];

    // ── Source 1: Existing catalog fitment_data (JSONB) ──
    // Reject unscoped full-model MVL dumps (e.g. every Jetta 1980–2027).
    if (Array.isArray(product.fitmentData)) {
      const rawRows = product.fitmentData as Array<Record<string, unknown>>;
      if (isOverExpandedFitment(rawRows)) {
        manualReviewReasons.push(
          `Existing catalog fitment looks over-expanded (span > ${MAX_FITMENT_YEAR_SPAN}yr or huge row count) — ignoring and rediscovering`,
        );
        this.logger.warn(
          `Discarding over-expanded catalog fitment for ${product.sku ?? product.id}: ${rawRows.length} rows`,
        );
      } else {
        for (const raw of rawRows) {
          const row = this.rowFromRaw(raw, 'catalog_fitment');
          if (row) candidates.push(row);
        }
      }
    }

    // ── Source 2: Title parsing (local, fast) ──
    // Titles follow "[Year Range] [Make] [Model] [Part Name] [MPN] [Condition]"
    // e.g. "2002-2015 Audi Q7 Alternator 021903016KX OEM Used"
    // This gives us Year/Make/Model to expand via MVL database.
    if (candidates.length === 0) {
      candidates.push(...this.candidatesFromTitle(product));
    }

    // ── Source 3: MVL expansion from a credible donor year ──
    // Require a donor year — expanding make/model alone dumps the entire MVL.
    if (candidates.length > 0 && this.mvlExpander.getExpansionMode() !== 'ai') {
      const first = candidates[0];
      const donorYear = pickDonorYear([
        first.year,
        ...candidates.slice(0, 5).map((c) => c.year),
      ]);
      if (first.make && first.model && donorYear) {
        try {
          const mvlResult = await this.mvlExpander.expand({
            donor: {
              year: String(donorYear),
              make: first.make,
              model: first.model,
            },
            partType: product.partType ?? undefined,
            placement: product.placement ?? undefined,
            mpn: product.mpn ?? product.oemPartNumber ?? undefined,
            profile: 'full',
            marketplace: options?.marketplace,
            treeId,
          });
          for (const row of mvlResult.expandedRows) {
            candidates.push({
              year: row.year,
              make: row.make,
              model: row.model,
              trim: row.trim,
              engine: row.engine,
              confidence: row.source === 'platform_generation' ? 0.88 : 0.75,
              source: `mvl_${row.source}`,
              validationStatus: 'needs_review',
              notes: row.notes,
            });
          }
          manualReviewReasons.push(...mvlResult.manualReviewReasons);
        } catch (err) {
          this.logger.warn(
            `MVL expansion failed for ${first.make}/${first.model}: ${err instanceof Error ? err.message : err}`,
          );
        }
      } else if (first.make && first.model && !donorYear) {
        manualReviewReasons.push(
          'Make/model known but donor year missing — skipped full-model MVL expansion',
        );
      }
    }

    // ── Source 4: Donor VIN decode + MVL expansion (only if no candidates yet) ──
    if (donorVin && candidates.length === 0) {
      try {
        const decoded = await this.vinDecode.decode(donorVin);
        donorVinDecoded = decoded as unknown as Record<string, unknown>;
        if (decoded.year && decoded.make && decoded.model) {
          candidates.push({
            year: decoded.year,
            make: decoded.make,
            model: decoded.model,
            trim: decoded.trim || undefined,
            engine: this.formatEngine(decoded),
            drivetrain: decoded.driveType || undefined,
            bodyType: decoded.bodyClass || undefined,
            confidence: 0.55,
            source: 'donor_vin_nhtsa',
            validationStatus: 'needs_review',
            notes:
              'Donor vehicle from VIN decode — verify part fits this vehicle',
          });
          manualReviewReasons.push(
            'Fitment includes donor vehicle only from VIN decode',
          );

          if (
            candidates.length <= 1 &&
            this.mvlExpander.getExpansionMode() !== 'ai'
          ) {
            const mvlResult = await this.mvlExpander.expand({
              donor: {
                year: decoded.year,
                make: decoded.make,
                model: decoded.model,
                trim: decoded.trim,
                engine: this.formatEngine(decoded),
                bodyClass: decoded.bodyClass,
              },
              partType: product.partType ?? undefined,
              placement: product.placement ?? undefined,
              mpn: product.mpn ?? product.oemPartNumber ?? undefined,
              profile: 'full',
              marketplace: options?.marketplace,
              treeId,
            });
            for (const row of mvlResult.expandedRows) {
              candidates.push({
                year: row.year,
                make: row.make,
                model: row.model,
                trim: row.trim,
                engine: row.engine,
                confidence: row.source === 'platform_generation' ? 0.88 : 0.75,
                source: `mvl_${row.source}`,
                validationStatus: 'needs_review',
                notes: row.notes,
              });
            }
            manualReviewReasons.push(...mvlResult.manualReviewReasons);
            if (mvlResult.needsAiInterchange) {
              manualReviewReasons.push(
                'MVL expansion thin — AI interchange micro-lane recommended',
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(
          `Donor VIN decode failed for ${donorVin}: ${String(err)}`,
        );
        manualReviewReasons.push('Donor VIN could not be decoded');
      }
    }

    if (!product.oemPartNumber && !product.mpn) {
      manualReviewReasons.push(
        'OEM/MPN missing — cannot verify interchange fitment',
      );
    }

    const validated = await this.validateAgainstEbay(
      candidates,
      categoryId,
      treeId,
    );
    const deduped = this.deduplicateFitments(validated);

    const validCount = deduped.filter(
      (r) => r.validationStatus === 'valid',
    ).length;
    const onlyDonor =
      deduped.length > 0 &&
      deduped.every(
        (r) =>
          r.source === 'donor_vin_nhtsa' ||
          r.validationStatus === 'needs_review',
      );

    if (deduped.length === 0) {
      return {
        status: 'needs_review',
        confidence: 0,
        rows: [],
        donorVinDecoded,
        donorVin,
        categorySupportsCompatibility,
        manualReviewReasons: [
          ...manualReviewReasons,
          'No verified compatibility rows — manual fitment review required',
        ],
        ebayCatalogCategoryId: null,
        ebayCatalogCategoryName: null,
      };
    }

    if (onlyDonor) {
      manualReviewReasons.push(
        'Only donor vehicle known — do not assume broad interchange',
      );
    }

    const avgConfidence =
      deduped.reduce((sum, r) => sum + r.confidence, 0) / deduped.length;

    const status: FitmentStatus =
      manualReviewReasons.length > 0 || onlyDonor
        ? 'needs_review'
        : validCount === 0
          ? 'needs_review'
          : 'completed';

    return {
      status,
      confidence: Math.round(avgConfidence * 100) / 100,
      rows: deduped,
      donorVinDecoded,
      donorVin,
      categorySupportsCompatibility,
      manualReviewReasons,
      ebayCatalogCategoryId: null,
      ebayCatalogCategoryName: null,
    };
  }

  /** Parse year/make/model from listing title when pipeline fitment rows were not persisted. */
  private candidatesFromTitle(product: CatalogProduct): FitmentRow[] {
    // Prefer optimized title when present — source titles often prepend a
    // mistyped brand (e.g. "Chevorlet") ahead of the real Make/Model tokens.
    const title =
      product.optimizedTitle?.trim() || product.title?.trim() || '';
    if (!title) return [];

    const { make, model } = extractMakeModelFromTitle(title);
    if (!make || !model) return [];

    const yearPrefix = title.match(/^(\d{4})(?:\s*-\s*(\d{4}))?\s+/);
    const rows: FitmentRow[] = [];

    if (yearPrefix) {
      const start = parseInt(yearPrefix[1], 10);
      const end = yearPrefix[2] ? parseInt(yearPrefix[2], 10) : start;
      // Cap span — titles like "1980-2027" are over-expanded MVL dumps, not real fitment.
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end >= start &&
        end - start <= MAX_FITMENT_YEAR_SPAN
      ) {
        for (let y = start; y <= end; y++) {
          rows.push({
            year: String(y),
            make,
            model,
            confidence: 0.5,
            source: 'title_parse',
            validationStatus: 'needs_review',
            notes:
              'Derived from listing title year range — verify compatibility',
          });
        }
        return rows;
      }
      // Over-wide title range: keep only the start year as a donor hint.
      if (Number.isFinite(start) && end - start > MAX_FITMENT_YEAR_SPAN) {
        rows.push({
          year: String(start),
          make,
          model,
          confidence: 0.35,
          source: 'title_parse',
          validationStatus: 'needs_review',
          notes:
            'Title year range was over-wide (likely unscoped MVL dump) — using start year only',
        });
        return rows;
      }
    }

    const singleYear = title.match(/\b(19|20)\d{2}\b/);
    if (singleYear) {
      rows.push({
        year: singleYear[0],
        make,
        model,
        confidence: 0.48,
        source: 'title_parse',
        validationStatus: 'needs_review',
        notes: 'Derived from listing title — verify compatibility',
      });
    }

    return rows;
  }

  private extractDonorVin(product: CatalogProduct): string | null {
    if (product.donorVin?.trim()) {
      return product.donorVin.trim().toUpperCase();
    }
    const haystack = [product.title, product.description, product.sku]
      .filter(Boolean)
      .join(' ');
    const match = haystack.match(VIN_REGEX);
    return match?.[0]?.toUpperCase() ?? null;
  }

  private rowFromRaw(
    raw: Record<string, unknown>,
    source: string,
  ): FitmentRow | null {
    const make = String(raw['Make'] ?? raw['make'] ?? '').trim();
    const model = String(raw['Model'] ?? raw['model'] ?? '').trim();
    const year = String(raw['Year'] ?? raw['year'] ?? '').trim();
    if (!make || !model || !year) return null;

    return {
      year,
      make,
      model,
      trim: String(raw['Trim'] ?? raw['trim'] ?? '').trim() || undefined,
      engine: String(raw['Engine'] ?? raw['engine'] ?? '').trim() || undefined,
      drivetrain:
        String(raw['Drivetrain'] ?? raw['drivetrain'] ?? '').trim() ||
        undefined,
      bodyType:
        String(raw['Body Style'] ?? raw['bodyStyle'] ?? '').trim() || undefined,
      position:
        String(raw['Position'] ?? raw['position'] ?? '').trim() || undefined,
      notes: String(raw['Notes'] ?? raw['notes'] ?? '').trim() || undefined,
      confidence: 0.82,
      source,
      validationStatus: 'needs_review',
    };
  }

  private formatEngine(decoded: {
    engineCylinders?: string;
    engineDisplacementL?: string;
  }): string | undefined {
    const parts = [decoded.engineDisplacementL, decoded.engineCylinders]
      .filter(Boolean)
      .join(' ');
    return parts || undefined;
  }

  private async validateAgainstEbay(
    rows: FitmentRow[],
    categoryId: string,
    treeId = '0',
  ): Promise<FitmentRow[]> {
    if (rows.length === 0) return [];

    const indicesToValidate: number[] = [];
    const parsed: ParsedFitmentRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.validationStatus === 'rejected') continue;
      indicesToValidate.push(i);
      parsed.push({
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim,
        engine: row.engine,
        notes: row.notes,
      });
    }

    const validated = await this.mvl.validateParsedRows(
      parsed,
      categoryId,
      treeId,
    );
    const validationByIndex = new Map<number, MvlValidatedRow>();
    indicesToValidate.forEach((rowIndex, vi) => {
      validationByIndex.set(rowIndex, validated[vi]);
    });

    return rows.map((row, i) => {
      if (row.validationStatus === 'rejected') return row;

      const result = validationByIndex.get(i);
      if (!result) {
        return {
          ...row,
          validationStatus: 'rejected' as const,
          rejectedReason: 'Could not parse fitment row',
          confidence: 0,
        };
      }

      if (result.status === 'rejected') {
        return {
          ...row,
          make: result.row.make,
          model: result.row.model,
          validationStatus: 'rejected' as const,
          rejectedReason: result.rejectedReason,
          confidence: 0,
        };
      }

      if (result.status === 'needs_review') {
        return {
          ...row,
          make: result.row.make,
          model: result.row.model,
          year: result.row.year,
          validationStatus: 'needs_review' as const,
          rejectedReason: result.rejectedReason,
          confidence: Math.min(row.confidence, 0.5),
        };
      }

      return {
        ...row,
        make: result.row.make,
        model: result.row.model,
        year: result.row.year,
        validationStatus:
          row.source === 'donor_vin_nhtsa' ? 'needs_review' : 'valid',
        confidence: row.source === 'donor_vin_nhtsa' ? row.confidence : 0.9,
      };
    });
  }

  private deduplicateFitments(rows: FitmentRow[]): FitmentRow[] {
    const seen = new Set<string>();
    const out: FitmentRow[] = [];
    for (const row of rows) {
      const key = `${row.year}|${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  }

  toFitmentDataJson(rows: FitmentRow[]): Record<string, unknown>[] {
    return rows
      .filter((r) => r.validationStatus !== 'rejected')
      .map((r) => ({
        Year: r.year,
        Make: r.make,
        Model: r.model,
        ...(r.trim ? { Trim: r.trim } : {}),
        ...(r.engine ? { Engine: r.engine } : {}),
        ...(r.notes ? { Notes: r.notes } : {}),
        Source: r.source,
        Confidence: r.confidence,
      }));
  }
}
