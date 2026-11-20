import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiLane, AiRoutingPolicy, PartContext, RouteSelection, RoutingThresholds, RunMode } from './ai-routing-policy.types.js';
export declare function inferPartType(part: PartContext): string;
export declare function priceBand(price?: number): string;
export declare class ModelRouter implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private policy;
    constructor(config: ConfigService);
    onModuleInit(): void;
    reloadPolicy(): void;
    getPolicy(): AiRoutingPolicy | null;
    getBlocklist(): string[];
    selectLane(part: PartContext, runMode?: RunMode): AiLane;
    selectTextRoute(part: PartContext, runMode?: RunMode): RouteSelection;
    selectVisionRoute(part: PartContext, runMode?: RunMode): RouteSelection;
    selectRoute(part: PartContext, runMode?: RunMode): RouteSelection;
    getEscalationModel(currentModel: string, lane: AiLane): string | null;
    assertAllowed(model: string): void;
    private buildSelection;
    private modelForLane;
    getThresholds(): RoutingThresholds;
    private resolvePolicyPath;
    private useCanary;
}
export declare function canaryBucketForSku(sku: string): number;
