import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ComplianceAuditLog,
  type AuditAction,
} from '../entities/compliance-audit-log.entity.js';

/**
 * ComplianceAuditService — logs all compliance transformations and validations.
 */
@Injectable()
export class ComplianceAuditService {
  private readonly logger = new Logger(ComplianceAuditService.name);

  constructor(
    @InjectRepository(ComplianceAuditLog)
    private readonly auditRepo: Repository<ComplianceAuditLog>,
  ) {}

  /**
   * Log a single compliance action.
   */
  async log(entry: {
    productId?: string | null;
    importId?: string | null;
    action: AuditAction;
    field: string;
    originalValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
    severity?: string;
    complianceScore?: number | null;
    autoFixed?: boolean;
  }): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          productId: entry.productId ?? null,
          importId: entry.importId ?? null,
          action: entry.action,
          field: entry.field,
          originalValue: entry.originalValue ?? null,
          newValue: entry.newValue ?? null,
          reason: entry.reason ?? null,
          severity: entry.severity ?? 'info',
          complianceScore: entry.complianceScore ?? null,
          autoFixed: entry.autoFixed ?? false,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to log compliance audit: ${err}`);
    }
  }

  /**
   * Log multiple compliance actions in a batch.
   */
  async logBatch(
    entries: Array<{
      productId?: string | null;
      importId?: string | null;
      action: AuditAction;
      field: string;
      originalValue?: string | null;
      newValue?: string | null;
      reason?: string | null;
      severity?: string;
      complianceScore?: number | null;
      autoFixed?: boolean;
    }>,
  ): Promise<void> {
    if (entries.length === 0) return;

    try {
      const records = entries.map((e) =>
        this.auditRepo.create({
          productId: e.productId ?? null,
          importId: e.importId ?? null,
          action: e.action,
          field: e.field,
          originalValue: e.originalValue ?? null,
          newValue: e.newValue ?? null,
          reason: e.reason ?? null,
          severity: e.severity ?? 'info',
          complianceScore: e.complianceScore ?? null,
          autoFixed: e.autoFixed ?? false,
        }),
      );

      await this.auditRepo.save(records);
    } catch (err) {
      this.logger.warn(`Failed to batch log compliance audits: ${err}`);
    }
  }

  /**
   * Get audit logs for a specific product.
   */
  async getByProduct(
    productId: string,
    limit = 100,
  ): Promise<ComplianceAuditLog[]> {
    return this.auditRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific import.
   */
  async getByImport(
    importId: string,
    limit = 500,
  ): Promise<ComplianceAuditLog[]> {
    return this.auditRepo.find({
      where: { importId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit summary stats for an import.
   */
  async getImportAuditSummary(importId: string): Promise<{
    totalActions: number;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    autoFixedCount: number;
  }> {
    const logs = await this.auditRepo.find({ where: { importId } });

    const byAction: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let autoFixedCount = 0;

    for (const log of logs) {
      byAction[log.action] = (byAction[log.action] ?? 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] ?? 0) + 1;
      if (log.autoFixed) autoFixedCount++;
    }

    return {
      totalActions: logs.length,
      byAction,
      bySeverity,
      autoFixedCount,
    };
  }
}
