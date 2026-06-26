/**
 * ListingQualityValidator — quality gate ported from model-comparison harness.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidationResult } from './ai-routing-policy.types.js';
import { EbayTaxonomyTruthService } from './ebay-taxonomy-truth.service.js';
import { detectTitleGenerationMismatch } from '../../fitment/platform-generation.util.js';

const REQUIRED_SPECIFICS = [
  'Brand',
  'Manufacturer Part Number',
  'Type',
  'Placement on Vehicle',
];

export interface ItemScore {
  composite: number;
  titleWithinLimit: boolean;
  mpnMatchesProvided: boolean;
  fitmentRows: number;
  fitmentAllMercedes: boolean;
  flags: string[];
}

export function scoreItem(
  item: Record<string, unknown>,
  srcPart: { partNumber?: string; donorMake?: string },
): ItemScore {
  const flags: string[] = [];
  const title = String(item.title || '');
  const titleWithinLimit = title.length > 0 && title.length <= 80;
  const titleScore = [
    titleWithinLimit,
    /\b(19|20)\d{2}\b/.test(title),
    /mercedes|bmw|toyota|ford|honda/i.test(title),
    /\bOEM\b|\bGenuine\b|\bUsed\b/i.test(title),
  ].filter(Boolean).length;

  const desc = String(item.description || '');
  const descScore = [
    /<h[34]>|<ul>|<li>/i.test(desc),
    /verify part number compatibility/i.test(desc),
    /compatib/i.test(desc),
    /used|removed|inspected|tested/i.test(desc),
    desc.length > 300,
  ].filter(Boolean).length;

  const sp =
    typeof item.itemSpecifics === 'object' && item.itemSpecifics
      ? (item.itemSpecifics as Record<string, string>)
      : {};
  const requiredSpecificsFilled = REQUIRED_SPECIFICS.filter(
    (k) => sp[k] && String(sp[k]).trim(),
  ).length;

  const provided = String(srcPart.partNumber || '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const mpn = String(item.mpn || sp['Manufacturer Part Number'] || '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const mpnMatchesProvided =
    provided.length > 0 &&
    (mpn.includes(provided.slice(0, 8)) || mpn === provided);
  if (mpn && provided && !mpn.includes(provided.slice(0, 6))) {
    flags.push(`MPN_MISMATCH provided=${srcPart.partNumber} got=${item.mpn}`);
  }

  const compat = Array.isArray(item.compatibility) ? item.compatibility : [];
  const fitmentRows = compat.length;
  const years = new Set(
    compat.map((c: Record<string, unknown>) => String(c.year)),
  );
  const donorMake = (srcPart.donorMake || 'mercedes').toLowerCase();
  const fitmentAllMercedes =
    compat.length > 0 &&
    compat.every((c: Record<string, unknown>) =>
      String(c.make || '')
        .toLowerCase()
        .includes(donorMake.split('-')[0]),
    );
  const nonDonor = compat.filter(
    (c: Record<string, unknown>) =>
      c.make && !String(c.make).toLowerCase().includes(donorMake.split('-')[0]),
  );
  if (nonDonor.length && donorMake.includes('mercedes')) {
    flags.push(
      `CROSS_MAKE x${nonDonor.length}: ${[...new Set(nonDonor.map((c: Record<string, unknown>) => c.make))].join(',')}`,
    );
  }
  const badYears = [...years].filter((y) => Number(y) < 1995 || Number(y) > 2030);
  if (badYears.length) flags.push(`IMPLAUSIBLE_YEARS: ${badYears.join(',')}`);

  const composite = Math.round(
    (titleScore / 4) * 25 +
      (descScore / 5) * 20 +
      (requiredSpecificsFilled / 4) * 20 +
      (Math.min(fitmentRows, 12) / 12) * 20 +
      (compat.some((c) =>
        /w20[0-9]|al\d{2}|xv\d{2}|xe\d{2}|xu\d{2}|f\d{1,2}x|e\d{2}/i.test(
          String(c.chassisCode || c.submodel || c.model || ''),
        ),
      ) ||
      /w20[0-9]|al\d{2}|xv\d{2}/i.test(title)
        ? 10
        : 0) +
      (mpnMatchesProvided ? 5 : 0),
  );

  return {
    composite,
    titleWithinLimit,
    mpnMatchesProvided,
    fitmentRows,
    fitmentAllMercedes,
    flags,
  };
}

@Injectable()
export class ListingQualityValidator {
  private readonly fitmentMinRows: number;

  constructor(
    private readonly config: ConfigService,
    private readonly taxonomyTruth: EbayTaxonomyTruthService,
  ) {
    this.fitmentMinRows = Number(
      this.config.get<string>('AI_FITMENT_MIN_ROWS', '5'),
    );
  }

  async validateWithTaxonomy(
    item: Record<string, unknown>,
    srcPart: { partNumber?: string; donorMake?: string },
    options?: {
      expectedBatchSize?: number;
      actualBatchSize?: number;
      ebayCategoryId?: string | null;
      compactProfile?: boolean;
    },
  ): Promise<ValidationResult> {
    const base = this.validate(item, srcPart, {
      expectedBatchSize: options?.expectedBatchSize,
      actualBatchSize: options?.actualBatchSize,
      compactProfile: options?.compactProfile,
    });
    const ebayCategoryId =
      options?.ebayCategoryId ??
      (typeof item.ebayCategoryId === 'string' ? item.ebayCategoryId : null) ??
      (typeof item.categoryId === 'string' ? item.categoryId : null);

    const sp =
      typeof item.itemSpecifics === 'object' && item.itemSpecifics
        ? (item.itemSpecifics as Record<string, string>)
        : {};

    const taxonomy = await this.taxonomyTruth.validate(ebayCategoryId, sp);
    if (taxonomy.skipped) return base;

    const hardFails = [...base.hardFails, ...taxonomy.hardFails];
    const softFails = [...base.softFails, ...taxonomy.softFails];
    const pass = hardFails.length === 0;
    return {
      ...base,
      pass,
      hardFails,
      softFails,
      escalate: hardFails.length > 0,
    };
  }

  validate(
    item: Record<string, unknown>,
    srcPart: { partNumber?: string; donorMake?: string },
    options?: {
      expectedBatchSize?: number;
      actualBatchSize?: number;
      compactProfile?: boolean;
    },
  ): ValidationResult {
    const hardFails: string[] = [];
    const softFails: string[] = [];

    if (
      options?.expectedBatchSize != null &&
      options.actualBatchSize != null &&
      options.actualBatchSize !== options.expectedBatchSize
    ) {
      hardFails.push(
        `WRONG_ITEM_COUNT expected=${options.expectedBatchSize} got=${options.actualBatchSize}`,
      );
    }

    const score = scoreItem(item, srcPart);

    if (!score.mpnMatchesProvided) {
      hardFails.push('MPN_MISMATCH');
    }
    if (!score.titleWithinLimit) {
      hardFails.push('TITLE_OVER_80');
    }

    const sp =
      typeof item.itemSpecifics === 'object' && item.itemSpecifics
        ? (item.itemSpecifics as Record<string, string>)
        : {};
    const title = String(item.title || '');
    const titleMake =
      sp.Brand ||
      (typeof item.brand === 'string' ? item.brand : '') ||
      srcPart.donorMake ||
      '';
    const titleModel =
      sp.Model ||
      (typeof item.model === 'string' ? item.model : '') ||
      '';
    const donorYear =
      typeof (srcPart as { donorYear?: number | string }).donorYear === 'number' ||
      typeof (srcPart as { donorYear?: number | string }).donorYear === 'string'
        ? (srcPart as { donorYear?: number | string }).donorYear
        : title.match(/\b(19|20)\d{2}\b/)?.[0];
    const generationMismatch = detectTitleGenerationMismatch(
      title,
      titleMake,
      titleModel,
      donorYear,
    );
    if (generationMismatch) {
      hardFails.push(`GENERATION_YEAR_MISMATCH:${generationMismatch}`);
    }

    for (const key of REQUIRED_SPECIFICS) {
      if (!sp[key] || !String(sp[key]).trim()) {
        hardFails.push(`MISSING_SPECIFIC:${key}`);
      }
    }

    for (const flag of score.flags) {
      if (flag.startsWith('CROSS_MAKE')) hardFails.push(flag);
      if (flag.startsWith('IMPLAUSIBLE_YEARS')) hardFails.push(flag);
      if (flag.startsWith('MPN_MISMATCH')) hardFails.push(flag);
    }

    const compactProfile = options?.compactProfile === true;
    const fitmentMinRows = compactProfile ? 0 : this.fitmentMinRows;

    if (!compactProfile && score.fitmentRows < fitmentMinRows) {
      softFails.push(`FITMENT_ROWS_LOW:${score.fitmentRows}`);
    }
    const desc = String(item.description || '');
    if (!/<h[34]>|<ul>/i.test(desc)) {
      softFails.push('DESC_NO_HTML_STRUCTURE');
    }
    if (!compactProfile && !/compatib/i.test(desc)) {
      softFails.push('DESC_NO_COMPAT_SECTION');
    }
    const compat = Array.isArray(item.compatibility) ? item.compatibility : [];
    const hasChassisSignal =
      /w20[0-9]|al\d{2}|xv\d{2}|xe\d{2}|xu\d{2}|f\d{1,2}x|e\d{2}/i.test(title) ||
      compat.some((c: Record<string, unknown>) =>
        /w20[0-9]|al\d{2}|xv\d{2}|xe\d{2}|xu\d{2}|f\d{1,2}x|e\d{2}/i.test(
          String(c.chassisCode || c.submodel || ''),
        ),
      );
    if (!compactProfile && !hasChassisSignal) {
      softFails.push('NO_CHASSIS_CODE');
    }

    const pass = hardFails.length === 0;
    return {
      pass,
      score: score.composite,
      hardFails,
      softFails,
      escalate: hardFails.length > 0,
      fitmentRowCount: score.fitmentRows,
    };
  }
}
