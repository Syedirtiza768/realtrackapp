import { Repository } from 'typeorm';
import { EbayHostedImage } from '../../integrations/ebay/entities/ebay-hosted-image.entity.js';
import { StorageService } from '../../storage/storage.service.js';
import { EbayAuthService } from './ebay-auth.service.js';
export declare class EbayMediaApiService {
    private readonly auth;
    private readonly hostedImageRepo;
    private readonly storage;
    private readonly logger;
    private newConditionImageUrlsPromise;
    constructor(auth: EbayAuthService, hostedImageRepo: Repository<EbayHostedImage>, storage: StorageService);
    hostImages(storeId: string, sourceUrls: string[]): Promise<string[]>;
    getNewConditionImageUrls(options?: {
        uploadIfMissing?: boolean;
    }): Promise<string[]>;
    private ensureNewConditionImageUrls;
    private buildNewConditionImageUrls;
    private readBundledNewConditionImage;
    private hostImage;
    private imageFileName;
    private imageContentType;
    private isTransientMediaFailure;
    private isRecoverableImageFailure;
    private formatUploadError;
    private sleep;
    private cacheEntryIsUsable;
    private cacheKey;
    private isEbayHostedUrl;
    private mediaApiBaseUrl;
    private readApiError;
    private mapWithConcurrency;
}
