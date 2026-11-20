import sharp from 'sharp';
import { StorageService } from './storage.service.js';
export interface ImageVariant {
    suffix: string;
    width: number;
    height: number;
    fit: keyof sharp.FitEnum;
    quality: number;
}
export interface ProcessingResult {
    thumbnailKey: string | null;
    mediumKey: string | null;
    smallKey: string | null;
    largeKey: string | null;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    dominantColor: string | null;
}
export interface CanonicalWebpResult {
    buffer: Buffer;
    width: number | null;
    height: number | null;
}
export declare class ImageProcessorService {
    private readonly storage;
    private readonly logger;
    constructor(storage: StorageService);
    convertBufferToWebp(buffer: Buffer, options?: {
        maxPixelCount?: number;
    }): Promise<CanonicalWebpResult>;
    processImage(s3Key: string): Promise<ProcessingResult>;
    validateMagicBytes(buffer: Buffer): {
        valid: boolean;
        type: string | null;
    };
}
