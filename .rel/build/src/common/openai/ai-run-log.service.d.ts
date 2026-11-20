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
export declare class AiRunLogService {
    private readonly repo;
    private readonly logger;
    constructor(repo: Repository<AiRunLog>);
    logRun(input: CreateAiRunLogInput): Promise<AiRunLog>;
    backfillApproval(enhancementId: string, approved: boolean, rejectionReason?: string, fieldEdits?: Array<{
        field: string;
        aiValue: string;
        finalValue: string;
    }>): Promise<void>;
    recordComplianceOutcome(sku: string, complianceScore: number): Promise<void>;
    recordPublishOutcome(sku: string, published: boolean, publishError?: string, ebayCategoryId?: string): Promise<void>;
    getBatchTotals(batchId: string): Promise<{
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        runs: number;
    }>;
    getSegmentStats(sinceDays?: number): Promise<Array<{
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
    }>>;
}
