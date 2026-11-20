import { ConfigService } from '@nestjs/config';
export interface OptimizedImage {
    localPath: string;
    originalUrl: string;
    width: number;
    height: number;
    format: string;
    fileSizeBytes: number;
    hash: string;
    aspectRatio: number;
}
export declare class ImageOptimizerService {
    private readonly config;
    private readonly logger;
    private readonly storageDir;
    private readonly maxDownloadBytes;
    constructor(config: ConfigService);
    downloadAndOptimize(url: string, options?: {
        targetFormat?: 'webp' | 'jpg';
        maxWidth?: number;
        quality?: number;
    }): Promise<OptimizedImage | null>;
    detectWatermark(imageBuffer: Buffer): Promise<{
        hasWatermark: boolean;
        confidence: number;
    }>;
    computePerceptualHash(imageBuffer: Buffer): Promise<string>;
    validateForEbay(imageBuffer: Buffer): Promise<{
        valid: boolean;
        width: number;
        height: number;
        aspectRatio: number;
        issues: string[];
    }>;
    private downloadImage;
}
