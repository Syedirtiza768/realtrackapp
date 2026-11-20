import { Repository } from 'typeorm';
import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import { EbaySellAccountApiService } from './ebay-sell-account-api.service.js';
export type PaReturnPolicyEnsureResult = {
    returnPolicyId: string | null;
    action?: 'picked' | 'upgraded' | 'created' | 'unchanged' | 'blocked';
    blockedMessage?: string;
    accountApiUnavailable?: boolean;
};
export declare class EbayPaReturnPolicyService {
    private readonly ebayAuth;
    private readonly sellAccount;
    private readonly policyRepo;
    private readonly mpRepo;
    private readonly logger;
    constructor(ebayAuth: EbayAuthService, sellAccount: EbaySellAccountApiService, policyRepo: Repository<EbayBusinessPolicy>, mpRepo: Repository<EbayAccountMarketplace>);
    ensureCompliantReturnPolicy(params: {
        store: Store;
        account: ConnectedEbayAccount;
        marketplaceId: string;
        categoryId?: string;
        condition?: string;
        currentReturnPolicyId?: string | null;
    }): Promise<PaReturnPolicyEnsureResult>;
    private blockNonCompliant;
    private persistReturnPolicy;
    private updateMarketplaceDefault;
}
