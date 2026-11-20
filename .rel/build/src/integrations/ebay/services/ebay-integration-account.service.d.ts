import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';
export declare class EbayIntegrationAccountService {
    private readonly accountRepo;
    private readonly policyRepo;
    private readonly mpRepo;
    private readonly logWriter;
    constructor(accountRepo: Repository<ConnectedEbayAccount>, policyRepo: Repository<EbayBusinessPolicy>, mpRepo: Repository<EbayAccountMarketplace>, logWriter: ListingActionLogWriterService);
    listForOrganization(organizationId: string): Promise<{
        id: string;
        organizationId: string;
        internalStoreId: string | null;
        ebayUserId: string;
        ebayUsername: string | null;
        accountDisplayName: string;
        environment: import("../entities/connected-ebay-account.entity.js").EbayConnectionEnvironment;
        connectionStatus: import("../entities/connected-ebay-account.entity.js").EbayConnectionStatus;
        connectedAt: Date;
        lastVerifiedAt: Date | null;
        lastSuccessfulSyncAt: Date | null;
        lastTokenRefreshAt: Date | null;
        lastErrorMessage: string | null;
        lastListingsFetchedCount: number;
        lastPoliciesFetchedCount: number;
        primaryStoreId: string;
        connectionSource: "native_oauth" | "sellerpundit";
        sellerpunditTokenId: number | null;
        sellerpunditAccountName: string | null;
        sellerpunditLastSyncAt: Date | null;
        sellerpunditLastPolicySyncAt: Date | null;
        marketplaces: {
            id: string;
            marketplaceId: string;
            currency: string;
            locale: string;
            enabled: boolean;
            defaultPaymentPolicyId: string | null;
            defaultReturnPolicyId: string | null;
            defaultFulfillmentPolicyId: string | null;
            defaultInventoryLocationKey: string | null;
        }[];
    }[]>;
    getOne(id: string, organizationId: string): Promise<{
        id: string;
        organizationId: string;
        internalStoreId: string | null;
        ebayUserId: string;
        ebayUsername: string | null;
        accountDisplayName: string;
        environment: import("../entities/connected-ebay-account.entity.js").EbayConnectionEnvironment;
        connectionStatus: import("../entities/connected-ebay-account.entity.js").EbayConnectionStatus;
        connectedAt: Date;
        lastVerifiedAt: Date | null;
        lastSuccessfulSyncAt: Date | null;
        lastTokenRefreshAt: Date | null;
        lastErrorMessage: string | null;
        lastListingsFetchedCount: number;
        lastPoliciesFetchedCount: number;
        primaryStoreId: string;
        connectionSource: "native_oauth" | "sellerpundit";
        sellerpunditTokenId: number | null;
        sellerpunditAccountName: string | null;
        sellerpunditLastSyncAt: Date | null;
        sellerpunditLastPolicySyncAt: Date | null;
        marketplaces: {
            id: string;
            marketplaceId: string;
            currency: string;
            locale: string;
            enabled: boolean;
            defaultPaymentPolicyId: string | null;
            defaultReturnPolicyId: string | null;
            defaultFulfillmentPolicyId: string | null;
            defaultInventoryLocationKey: string | null;
        }[];
    }>;
    getPolicies(id: string, organizationId: string): Promise<{
        policies: {
            id: string;
            marketplaceId: string;
            policyType: import("../entities/ebay-business-policy.entity.js").EbayPolicyType;
            ebayPolicyId: string;
            name: string;
            isDefault: boolean;
        }[];
    }>;
    patchDefaultPolicies(id: string, organizationId: string, body: {
        marketplaceId: string;
        defaultPaymentPolicyId?: string | null;
        defaultReturnPolicyId?: string | null;
        defaultFulfillmentPolicyId?: string | null;
        defaultInventoryLocationKey?: string | null;
    }, meta?: {
        userId?: string | null;
        ip?: string | null;
        userAgent?: string | null;
    }): Promise<{
        id: string;
        organizationId: string;
        internalStoreId: string | null;
        ebayUserId: string;
        ebayUsername: string | null;
        accountDisplayName: string;
        environment: import("../entities/connected-ebay-account.entity.js").EbayConnectionEnvironment;
        connectionStatus: import("../entities/connected-ebay-account.entity.js").EbayConnectionStatus;
        connectedAt: Date;
        lastVerifiedAt: Date | null;
        lastSuccessfulSyncAt: Date | null;
        lastTokenRefreshAt: Date | null;
        lastErrorMessage: string | null;
        lastListingsFetchedCount: number;
        lastPoliciesFetchedCount: number;
        primaryStoreId: string;
        connectionSource: "native_oauth" | "sellerpundit";
        sellerpunditTokenId: number | null;
        sellerpunditAccountName: string | null;
        sellerpunditLastSyncAt: Date | null;
        sellerpunditLastPolicySyncAt: Date | null;
        marketplaces: {
            id: string;
            marketplaceId: string;
            currency: string;
            locale: string;
            enabled: boolean;
            defaultPaymentPolicyId: string | null;
            defaultReturnPolicyId: string | null;
            defaultFulfillmentPolicyId: string | null;
            defaultInventoryLocationKey: string | null;
        }[];
    }>;
    patch(id: string, organizationId: string, patch: {
        accountDisplayName?: string;
        connectionStatus?: ConnectedEbayAccount['connectionStatus'];
    }): Promise<ConnectedEbayAccount>;
    disconnect(id: string, organizationId: string, userId: string | null, meta?: {
        ip?: string | null;
        userAgent?: string | null;
    }): Promise<{
        ok: boolean;
    }>;
}
