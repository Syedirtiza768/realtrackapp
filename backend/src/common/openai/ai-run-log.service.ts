import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiRunLog } from './entities/ai-run-log.entity.js';

export interface CreateAiRunLogInput {
  sku?: string | null;
  partNumber?: string | null;
  partType?: string | null;
  price?: number | null;
  donorVehicle?: Record<string, unknown> | null;
  marketplace?: string | null;
  batchId?: string | null;
  enhancementId?: string | null;
  lane: string;
  model: string;
  attempt?: number;
  promptVersion: string;
  routingPolicyVersion?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  latencyMs?: number | null;
  validationScore?: number | null;
  hardFails?: string[];
  softFails?: string[];
  escalated?: boolean;
  passedGate?: boolean;
  fitmentRowCount?: number | null;
  fitmentSource?: string | null;
  fitmentRowsPre?: number | null;
  fitmentRowsPost?: number | null;
  tokensSavedEstimate?: number | null;
  guardFixes?: string[] | null;
}

@Injectable()
export class AiRunLogService {
  private readonly logger = new Logger(AiRunLogService.name);

  constructor(
    @InjectRepository(AiRunLog)
    private readonly repo: Repository<AiRunLog>,
  ) {}

  async logRun(input: CreateAiRunLogInput): Promise<AiRunLog> {
    const row = this.repo.create({
      sku: input.sku ?? null,
      partNumber: input.partNumber ?? null,
      partType: input.partType ?? null,
      price: input.price ?? null,
      donorVehicle: input.donorVehicle ?? null,
      marketplace: input.marketplace ?? null,
      batchId: input.batchId ?? null,
      enhancementId: input.enhancementId ?? null,
      lane: input.lane,
      model: input.model,
      attempt: input.attempt ?? 1,
      promptVersion: input.promptVersion,
      routingPolicyVersion: input.routingPolicyVersion ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      costUsd: input.costUsd ?? null,
      latencyMs: input.latencyMs ?? null,
      validationScore: input.validationScore ?? null,
      hardFails: input.hardFails ?? [],
      softFails: input.softFails ?? [],
      escalated: input.escalated ?? false,
      passedGate: input.passedGate ?? false,
      fitmentRowCount: input.fitmentRowCount ?? null,
      fitmentSource: input.fitmentSource ?? null,
      fitmentRowsPre: input.fitmentRowsPre ?? null,
      fitmentRowsPost: input.fitmentRowsPost ?? null,
      tokensSavedEstimate: input.tokensSavedEstimate ?? null,
      guardFixes: input.guardFixes ?? null,
    });
    return this.repo.save(row);
  }

  async backfillApproval(
    enhancementId: string,
    approved: boolean,
    rejectionReason?: string,
    fieldEdits?: Array<{ field: string; aiValue: string; finalValue: string }>,
  ): Promise<void> {
    await this.repo.update(
      { enhancementId },
      {
        humanApproved: approved,
        humanRejected: !approved,
        rejectionReason: approved ? null : (rejectionReason ?? null),
        fieldEdits: fieldEdits ?? null,
      },
    );
  }

  async recordComplianceOutcome(
    sku: string,
    complianceScore: number,
  ): Promise<void> {
    const latest = await this.repo.findOne({
      where: { sku },
      order: { createdAt: 'DESC' },
    });
    if (!latest) {
      this.logger.debug(
        `No ai_run_log for SKU ${sku} — skipping compliance outcome`,
      );
      return;
    }
    latest.complianceScore = complianceScore;
    await this.repo.save(latest);
  }

  async recordPublishOutcome(
    sku: string,
    published: boolean,
    publishError?: string,
    ebayCategoryId?: string,
  ): Promise<void> {
    const latest = await this.repo.findOne({
      where: { sku },
      order: { createdAt: 'DESC' },
    });
    if (!latest) {
      this.logger.debug(
        `No ai_run_log for SKU ${sku} — skipping publish outcome`,
      );
      return;
    }
    latest.published = published;
    latest.publishError = publishError ?? null;
    latest.ebayCategoryId = ebayCategoryId ?? null;
    await this.repo.save(latest);
  }

  async getSegmentStats(sinceDays = 30): Promise<
    Array<{
      segmentKey: string;
      model: string;
      attempts: number;
      firstPassRate: number;
      escalationRate: number;
      avgCost: number;
      avgValidationScore: number;
      humanApprovalRate: number;
      publishSuccessRate: number;
      avgComplianceScore: number;
      hardFailRate: number;
      publishErrorRate: number;
    }>
  > {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);

    const rows = await this.repo
      .createQueryBuilder('l')
      .select('l.part_type', 'partType')
      .addSelect('l.model', 'model')
      .addSelect('l.lane', 'lane')
      .addSelect('COUNT(*)', 'attempts')
      .addSelect(
        'AVG(CASE WHEN l.passed_gate AND NOT l.escalated THEN 1.0 ELSE 0.0 END)',
        'firstPassRate',
      )
      .addSelect(
        'AVG(CASE WHEN l.escalated THEN 1.0 ELSE 0.0 END)',
        'escalationRate',
      )
      .addSelect('AVG(l.cost_usd)', 'avgCost')
      .addSelect('AVG(l.validation_score)', 'avgValidationScore')
      .addSelect(
        'AVG(CASE WHEN l.human_approved THEN 1.0 WHEN l.human_approved IS NOT NULL THEN 0.0 ELSE NULL END)',
        'humanApprovalRate',
      )
      .addSelect(
        'AVG(CASE WHEN l.published THEN 1.0 WHEN l.published IS NOT NULL THEN 0.0 ELSE NULL END)',
        'publishSuccessRate',
      )
      .addSelect('AVG(l.compliance_score)', 'avgComplianceScore')
      .addSelect(
        'AVG(CASE WHEN jsonb_array_length(l.hard_fails) > 0 THEN 1.0 ELSE 0.0 END)',
        'hardFailRate',
      )
      .addSelect(
        `AVG(CASE WHEN l.publish_error IS NOT NULL AND l.publish_error <> '' THEN 1.0 WHEN l.published IS NOT NULL THEN 0.0 ELSE NULL END)`,
        'publishErrorRate',
      )
      .where('l.created_at >= :since', { since })
      .groupBy('l.part_type')
      .addGroupBy('l.model')
      .addGroupBy('l.lane')
      .getRawMany();

    return rows.map((r) => ({
      segmentKey: `${r.partType ?? 'general'}|${r.lane ?? 'default'}`,
      model: r.model,
      attempts: Number(r.attempts),
      firstPassRate: Number(r.firstPassRate ?? 0),
      escalationRate: Number(r.escalationRate ?? 0),
      avgCost: Number(r.avgCost ?? 0),
      avgValidationScore: Number(r.avgValidationScore ?? 0),
      humanApprovalRate: Number(r.humanApprovalRate ?? 0),
      publishSuccessRate: Number(r.publishSuccessRate ?? 0),
      avgComplianceScore: Number(r.avgComplianceScore ?? 0),
      hardFailRate: Number(r.hardFailRate ?? 0),
      publishErrorRate: Number(r.publishErrorRate ?? 0),
    }));
  }
}
