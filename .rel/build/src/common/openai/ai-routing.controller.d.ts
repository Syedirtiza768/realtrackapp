import { AiRunLogService } from './ai-run-log.service.js';
import { AiOptimizerService } from './ai-optimizer.service.js';
import { ModelRouter } from './model-router.js';
import { OpenAiService } from './openai.service.js';
export declare class AiRoutingController {
    private readonly runLogService;
    private readonly optimizer;
    private readonly modelRouter;
    private readonly openai;
    constructor(runLogService: AiRunLogService, optimizer: AiOptimizerService, modelRouter: ModelRouter, openai: OpenAiService);
    getStats(): Promise<{
        generatedAt: string;
        policyVersion: number | null;
        segments: {
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
        }[];
        costByLane: Record<string, number>;
        sessionCostUsd: number;
    }>;
    getRecommendations(): Promise<Record<string, unknown>>;
    getPolicy(): import("./ai-routing-policy.types.js").AiRoutingPolicy | {
        version: null;
        source: string;
        thresholds: import("./ai-routing-policy.types.js").RoutingThresholds;
        blocklist: string[];
    };
    optimize(): Promise<import("./ai-routing-policy.types.js").AiRoutingPolicy | null>;
}
