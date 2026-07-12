import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayTaxonomyApiService } from './ebay-taxonomy-api.service.js';
import { CATEGORY_KEYWORD_ROWS } from './ebay-german-listing.util.js';
import { EbayCategoryMapping } from '../../motors-intelligence/entities/ebay-category-mapping.entity.js';

export interface CategoryKeywordAuditFinding {
  categoryId: string;
  categoryName: string;
  keywords: string[];
  reason: string;
}

/**
 * Proactively re-validates every hardcoded category ID in
 * CATEGORY_KEYWORD_ROWS against eBay's live Taxonomy API.
 *
 * These IDs were correct when written, but eBay periodically restructures
 * its category tree — this is exactly how 33726 (hardcoded as "Exterior
 * Mirrors") silently became "Transmission & Drivetrain" and broke publish
 * for two listings in job 572e96dd. That was only caught reactively, after
 * a live publish failure. This runs the same leaf check proactively on a
 * schedule (see SchedulerService) so drift is caught and recorded before it
 * causes a publish failure, not after.
 *
 * Findings are persisted to ebay_category_mappings with
 * isMotorsCategory: false, so isMotorsCategory's DB-mapping lookup rejects
 * the stale ID immediately (no live API call needed) the next time a
 * product tries to use it — on top of the per-call leaf-check already in
 * EnterpriseListingIntelligenceService.isMotorsCategory.
 */
@Injectable()
export class EbayCategoryKeywordAuditService {
  private readonly logger = new Logger(EbayCategoryKeywordAuditService.name);
  private static readonly MOTORS_TREE_ID = '100';

  constructor(
    private readonly taxonomy: EbayTaxonomyApiService,
    @InjectRepository(EbayCategoryMapping)
    private readonly categoryMappingRepo: Repository<EbayCategoryMapping>,
  ) {}

  async auditCategoryKeywords(): Promise<CategoryKeywordAuditFinding[]> {
    const findings: CategoryKeywordAuditFinding[] = [];

    for (const row of CATEGORY_KEYWORD_ROWS) {
      try {
        const subtree = await this.taxonomy.getCategorySubtree(
          row.id,
          EbayCategoryKeywordAuditService.MOTORS_TREE_ID,
        );
        const node = subtree.categorySubtreeNode;
        const isLeaf = Boolean(node?.leafCategoryTreeNode);
        const nameChanged =
          node?.category?.categoryName &&
          node.category.categoryName !== row.name;

        if (!isLeaf) {
          const reason = `No longer a leaf category (now "${node?.category?.categoryName ?? 'unknown'}")`;
          findings.push({
            categoryId: row.id,
            categoryName: row.name,
            keywords: row.kw,
            reason,
          });
          this.logger.error(
            `CATEGORY_KEYWORD_ROWS drift: ${row.id} ("${row.name}", keywords: ${row.kw.join(', ')}) — ${reason}. Marking inactive in ebay_category_mappings.`,
          );
          await this.markInactive(row.id, node?.category?.categoryName ?? row.name);
        } else if (nameChanged) {
          // Still a leaf, but eBay renamed it — not broken, but worth
          // knowing about since our hardcoded `name` field is now stale.
          this.logger.warn(
            `CATEGORY_KEYWORD_ROWS: ${row.id} is still a valid leaf but eBay now calls it "${node.category.categoryName}" (we have "${row.name}")`,
          );
        }
      } catch (err) {
        // Don't let one API hiccup block the rest of the audit, and don't
        // treat a transient failure as a finding — only firm confirmation
        // of drift is actionable.
        this.logger.warn(
          `Category audit could not verify ${row.id} ("${row.name}"): ${(err as Error).message}`,
        );
      }
    }

    if (findings.length === 0) {
      this.logger.log(
        `Category keyword audit: all ${CATEGORY_KEYWORD_ROWS.length} hardcoded category IDs are still valid leaves.`,
      );
    } else {
      this.logger.error(
        `Category keyword audit: ${findings.length}/${CATEGORY_KEYWORD_ROWS.length} hardcoded category IDs have drifted — see errors above. These need a code fix (update CATEGORY_KEYWORD_ROWS to the current correct ID), not just the DB-side mitigation applied automatically here.`,
      );
    }

    return findings;
  }

  private async markInactive(
    categoryId: string,
    currentName: string,
  ): Promise<void> {
    try {
      const existing = await this.categoryMappingRepo.findOne({
        where: { ebayCategoryId: categoryId },
      });
      if (existing) {
        existing.isMotorsCategory = false;
        existing.active = false;
        existing.ebayCategoryName = currentName;
        await this.categoryMappingRepo.save(existing);
      } else {
        await this.categoryMappingRepo.save(
          this.categoryMappingRepo.create({
            ebayCategoryId: categoryId,
            ebayCategoryName: currentName,
            isMotorsCategory: false,
            active: false,
          }),
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to persist audit finding for category ${categoryId}: ${(err as Error).message}`,
      );
    }
  }
}
