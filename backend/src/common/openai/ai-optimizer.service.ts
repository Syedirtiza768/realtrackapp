/**
 * AiOptimizerService — offline bandit + threshold tuner for routing policy.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AiRunLogService } from './ai-run-log.service.js';
import type { AiRoutingPolicy } from './ai-routing-policy.types.js';
import { ModelRouter } from './model-router.js';
import { AiRoutingPolicyHistory } from './entities/ai-routing-policy-history.entity.js';

const PRIOR_REWARDS: Record<string, number> = {
  'openai/gpt-4.1-mini': 0.98,
  'google/gemini-2.5-flash': 1.0,
  'deepseek/deepseek-chat-v3-0324': 0.94,
  'openai/gpt-4o-mini': 0.8,
};

const ALLOWED_MODELS = [
  'openai/gpt-4.1-mini',
  'google/gemini-2.5-flash',
  'deepseek/deepseek-chat-v3-0324',
  'openai/gpt-4o-mini',
];

@Injectable()
export class AiOptimizerService {
  private readonly logger = new Logger(AiOptimizerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly runLogService: AiRunLogService,
    private readonly modelRouter: ModelRouter,
    @InjectRepository(AiRoutingPolicyHistory)
    private readonly policyHistoryRepo: Repository<AiRoutingPolicyHistory>,
  ) {}

  @Cron('0 2 * * *', { name: 'ai-routing-optimizer' })
  async runNightlyIfEnabled(): Promise<void> {
    if (this.config.get('AI_OPTIMIZER_ENABLED', 'false') !== 'true') return;
    await this.optimize();
  }

  computeReward(stats: {
    humanApprovalRate: number;
    firstPassRate: number;
    publishSuccessRate: number;
    avgCost: number;
    escalationRate: number;
    avgComplianceScore?: number;
    hardFailRate?: number;
    publishErrorRate?: number;
  }): number {
    const normalizedCost = Math.min(stats.avgCost / 0.01, 1);
    const hardFailRate = stats.hardFailRate ?? 0;
    const publishErrorRate = stats.publishErrorRate ?? 0;
    const compliance = stats.avgComplianceScore ?? 0.85;
    return (
      0.3 * stats.humanApprovalRate +
      0.25 * stats.firstPassRate +
      0.15 * stats.publishSuccessRate +
      0.15 * compliance +
      0.05 * (1 - normalizedCost) -
      0.5 * stats.escalationRate -
      1.0 * hardFailRate -
      0.3 * publishErrorRate
    );
  }

  async optimize(): Promise<AiRoutingPolicy | null> {
    const minSamples = Number(this.config.get('AI_LEARNING_MIN_SAMPLES', '20'));
    const stats = await this.runLogService.getSegmentStats(30);
    const current = this.modelRouter.getPolicy();
    const blocklist = this.modelRouter.getBlocklist();

    const next: AiRoutingPolicy = {
      version: (current?.version ?? 0) + 1,
      generatedAt: new Date().toISOString(),
      canaryPercent: Number(this.config.get('AI_OPTIMIZER_CANARY_PERCENT', '10')),
      source: 'optimizer',
      segments: { ...(current?.segments ?? {}) },
      thresholds: { ...this.modelRouter.getThresholds() },
      escalationChain: current?.escalationChain ?? [
        'openai/gpt-4.1-mini',
        'google/gemini-2.5-flash',
      ],
      blocklist,
      pins: current?.pins ?? {},
    };

    for (const seg of stats) {
      if (seg.attempts < minSamples) continue;
      const reward = this.computeReward({
        humanApprovalRate: seg.humanApprovalRate || PRIOR_REWARDS[seg.model] || 0.85,
        firstPassRate: seg.firstPassRate,
        publishSuccessRate: seg.publishSuccessRate,
        avgCost: seg.avgCost,
        escalationRate: seg.escalationRate,
        avgComplianceScore: seg.avgComplianceScore,
        hardFailRate: seg.hardFailRate,
        publishErrorRate: seg.publishErrorRate,
      });
      if (!ALLOWED_MODELS.includes(seg.model) || blocklist.includes(seg.model)) {
        this.logger.error(
          `Optimizer attempted blocklisted model ${seg.model} — skipping`,
        );
        continue;
      }
      if (reward < 0.5) continue;
      next.segments[seg.segmentKey] = {
        lane:
          seg.model === 'deepseek/deepseek-chat-v3-0324'
            ? 'bulk'
            : seg.model === 'google/gemini-2.5-flash'
              ? 'flagship'
              : 'default',
        model: seg.model,
      };
    }

    const policyPath = this.resolveOutputPath();
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(policyPath, JSON.stringify(next, null, 2));
    await this.policyHistoryRepo.save(
      this.policyHistoryRepo.create({
        version: next.version,
        policy: next,
        source: next.source ?? 'optimizer',
      }),
    );
    this.modelRouter.reloadPolicy();
    this.logger.log(`Wrote routing policy v${next.version} to ${policyPath}`);
    return next;
  }

  async generateRecommendations(): Promise<Record<string, unknown>> {
    const stats = await this.runLogService.getSegmentStats(30);
    const recommendations = stats.map((seg) => ({
      segment: seg.segmentKey,
      model: seg.model,
      attempts: seg.attempts,
      reward: this.computeReward({
        humanApprovalRate: seg.humanApprovalRate,
        firstPassRate: seg.firstPassRate,
        publishSuccessRate: seg.publishSuccessRate,
        avgCost: seg.avgCost,
        escalationRate: seg.escalationRate,
        avgComplianceScore: seg.avgComplianceScore,
        hardFailRate: seg.hardFailRate,
        publishErrorRate: seg.publishErrorRate,
      }),
      prior: PRIOR_REWARDS[seg.model] ?? null,
    }));
    return {
      generatedAt: new Date().toISOString(),
      recommendations: recommendations.sort((a, b) => b.reward - a.reward),
    };
  }

  private resolveOutputPath(): string {
    const configured = this.config.get<string>('AI_ROUTING_POLICY_PATH');
    if (configured) {
      return path.isAbsolute(configured)
        ? configured
        : path.resolve(process.cwd(), '..', configured);
    }
    return path.resolve(process.cwd(), '../config/ai-routing-policy.json');
  }
}
