import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
export declare class EbayTradingQuotaService {
    private readonly auth;
    constructor(auth: EbayAuthService);
    getPublishCapacity(): Promise<{
        remaining: number;
        limit: number;
        reset: Date;
    }>;
}
