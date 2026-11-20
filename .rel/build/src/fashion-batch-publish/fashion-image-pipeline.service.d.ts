import { StorageService } from '../storage/storage.service.js';
import type { ImageVariantName, PipelineImage } from './entities/fashion-publish.entities.js';
export declare const EBAY_MIN_LONGEST_SIDE = 500;
export declare const LOW_QUALITY_LONGEST_SIDE = 1600;
export declare const EBAY_MASTER_MAX_LONGEST_SIDE = 2000;
export declare const EBAY_MAX_IMAGES = 24;
interface VariantSpec {
    name: Exclude<ImageVariantName, 'original'>;
    ext: 'webp' | 'jpg';
    contentType: string;
    longest: number;
    quality: number;
}
export declare const IMAGE_VARIANTS: VariantSpec[];
export declare function dimensionFlags(width: number, height: number): string[];
export declare function orientedSize(meta: {
    width?: number;
    height?: number;
    orientation?: number;
}): {
    width: number;
    height: number;
};
export interface ImagePipelineResult {
    images: PipelineImage[];
    masterUrls: string[];
}
export declare class FashionImagePipelineService {
    private readonly storage;
    private readonly logger;
    constructor(storage: StorageService);
    process(listingId: string, sourceUrls: string[], previous?: PipelineImage[]): Promise<ImagePipelineResult>;
    private processOne;
    private fetchImage;
}
export declare function ebayMasterUrls(images: PipelineImage[]): string[];
export declare function renderVariants(buffer: Buffer): Promise<Record<Exclude<ImageVariantName, 'original'>, Buffer>>;
export {};
