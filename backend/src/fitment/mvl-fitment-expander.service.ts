import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';
import {
  expandFitmentDeterministic,
  evaluateNeedsAiInterchange,
  getFitmentMinMvlRows,
  getSiblingExpansionMode,
  resolveFitmentAiInterchange,
  resolveFitmentExpansionMode,
  collapseYearRanges,
  type DonorVehicle,
  type ExpandedFitmentRow,
  type FitmentExpansionMode,
} from './mvl-fitment-expander.util.js';
import type { MvlMarketplace } from './ebay-mvl-marketplace.util.js';
import { resolveMvlMarketplaceFromTreeId } from './ebay-mvl-marketplace.util.js';
import type { PlatformRangesMap } from './platform-generation.util.js';

/** Cross-brand platform siblings — aligned with scripts/lib/shared-platforms.mjs */
const SHARED_PLATFORMS: Record<string, string[]> = {
  'Volkswagen|Golf': ['Audi|A3', 'Volkswagen|Jetta'],
  'Audi|A3': ['Volkswagen|Golf', 'Volkswagen|Jetta'],
  'Toyota|Camry': ['Lexus|ES'],
  'Lexus|ES': ['Toyota|Camry'],
  'Toyota|RAV4': ['Lexus|NX'],
  'Lexus|NX': ['Toyota|RAV4'],
  'Honda|Accord': ['Acura|TLX'],
  'Acura|TLX': ['Honda|Accord'],
  'Chevrolet|Silverado': ['GMC|Sierra'],
  'GMC|Sierra': ['Chevrolet|Silverado'],
};

export interface MvlFitmentExpandInput {
  donor: DonorVehicle;
  partType?: string;
  placement?: string;
  mpn?: string;
  profile?: 'compact' | 'full';
  marketplace?: string | null;
  treeId?: string;
  interchangeHints?: Array<Record<string, unknown>>;
}

export interface MvlFitmentExpandResult {
  status: 'completed' | 'needs_review';
  fitmentSource: 'mvl' | 'mvl+filtered' | 'mvl+ai' | 'ai' | 'mvl_pending_db';
  ranges: ReturnType<typeof expandFitmentDeterministic>['ranges'];
  expandedRows: ExpandedFitmentRow[];
  coverage: ReturnType<typeof expandFitmentDeterministic>['coverage'];
  needsAiInterchange: boolean;
  manualReviewReasons: string[];
}

@Injectable()
export class MvlFitmentExpanderService {
  private readonly logger = new Logger(MvlFitmentExpanderService.name);
  private platformRanges: PlatformRangesMap | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mvlStore: EbayMvlStoreService,
  ) {}

  getExpansionMode(): FitmentExpansionMode {
    return resolveFitmentExpansionMode(
      this.config.get<string>('FITMENT_EXPANSION_MODE'),
    );
  }

  private loadPlatformRanges(): PlatformRangesMap {
    if (this.platformRanges) return this.platformRanges;
    const candidates = [
      join(process.cwd(), 'shared/automotive-platform-ranges.json'),
      join(process.cwd(), '../shared/automotive-platform-ranges.json'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        this.platformRanges = JSON.parse(
          readFileSync(candidate, 'utf8'),
        ) as PlatformRangesMap;
        return this.platformRanges;
      }
    }
    this.platformRanges = {};
    return this.platformRanges;
  }

  private resolveMarketplace(
    marketplace?: string | null,
    treeId?: string,
  ): MvlMarketplace {
    if (marketplace) {
      const upper = marketplace.toUpperCase();
      if (['US', 'AU', 'DE', 'GB'].includes(upper)) {
        return upper as MvlMarketplace;
      }
    }
    return resolveMvlMarketplaceFromTreeId(treeId ?? '0');
  }

  async expand(input: MvlFitmentExpandInput): Promise<MvlFitmentExpandResult> {
    const mode = this.getExpansionMode();
    const manualReviewReasons: string[] = [];

    if (mode === 'ai') {
      return {
        status: 'needs_review',
        fitmentSource: 'ai',
        ranges: [],
        expandedRows: [],
        coverage: {
          platformYears: 0,
          siblingModels: 0,
          crossVin: 0,
          sharedPlatform: 0,
          mvlRejected: 0,
        },
        needsAiInterchange: true,
        manualReviewReasons: ['FITMENT_EXPANSION_MODE=ai — legacy AI fitment path'],
      };
    }

    const profile = input.profile ?? 'full';
    const siblingMode = getSiblingExpansionMode(
      this.config.get<string>('FITMENT_SIBLING_EXPANSION'),
    );
    const minRows = getFitmentMinMvlRows(
      this.config.get<string>('FITMENT_MIN_MVL_ROWS'),
    );
    const aiInterchange = resolveFitmentAiInterchange(
      this.config.get<string>('FITMENT_AI_INTERCHANGE'),
    );
    const mkt = this.resolveMarketplace(input.marketplace, input.treeId);

    let result = expandFitmentDeterministic({
      donor: input.donor,
      partType: input.partType,
      placement: input.placement,
      profile,
      siblingMode,
      platformRanges: this.loadPlatformRanges(),
      sharedPlatforms: SHARED_PLATFORMS,
      resolveEbayModel: (make, model, trim) => ({
        model,
        trim: trim ?? '',
      }),
    });

    const generation = result.generation;
    if (generation && input.donor.make && input.donor.model) {
      const mvlYears = await this.mvlStore.queryYearsInRange(
        mkt,
        input.donor.make,
        result.expandedRows[0]?.model ?? input.donor.model,
        generation.start,
        generation.end,
      );

      if (mvlYears.length > 0) {
        const mvlYearSet = new Set(mvlYears);
        result.expandedRows = result.expandedRows.filter((row) => {
          if (row.source !== 'platform_generation') return true;
          const y = parseInt(row.year, 10);
          if (mvlYearSet.has(y)) return true;
          result.coverage.mvlRejected++;
          return false;
        });
      }

      if (siblingMode !== 'off') {
        const tier = result.tier;
        if (
          tier === 'body' ||
          tier === 'general' ||
          siblingMode === 'aggressive'
        ) {
          const models = await this.mvlStore.queryModelsInYearRange(
            mkt,
            input.donor.make,
            generation.start,
            generation.end,
          );
          const seen = new Set(
            result.expandedRows.map((r) => fitmentRowKey(r)),
          );
          const donorLower = input.donor.model.toLowerCase();
          for (const entry of models) {
            if (entry.model.toLowerCase() === donorLower) continue;
            if (siblingMode === 'conservative' && tier === 'general') continue;
            const lo = Math.max(generation.start, entry.minYear);
            const hi = Math.min(generation.end, entry.maxYear);
            for (let y = lo; y <= hi; y++) {
              const row: ExpandedFitmentRow = {
                year: String(y),
                make: input.donor.make,
                model: entry.model,
                trim: '',
                engine: '',
                submodel: '',
                bodyType: '',
                notes: `Sibling model from MVL (${entry.model})`,
                source: 'mvl_sibling',
              };
              if (addUniqueRow(result.expandedRows, seen, row)) {
                result.coverage.siblingModels++;
              }
            }
          }
        }
      }
    }

    const hints = input.interchangeHints ?? [];
    if (hints.length > 0) {
      const seen = new Set(result.expandedRows.map((r) => fitmentRowKey(r)));
      for (const hint of hints) {
        const make = String(hint['make'] ?? '').trim();
        const model = String(hint['model'] ?? '').trim();
        const yStart =
          parseInt(String(hint['yearStart'] ?? hint['year'] ?? ''), 10) || 0;
        const yEnd =
          parseInt(String(hint['yearEnd'] ?? yStart), 10) || yStart;
        if (!make || !model || !yStart) continue;
        for (let y = yStart; y <= yEnd; y++) {
          addUniqueRow(result.expandedRows, seen, {
            year: String(y),
            make,
            model,
            trim: String(hint['trim'] ?? ''),
            engine: String(hint['engine'] ?? ''),
            submodel: String(hint['chassisCode'] ?? ''),
            bodyType: '',
            notes: String(hint['reason'] ?? 'AI interchange hint'),
            source: 'ai_interchange_hint',
          });
        }
      }
    }

    const dbActive = await this.mvlStore.hasActiveRelease(mkt);
    let fitmentSource: MvlFitmentExpandResult['fitmentSource'] = 'mvl';

    if (dbActive) {
      const filtered = await this.mvlStore.filterRowsAgainstMvl(
        mkt,
        result.expandedRows,
      );
      if (filtered.usedDb) {
        result.expandedRows = filtered.accepted;
        result.coverage.mvlRejected += filtered.rejectedCount;
        fitmentSource =
          filtered.rejectedCount > 0 ? 'mvl+filtered' : 'mvl';
      }
    } else if (
      this.config.get<string>('FITMENT_MVL_REQUIRED', 'true') !== 'false'
    ) {
      manualReviewReasons.push(
        'Local MVL release not loaded — fitment is platform-expanded only',
      );
      fitmentSource = 'mvl_pending_db';
    }

    const needsAiInterchange = evaluateNeedsAiInterchange(
      result.expandedRows.length,
      minRows,
      result.tier,
      aiInterchange,
    );

    if (needsAiInterchange) {
      manualReviewReasons.push(
        `Fitment rows (${result.expandedRows.length}) below minimum (${minRows}) — interchange review recommended`,
      );
    }

    result.ranges = collapseYearRanges(result.expandedRows);

    return {
      status:
        manualReviewReasons.length > 0 || needsAiInterchange
          ? 'needs_review'
          : 'completed',
      fitmentSource,
      ranges: result.ranges,
      expandedRows: result.expandedRows,
      coverage: result.coverage,
      needsAiInterchange,
      manualReviewReasons,
    };
  }
}

function fitmentRowKey(row: ExpandedFitmentRow): string {
  return `${row.year}|${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}`.toLowerCase();
}

function addUniqueRow(
  rows: ExpandedFitmentRow[],
  seen: Set<string>,
  entry: ExpandedFitmentRow,
): boolean {
  const key = fitmentRowKey(entry);
  if (seen.has(key)) return false;
  seen.add(key);
  rows.push(entry);
  return true;
}
