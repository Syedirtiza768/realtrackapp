import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AiRunLogService } from './ai-run-log.service.js';
import type { AiRoutingPolicy } from './ai-routing-policy.types.js';
import { ModelRouter } from './model-router.js';
import { AiRoutingPolicyHistory } from './entities/ai-routing-policy-history.entity.js';
export declare class AiOptimizerService {
    private readonly config;
    private readonly runLogService;
    private readonly modelRouter;
    private readonly policyHistoryRepo;
    private readonly logger;
    constructor(config: ConfigService, runLogService: AiRunLogService, modelRouter: ModelRouter, policyHistoryRepo: Repository<AiRoutingPolicyHistory>);
    runNightlyIfEnabled(): Promise<void>;
    computeReward(stats: {
        humanApprovalRate: number;
        firstPassRate: number;
        publishSuccessRate: number;
        avgCost: number;
        escalationRate: number;
        avgComplianceScore?: number;
        hardFailRate?: number;
        publishErrorRate?: number;
    }): number;
    optimize(): Promise<AiRoutingPolicy | null>;
    generateRecommendations(): Promise<Record<string, unknown>>;
    private resolveOutputPath;
}
