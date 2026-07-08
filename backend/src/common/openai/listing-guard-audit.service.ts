import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceAuditLog } from '../../catalog-import/entities/compliance-audit-log.entity.js';

const FIX_FIELD_MAP: Record<string, string> = {
  TITLE_TRIMMED: 'title',
  BRAND_NORMALIZED: 'brand',
  MPN_NORMALIZED: 'mpn',
  MPN_SET_FROM_INPUT: 'mpn',
  DISCLAIMER_INJECTED: 'description',
  FITMENT_DEDUPED: 'compatibility',
};

/**
 * Records deterministic guard auto-fixes in compliance_audit_logs when product context exists.
 */
@Injectable()
export class ListingGuardAuditService {
  private readonly logger = new Logger(ListingGuardAuditService.name);

  constructor(
    @InjectRepository(ComplianceAuditLog)
    private readonly auditRepo: Repository<ComplianceAuditLog>,
  ) {}

  async logGuardFixes(
    fixes: string[],
    context: {
      productId?: string | null;
      importId?: string | null;
      sku?: string | null;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!fixes.length) return;
    if (!context.productId && !context.importId) return;

    const entries = fixes.map((fix) => {
      const field = FIX_FIELD_MAP[fix] ?? 'ai_guard';
      const beforeVal = context.before?.[field];
      const afterVal = context.after?.[field];
      return this.auditRepo.create({
        productId: context.productId ?? null,
        importId: context.importId ?? null,
        action: 'auto_correction',
        field,
        originalValue:
          beforeVal != null
            ? String(beforeVal).slice(0, 2000)
            : (context.sku ?? null),
        newValue: afterVal != null ? String(afterVal).slice(0, 2000) : fix,
        reason: `AI listing guard: ${fix}`,
        severity: 'info',
        autoFixed: true,
      });
    });

    try {
      await this.auditRepo.save(entries);
    } catch (err) {
      this.logger.warn(`Failed to log guard fixes to compliance_audit: ${err}`);
    }
  }
}
