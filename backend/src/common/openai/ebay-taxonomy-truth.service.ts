/**
 * EbayTaxonomyTruthService — cached eBay category / aspect truth checks.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayCategory } from '../../listings/entities/ebay-category.entity.js';

export interface TaxonomyTruthResult {
  hardFails: string[];
  softFails: string[];
  skipped: boolean;
}

function aspectLabel(aspect: Record<string, unknown>): string | null {
  const name =
    aspect.localizedAspectName ??
    aspect.aspectName ??
    aspect.name ??
    aspect.label;
  return name ? String(name).trim() : null;
}

@Injectable()
export class EbayTaxonomyTruthService {
  private readonly logger = new Logger(EbayTaxonomyTruthService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(EbayCategory)
    private readonly categoryRepo: Repository<EbayCategory>,
  ) {}

  isEnabled(): boolean {
    return (
      this.config.get('AI_TAXONOMY_VALIDATION_ENABLED', 'false') === 'true'
    );
  }

  async validate(
    ebayCategoryId: string | undefined | null,
    itemSpecifics: Record<string, string>,
  ): Promise<TaxonomyTruthResult> {
    if (!this.isEnabled()) {
      return { hardFails: [], softFails: [], skipped: true };
    }

    const hardFails: string[] = [];
    const softFails: string[] = [];

    if (!ebayCategoryId?.trim()) {
      softFails.push('TAXONOMY_NO_CATEGORY_ID');
      return { hardFails, softFails, skipped: false };
    }

    const category = await this.categoryRepo.findOne({
      where: { ebayCategoryId: ebayCategoryId.trim() },
    });

    if (!category) {
      softFails.push(`TAXONOMY_CATEGORY_NOT_CACHED:${ebayCategoryId}`);
      return { hardFails, softFails, skipped: false };
    }

    if (!category.isLeaf) {
      hardFails.push(`TAXONOMY_NOT_LEAF:${ebayCategoryId}`);
    }

    const requiredNames = (category.requiredAspects ?? [])
      .map((a) => aspectLabel(a))
      .filter((n): n is string => Boolean(n));

    for (const aspectName of requiredNames) {
      const value = itemSpecifics[aspectName];
      if (!value || !String(value).trim()) {
        hardFails.push(`TAXONOMY_MISSING_ASPECT:${aspectName}`);
      }
    }

    this.logger.debug(
      `Taxonomy check cat=${ebayCategoryId} hard=${hardFails.length} soft=${softFails.length}`,
    );

    return { hardFails, softFails, skipped: false };
  }
}
