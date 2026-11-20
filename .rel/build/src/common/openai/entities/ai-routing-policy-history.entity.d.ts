import type { AiRoutingPolicy } from '../ai-routing-policy.types.js';
export declare class AiRoutingPolicyHistory {
    id: string;
    version: number;
    policy: AiRoutingPolicy;
    source: string;
    generatedAt: Date;
}
