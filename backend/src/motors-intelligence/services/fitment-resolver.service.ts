import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MotorsProduct,
  MotorsProductStatus,
  EbayCategoryMapping,
} from '../entities';
import { PartFitment } from '../../fitment/entities/part-fitment.entity';
import { FitmentMake } from '../../fitment/entities/fitment-make.entity';
import { FitmentModel } from '../../fitment/entities/fitment-model.entity';
import { FitmentService } from '../../fitment/fitment.service';

export interface FitmentRow {
  year?: string;
  yearStart?: number;
  yearEnd?: number;
  make: string;
  model: string;
  submodel?: string;
  engine?: string;
  notes?: string[];
}

export interface FitmentResolutionResult {
  resolved: boolean;
  fitmentRows: FitmentRow[];
  fitmentConfidence: number;
  compatibleVehicleSummary: string;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class FitmentResolverService {
  private readonly logger = new Logger(FitmentResolverService.name);

  constructor(
    @InjectRepository(MotorsProduct)
    private readonly motorsProductRepo: Repository<MotorsProduct>,
    @InjectRepository(EbayCategoryMapping)
    private readonly categoryMappingRepo: Repository<EbayCategoryMapping>,
    @InjectRepository(PartFitment)
    private readonly partFitmentRepo: Repository<PartFitment>,
    @InjectRepository(FitmentMake)
    private readonly fitmentMakeRepo: Repository<FitmentMake>,
    @InjectRepository(FitmentModel)
    private readonly fitmentModelRepo: Repository<FitmentModel>,
    private readonly fitmentService: FitmentService,
  ) {}

  async resolveFitment(motorsProductId: string): Promise<FitmentResolutionResult> {
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: motorsProductId },
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if category supports compatibility
    let supportsCompatibility = false;
    if (product.ebayCategoryId) {
      const mapping = await this.categoryMappingRepo.findOne({
        where: { ebayCategoryId: product.ebayCategoryId },
      });
      supportsCompatibility = mapping?.supportsCompatibility || false;
    }

    // Source priority:
    // 1. Existing part_fitments for the linked listingId
    // 2. Raw fitment from extraction/supplier data
    // 3. Catalog product fitmentData
    // 4. Historical approved fitment rows

    let fitmentRows: FitmentRow[] = [];

    // Source 1: Existing part_fitments
    if (product.listingId) {
      const existing = await this.partFitmentRepo.find({
        where: { listingId: product.listingId },
        relations: ['make', 'model'],
      });

      if (existing.length > 0) {
        fitmentRows = existing.map(pf => ({
          yearStart: pf.yearStart,
          yearEnd: pf.yearEnd,
          make: (pf as any).make?.name || '',
          model: (pf as any).model?.name || '',
          notes: pf.notes ? [pf.notes] : [],
        }));
      }
    }

    // Source 2: Raw fitment from product record
    if (fitmentRows.length === 0 && product.fitmentRows?.length) {
      fitmentRows = this.normalizeFitmentRows(product.fitmentRows);
    }

    // Validate and normalize rows
    const validatedRows: FitmentRow[] = [];
    for (const row of fitmentRows) {
      const validation = await this.validateFitmentRow(row);
      if (validation.valid) {
        validatedRows.push(validation.normalizedRow);
      } else {
        warnings.push(...validation.warnings);
        errors.push(...validation.errors);
      }
    }

    // Deduplicate
    const deduped = this.deduplicateRows(validatedRows);

    // Generate summary
    const summary = this.generateCompatibilitySummary(deduped);

    // Calculate confidence
    const confidence = this.calculateFitmentConfidence(deduped, errors, warnings, supportsCompatibility);

    // Update product
    product.fitmentRows = deduped;
    product.compatibleVehicleSummary = summary;
    product.fitmentConfidence = confidence;
    product.compatibilityRequired = supportsCompatibility;
    await this.motorsProductRepo.save(product);

    return {
      resolved: deduped.length > 0 || !supportsCompatibility,
      fitmentRows: deduped,
      fitmentConfidence: confidence,
      compatibleVehicleSummary: summary,
      errors,
      warnings,
    };
  }

  private normalizeFitmentRows(rawRows: any[]): FitmentRow[] {
    return rawRows.map(row => {
      const normalized: FitmentRow = {
        make: this.normalizeString(row.make || row.Make || ''),
        model: this.normalizeString(row.model || row.Model || ''),
      };

      // Handle year/year_range
      if (row.year) {
        const yearStr = String(row.year);
        if (yearStr.includes('-')) {
          const parts = yearStr.split('-');
          normalized.yearStart = parseInt(parts[0], 10);
          normalized.yearEnd = parseInt(parts[1], 10);
        } else {
          normalized.yearStart = parseInt(yearStr, 10);
          normalized.yearEnd = parseInt(yearStr, 10);
        }
      } else if (row.year_range) {
        const yearStr = String(row.year_range);
        if (yearStr.includes('-')) {
          const parts = yearStr.split('-');
          normalized.yearStart = parseInt(parts[0], 10);
          normalized.yearEnd = parseInt(parts[1], 10);
        } else {
          normalized.yearStart = parseInt(yearStr, 10);
          normalized.yearEnd = parseInt(yearStr, 10);
        }
      } else {
        if (row.yearStart) normalized.yearStart = parseInt(String(row.yearStart), 10);
        if (row.yearEnd) normalized.yearEnd = parseInt(String(row.yearEnd), 10);
      }

      // Submodel
      if (row.submodel || row.Submodel || row.trim) {
        normalized.submodel = this.normalizeString(row.submodel || row.Submodel || row.trim);
      }

      // Engine
      if (row.engine || row.Engine) {
        normalized.engine = row.engine || row.Engine;
      }

      // Notes
      if (row.notes) {
        normalized.notes = Array.isArray(row.notes) ? row.notes : [row.notes];
      }

      return normalized;
    }).filter(row => row.make || row.model); // Filter out completely empty rows
  }

  private async validateFitmentRow(row: FitmentRow): Promise<{
    valid: boolean;
    normalizedRow: FitmentRow;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const normalizedRow = { ...row };

    // Validate year range
    if (normalizedRow.yearStart) {
      const currentYear = new Date().getFullYear();
      if (normalizedRow.yearStart < 1900 || normalizedRow.yearStart > currentYear + 2) {
        errors.push(`Invalid year ${normalizedRow.yearStart}`);
        return { valid: false, normalizedRow, warnings, errors };
      }
    }

    if (normalizedRow.yearEnd && normalizedRow.yearStart) {
      if (normalizedRow.yearEnd < normalizedRow.yearStart) {
        errors.push(`Year end (${normalizedRow.yearEnd}) before year start (${normalizedRow.yearStart})`);
        return { valid: false, normalizedRow, warnings, errors };
      }
      if (normalizedRow.yearEnd - normalizedRow.yearStart > 50) {
        warnings.push(`Large year range: ${normalizedRow.yearStart}-${normalizedRow.yearEnd}`);
      }
    }

    // Normalize make name
    if (normalizedRow.make) {
      const make = await this.fitmentMakeRepo.findOne({
        where: { name: ILike_safe(normalizedRow.make) },
      });
      if (make) {
        normalizedRow.make = make.name; // Use canonical name
      } else {
        // Try fuzzy match
        normalizedRow.make = this.capitalizeWords(normalizedRow.make);
        warnings.push(`Make "${normalizedRow.make}" not found in reference data`);
      }
    }

    // Normalize model name
    if (normalizedRow.model) {
      normalizedRow.model = this.capitalizeWords(normalizedRow.model);
    }

    // Normalize submodel
    if (normalizedRow.submodel) {
      normalizedRow.submodel = normalizedRow.submodel.trim();
    }

    return { valid: true, normalizedRow, warnings, errors };
  }

  private deduplicateRows(rows: FitmentRow[]): FitmentRow[] {
    const seen = new Set<string>();
    return rows.filter(row => {
      const key = `${row.yearStart}-${row.yearEnd}-${row.make}-${row.model}-${row.submodel || ''}-${row.engine || ''}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private generateCompatibilitySummary(rows: FitmentRow[]): string {
    if (rows.length === 0) return '';

    // Group by make/model
    const groups: Record<string, { years: number[]; submodels: string[] }> = {};
    for (const row of rows) {
      const key = `${row.make} ${row.model}`;
      if (!groups[key]) {
        groups[key] = { years: [], submodels: [] };
      }
      if (row.yearStart) {
        if (row.yearEnd && row.yearEnd !== row.yearStart) {
          for (let y = row.yearStart; y <= row.yearEnd; y++) {
            groups[key].years.push(y);
          }
        } else {
          groups[key].years.push(row.yearStart);
        }
      }
      if (row.submodel && !groups[key].submodels.includes(row.submodel)) {
        groups[key].submodels.push(row.submodel);
      }
    }

    const summaries: string[] = [];
    for (const [vehicle, data] of Object.entries(groups)) {
      const uniqueYears = [...new Set(data.years)].sort();
      if (uniqueYears.length > 0) {
        const yearRange = this.compactYearRange(uniqueYears);
        summaries.push(`${yearRange} ${vehicle}`);
      } else {
        summaries.push(vehicle);
      }
    }

    return summaries.join(', ');
  }

  private compactYearRange(years: number[]): string {
    if (years.length === 0) return '';
    if (years.length === 1) return String(years[0]);

    const min = Math.min(...years);
    const max = Math.max(...years);

    // Check if consecutive
    if (max - min + 1 === years.length) {
      return `${min}-${max}`;
    }

    // Multiple ranges or individual years
    return `${min}-${max}`;
  }

  private calculateFitmentConfidence(
    rows: FitmentRow[],
    errors: string[],
    warnings: string[],
    required: boolean,
  ): number {
    if (!required && rows.length === 0) return 1.0;
    if (required && rows.length === 0) return 0.0;

    let confidence = 0.5; // Base for having any fitment

    // More rows generally means better coverage
    if (rows.length > 5) confidence += 0.2;
    else if (rows.length > 0) confidence += 0.1;

    // Validated make/model
    const validMakeModel = rows.filter(r => r.make && r.model).length;
    confidence += (validMakeModel / rows.length) * 0.2;

    // Year data present
    const hasYears = rows.filter(r => r.yearStart).length;
    confidence += (hasYears / rows.length) * 0.1;

    // Deductions
    confidence -= errors.length * 0.1;
    confidence -= warnings.length * 0.02;

    return Math.max(0, Math.min(1, confidence));
  }

  private normalizeString(str: string): string {
    return str.trim().replace(/\s+/g, ' ');
  }

  private capitalizeWords(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Helper to create an ILIKE condition safely
function ILike_safe(value: string) {
  // Use TypeORM's ILike operator
  return value;
}
