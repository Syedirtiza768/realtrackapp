import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import { EbaySellAccountApiService } from './ebay-sell-account-api.service.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';
import { SellerpunditPolicySyncService } from '../../sellerpundit/sellerpundit-policy-sync.service.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
export declare class EbayPolicySyncService {
    private readonly accountRepo;
    private readonly policyRepo;
    private readonly mpRepo;
    private readonly tokens;
    private readonly sellAccount;
    private readonly logWriter;
    private readonly sellerpunditPolicies;
    private readonly inventoryApi;
    private readonly ebayAuth;
    private readonly logger;
    constructor(accountRepo: Repository<ConnectedEbayAccount>, policyRepo: Repository<EbayBusinessPolicy>, mpRepo: Repository<EbayAccountMarketplace>, tokens: EbayAccountTokenService, sellAccount: EbaySellAccountApiService, logWriter: ListingActionLogWriterService, sellerpunditPolicies: SellerpunditPolicySyncService, inventoryApi: EbayInventoryApiService, ebayAuth: EbayAuthService);
    private baseUrl;
    syncPolicies(ebayAccountId: string, organizationId: string, userId?: string | null): Promise<{
        ok: boolean;
        synced: number;
        message: string;
    }>;
    private _syncPoliciesInner;
    private overlaySellerpunditPoliciesFromEbayApi;
    private hydrateInventoryLocationsFromStore;
}
