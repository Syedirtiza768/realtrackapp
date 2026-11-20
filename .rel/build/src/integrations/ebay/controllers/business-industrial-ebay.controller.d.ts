import { Repository } from 'typeorm';
import { User } from '../../../auth/entities/user.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { EbayBulkPublishJobDto, EbayOAuthStartDto, EbayPublishJobDto, EbayValidateDto } from '../dto/ebay-integrations.dto.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayIntegrationsOAuthService } from '../services/ebay-integrations-oauth.service.js';
import { EbayMultiStoreListingService } from '../services/ebay-multi-store-listing.service.js';
import { BusinessIndustrialService } from '../../../verticals/business-industrial.service.js';
import { VerticalsService } from '../../../verticals/verticals.service.js';
import { EbayIntegrationAccountService } from '../services/ebay-integration-account.service.js';
import { EbayPolicySyncService } from '../services/ebay-policy-sync.service.js';
import { EbayTaxonomyApiService } from '../../../channels/ebay/ebay-taxonomy-api.service.js';
import { EbaySellingMetadataService } from '../../../channels/ebay/ebay-selling-metadata.service.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
export declare class BusinessIndustrialEbayController {
    private readonly oauth;
    private readonly permissions;
    private readonly listings;
    private readonly businessIndustrial;
    private readonly verticals;
    private readonly accountsService;
    private readonly policySync;
    private readonly taxonomy;
    private readonly sellingMetadata;
    private readonly productRepo;
    private readonly accountRepo;
    private readonly channelRepo;
    constructor(oauth: EbayIntegrationsOAuthService, permissions: EbayIntegrationPermissionsService, listings: EbayMultiStoreListingService, businessIndustrial: BusinessIndustrialService, verticals: VerticalsService, accountsService: EbayIntegrationAccountService, policySync: EbayPolicySyncService, taxonomy: EbayTaxonomyApiService, sellingMetadata: EbaySellingMetadataService, productRepo: Repository<CatalogProduct>, accountRepo: Repository<ConnectedEbayAccount>, channelRepo: Repository<EbayListingChannel>);
    start(dto: EbayOAuthStartDto, user: User): Promise<{
        authUrl: string;
        state: string;
    }>;
    accounts(user: User, organizationId?: string): Promise<{
        id: string;
        accountName: string;
        ebayUsername: string | null;
        accountDisplayName: string;
        primaryStoreId: string;
        connectionStatus: import("../entities/connected-ebay-account.entity.js").EbayConnectionStatus;
        status: import("../entities/connected-ebay-account.entity.js").EbayConnectionStatus;
        environment: import("../entities/connected-ebay-account.entity.js").EbayConnectionEnvironment;
        marketplaceId: string | null;
        storeId: string;
        storeName: string;
        locationKey: string | null;
        marketplaces: {
            marketplaceId: string;
            defaultPaymentPolicyId: string | null;
            defaultReturnPolicyId: string | null;
            defaultFulfillmentPolicyId: string | null;
            defaultInventoryLocationKey: string | null;
        }[];
    }[]>;
    policies(user: User, id: string, organizationId?: string, marketplaceId?: string): Promise<{
        policies: {
            id: string;
            marketplaceId: string;
            policyType: import("../entities/ebay-business-policy.entity.js").EbayPolicyType;
            ebayPolicyId: string;
            name: string;
            isDefault: boolean;
        }[];
    }>;
    syncPolicies(user: User, id: string, organizationId?: string): Promise<{
        ok: boolean;
        synced: number;
        message: string;
    }>;
    categories(user: User, id: string, q: string, marketplaceId?: string, organizationId?: string): Promise<import("../../../channels/ebay/ebay-api.types.js").EbayCategorySuggestion[]>;
    categoryMetadata(user: User, id: string, categoryId: string, marketplaceId?: string, organizationId?: string): Promise<{
        supportedConditions: string[];
        supportsVariations: boolean | null;
        marketplaceId: string;
        categoryId: string;
        aspects: import("../../../channels/ebay/ebay-api.types.js").EbayAspect[];
    }>;
    validate(dto: EbayValidateDto, user: User): Promise<{
        results: Record<string, unknown>[];
    }>;
    publish(dto: EbayPublishJobDto, user: User): Promise<{
        jobId: string;
        status: import("../entities/ebay-listing-job.entity.js").EbayListingJobStatus;
        skippedTargets: {
            ebayAccountId: string;
            marketplaceId: string;
            errors: string[];
        }[];
    }>;
    publishBulk(dto: EbayBulkPublishJobDto, user: User): Promise<{
        jobId: string;
        status: import("../entities/ebay-listing-job.entity.js").EbayListingJobStatus;
        targetCount: number;
        dailyLimit: number;
        dailyUsed: number;
        dailyRemaining: number;
        skipped: {
            listingId: string;
            reason: string;
        }[];
    }>;
    getJob(user: User, id: string, organizationId?: string): Promise<{
        id: string;
        jobId: string;
        jobType: import("../entities/ebay-listing-job.entity.js").EbayListingJobType;
        status: import("../entities/ebay-listing-job.entity.js").EbayListingJobStatus;
        createdAt: Date;
        updatedAt: Date;
        targets: {
            id: string;
            catalogProductId: string | null;
            ebayAccountId: string | null;
            marketplaceId: string;
            vertical: "fashion" | "business_industrial" | "automotive" | null;
            storeId: string | null;
            storeName: string | null;
            status: import("../entities/ebay-listing-job-target.entity.js").EbayListingJobTargetStatus;
            resultPayload: Record<string, unknown> | null;
            errorPayload: Record<string, unknown> | null;
            errorMessage: string | null;
            lastErrorMessage: string | null;
        }[];
    }>;
    channels(user: User, catalogProductId?: string, organizationId?: string): Promise<{
        items: Record<string, unknown>[];
        total: number;
    }>;
    end(user: User, id: string, organizationId?: string): Promise<{
        id: string;
        status: string;
        remoteRemovalVerified: boolean;
        message: string;
    } | {
        id: string;
        status: string;
        remoteRemovalVerified: boolean;
        message: undefined;
    }>;
    private assertPublishable;
    private allowUnapprovedPublish;
    private authorizedAccount;
    private marketplace;
    private authorizedJob;
}
