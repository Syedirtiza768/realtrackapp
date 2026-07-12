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
        const liveName = node?.category?.categoryName;
        const nameChanged = liveName && liveName !== row.name;

        if (!isLeaf) {
          const reason = `No longer a leaf category (now "${liveName ?? 'unknown'}")`;
          findings.push({
            categoryId: row.id,
            categoryName: row.name,
            keywords: row.kw,
            reason,
          });
          this.logger.error(
            `CATEGORY_KEYWORD_ROWS drift: ${row.id} ("${row.name}", keywords: ${row.kw.join(', ')}) — ${reason}. Marking inactive in ebay_category_mappings.`,
          );
          await this.markInactive(row.id, liveName ?? row.name);
        } else if (nameChanged) {
          // Still a valid, publishable leaf — but eBay reassigned this ID to
          // mean something different (e.g. 33717 used to be "Dashboards &
          // Dashboard Parts", now "Turn Signal Light Assemblies"). Publish
          // would succeed silently under the wrong category — worse than a
          // hard failure, since nothing errors. This is a real, actionable
          // finding requiring a code fix to CATEGORY_KEYWORD_ROWS, but NOT
          // grounds to mark the ID inactive — it's still valid, just no
          // longer the right ID for these keywords.
          const reason = `Still a valid leaf, but eBay renamed it to "${liveName}" — hardcoded mapping may now point to the wrong category for these keywords`;
          findings.push({
            categoryId: row.id,
            categoryName: row.name,
            keywords: row.kw,
            reason,
          });
          this.logger.error(
            `CATEGORY_KEYWORD_ROWS drift: ${row.id} ("${row.name}", keywords: ${row.kw.join(', ')}) — ${reason}`,
          );
        }
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 400 || status === 404 || status === 410) {
          // Category ID no longer exists at all (retired/merged by eBay) —
          // definitely actionable, and safe to mark inactive since it can
          // never resolve to anything valid.
          const reason = `Category lookup failed with ${status} — likely retired/merged by eBay`;
          findings.push({
            categoryId: row.id,
            categoryName: row.name,
            keywords: row.kw,
            reason,
          });
          this.logger.error(
            `CATEGORY_KEYWORD_ROWS drift: ${row.id} ("${row.name}", keywords: ${row.kw.join(', ')}) — ${reason}. Marking inactive in ebay_category_mappings.`,
          );
          await this.markInactive(row.id, row.name);
        } else {
          // Transient failure (rate limit, network, timeout) — don't treat
          // as a finding, don't block the rest of the audit.
          this.logger.warn(
            `Category audit could not verify ${row.id} ("${row.name}"): ${(err as Error).message}`,
          );
        }
      }
    }

    if (findings.length === 0) {
      this.logger.log(
        `Category keyword audit: all ${CATEGORY_KEYWORD_ROWS.length} hardcoded category IDs are still valid leaves with matching names.`,
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
