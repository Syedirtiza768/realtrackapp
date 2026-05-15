import { Injectable, Logger } from '@nestjs/common';
import { EbayMvlService } from '../fitment/ebay-mvl.service.js';
import { VinDecodeService } from '../fitment/vin-decode.service.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { extractMakeModelFromTitle } from '../listings/utils/extract-make-model-from-title.js';
import type { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import type { FitmentRow, FitmentStatus } from './listing-optimization.types.js';

const VIN_REGEX = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export interface FitmentDiscoveryResult {
  status: FitmentStatus;
  confidence: number;
  rows: FitmentRow[];
  donorVinDecoded: Record<string, unknown> | null;
  donorVin: string | null;
  categorySupportsCompatibility: boolean;
  manualReviewReasons: string[];
}

@Injectable()
export class FitmentDiscoveryService {
  private readonly logger = new Logger(FitmentDiscoveryService.name);

  constructor(
    private readonly vinDecode: VinDecodeService,
    private readonly mvl: EbayMvlService,
    private readonly taxonomy: EbayTaxonomyApiService,
  ) {}

  async discover(product: CatalogProduct): Promise<FitmentDiscoveryResult> {
    const manualReviewReasons: string[] = [];
    const donorVin = this.extractDonorVin(product);
    let donorVinDecoded: Record<string, unknown> | null = null;

    const categoryId = product.categoryId ?? EbayMvlService.MOTORS_PARTS_CATEGORY;
    let categorySupportsCompatibility = true;
    try {
      const props = await this.taxonomy.getCompatibilityProperties('0', categoryId);
      categorySupportsCompatibility = props.length > 0;
      if (!categorySupportsCompatibility) {
        manualReviewReasons.push('Category does not support automotive compatibility');
      }
    } catch {
      categorySupportsCompatibility = false;
      manualReviewReasons.push('Could not verify eBay compatibility support for category');
    }

    const candidates: FitmentRow[] = [];

    if (Array.isArray(product.fitmentData)) {
      for (const raw of product.fitmentData) {
        const row = this.rowFromRaw(raw, 'catalog_fitment');
        if (row) candidates.push(row);
      }
    }

    if (candidates.length === 0) {
      candidates.push(...this.candidatesFromTitle(product));
    }

    if (donorVin) {
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
            notes: 'Donor vehicle from VIN decode — verify part fits this vehicle',
          });
          manualReviewReasons.push('Fitment includes donor vehicle only from VIN decode');
        }
      } catch (err) {
        this.logger.warn(`Donor VIN decode failed for ${donorVin}: ${String(err)}`);
        manualReviewReasons.push('Donor VIN could not be decoded');
      }
    }

    if (!product.oemPartNumber && !product.mpn) {
      manualReviewReasons.push('OEM/MPN missing — cannot verify interchange fitment');
    }

    const validated = await this.validateAgainstEbay(candidates, categoryId);
    const deduped = this.deduplicateFitments(validated);

    const validCount = deduped.filter((r) => r.validationStatus === 'valid').length;
    const onlyDonor =
      deduped.length > 0 &&
      deduped.every((r) => r.source === 'donor_vin_nhtsa' || r.validationStatus === 'needs_review');

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
      };
    }

    if (onlyDonor) {
      manualReviewReasons.push('Only donor vehicle known — do not assume broad interchange');
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
    };
  }

  /** Parse year/make/model from listing title when pipeline fitment rows were not persisted. */
  private candidatesFromTitle(product: CatalogProduct): FitmentRow[] {
    const title = product.title?.trim();
    if (!title) return [];

    const { make, model } = extractMakeModelFromTitle(title);
    if (!make || !model) return [];

    const yearPrefix = title.match(/^(\d{4})(?:\s*-\s*(\d{4}))?\s+/);
    const rows: FitmentRow[] = [];

    if (yearPrefix) {
      const start = parseInt(yearPrefix[1], 10);
      const end = yearPrefix[2] ? parseInt(yearPrefix[2], 10) : start;
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 35) {
        for (let y = start; y <= end; y++) {
          rows.push({
            year: String(y),
            make,
            model,
            confidence: 0.5,
            source: 'title_parse',
            validationStatus: 'needs_review',
            notes: 'Derived from listing title year range — verify compatibility',
          });
        }
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
    const haystack = [product.title, product.description, product.sku].filter(Boolean).join(' ');
    const match = haystack.match(VIN_REGEX);
    return match?.[0]?.toUpperCase() ?? null;
  }

  private rowFromRaw(raw: Record<string, unknown>, source: string): FitmentRow | null {
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
      drivetrain: String(raw['Drivetrain'] ?? raw['drivetrain'] ?? '').trim() || undefined,
      bodyType: String(raw['Body Style'] ?? raw['bodyStyle'] ?? '').trim() || undefined,
      position: String(raw['Position'] ?? raw['position'] ?? '').trim() || undefined,
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
  ): Promise<FitmentRow[]> {
    const validated: FitmentRow[] = [];

    for (const row of rows) {
      if (row.validationStatus === 'rejected') {
        validated.push(row);
        continue;
      }

      try {
        const yearNum = Number(row.year);
        if (!Number.isFinite(yearNum) || yearNum < 1900) {
          validated.push({
            ...row,
            validationStatus: 'rejected',
            rejectedReason: 'Invalid year',
            confidence: 0,
          });
          continue;
        }

        const makes = await this.mvl.getPropertyValues(categoryId, 'Make', {}, row.make, 5);
        const makeMatch = makes.options.some(
          (o) => o.value.toLowerCase() === row.make.toLowerCase(),
        );
        if (!makeMatch) {
          validated.push({
            ...row,
            validationStatus: 'rejected',
            rejectedReason: `Make "${row.make}" not found in eBay compatibility`,
            confidence: 0,
          });
          continue;
        }

        const models = await this.mvl.getPropertyValues(
          categoryId,
          'Model',
          { Make: row.make },
          row.model,
          5,
        );
        const modelMatch = models.options.some(
          (o) => o.value.toLowerCase() === row.model.toLowerCase(),
        );
        if (!modelMatch) {
          validated.push({
            ...row,
            validationStatus: 'rejected',
            rejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay`,
            confidence: 0,
          });
          continue;
        }

        const years = await this.mvl.getYears(categoryId, row.make, row.model);
        const yearMatch = years.options.some((o) => o.value === row.year);
        if (!yearMatch) {
          validated.push({
            ...row,
            validationStatus: 'needs_review',
            rejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model}`,
            confidence: Math.min(row.confidence, 0.5),
          });
          continue;
        }

        validated.push({
          ...row,
          validationStatus: row.source === 'donor_vin_nhtsa' ? 'needs_review' : 'valid',
          confidence: row.source === 'donor_vin_nhtsa' ? row.confidence : 0.9,
        });
      } catch (err) {
        this.logger.debug(`eBay validation skipped for row: ${String(err)}`);
        validated.push({
          ...row,
          validationStatus: 'needs_review',
          confidence: Math.min(row.confidence, 0.4),
        });
      }
    }

    return validated;
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
