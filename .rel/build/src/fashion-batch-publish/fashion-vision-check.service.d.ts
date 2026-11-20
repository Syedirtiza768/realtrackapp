import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../common/openai/openai.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { PipelineImage } from './entities/fashion-publish.entities.js';
import { type ComplianceIssue } from './fashion-compliance.rules.js';
export declare const VISION_PROMPT_VERSION = "fashion-compliance-v1";
export interface VisionImageFinding {
    index: number;
    watermarkOrOtherSellerBranding?: boolean;
    stockOrCatalogPhoto?: boolean;
    showsDifferentProduct?: boolean;
    colorOrTypeMismatch?: boolean;
    collage?: boolean;
    heavyTextOverlay?: boolean;
    blurry?: boolean;
    note?: string;
}
export interface VisionVerdict {
    visibleBrands: Array<{
        imageIndex: number;
        brand: string;
        where?: string;
    }>;
    logoMatchesDeclaredBrand: boolean | null;
    logoConcerns: Array<{
        imageIndex: number;
        type: 'mismatch' | 'distorted' | 'misspelled';
        detail?: string;
    }>;
    images: VisionImageFinding[];
    suggestedFix: {
        title: string | null;
        brand: string | null;
        description: string | null;
        rationale: string;
    } | null;
    model?: string;
}
export interface VisionInput {
    title: string;
    description: string | null;
    brand: string | null;
    categoryName: string | null;
    color: string | null;
    textIssues: ComplianceIssue[];
    images: PipelineImage[];
}
export declare class FashionVisionCheckService {
    private readonly openai;
    private readonly storage;
    private readonly config;
    private readonly logger;
    constructor(openai: OpenAiService, storage: StorageService, config: ConfigService);
    fingerprint(input: VisionInput): string;
    private models;
    check(input: VisionInput): Promise<VisionVerdict>;
}
export declare function parseVisionVerdict(content: unknown, sent: Pick<PipelineImage, 'index'>[]): VisionVerdict;
export declare function visionIssues(verdict: VisionVerdict, images: PipelineImage[]): {
    issues: ComplianceIssue[];
    dropIndexes: Map<number, {
        code: string;
        reason: string;
    }>;
};
