import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { User } from '../../../auth/entities/user.entity.js';
import { EbayOAuthStartDto, EbayReconnectBodyDto, EbayDefaultPoliciesPatchDto } from '../dto/ebay-integrations.dto.js';
import { EbayIntegrationsOAuthService } from '../services/ebay-integrations-oauth.service.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayIntegrationAccountService } from '../services/ebay-integration-account.service.js';
import { EbayPolicySyncService } from '../services/ebay-policy-sync.service.js';
import { EbaySyncService } from '../services/ebay-sync.service.js';
import { EbayApiAuditService } from '../services/ebay-api-audit.service.js';
import { UserOrganizationService } from '../../../auth/user-organization.service.js';
export declare class IntegrationsEbayController {
    private readonly oauth;
    private readonly permissions;
    private readonly accounts;
    private readonly policySync;
    private readonly ebaySync;
    private readonly apiAuditService;
    private readonly config;
    private readonly userOrgs;
    private readonly logger;
    constructor(oauth: EbayIntegrationsOAuthService, permissions: EbayIntegrationPermissionsService, accounts: EbayIntegrationAccountService, policySync: EbayPolicySyncService, ebaySync: EbaySyncService, apiAuditService: EbayApiAuditService, config: ConfigService, userOrgs: UserOrganizationService);
    workspace(user: User): Promise<{
        organizationId: string;
        organizationName: string;
        organizations: import("../../../auth/user-organization.service.js").UserOrganizationSummary[];
    }>;
    oauthStart(dto: EbayOAuthStartDto, user: User): Promise<{
        authUrl: string;
        state: string;
    }>;
    oauthCallback(code: string, state: string, res: Response): Promise<void>;
    listAccounts(organizationId: string | undefined, user: User): Promise<{
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
    getAccount(id: string, organizationId: string | undefined, user: User): Promise<{
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
    patchAccount(id: string, organizationId: string | undefined, user: User, body: {
        accountDisplayName?: string;
        connectionStatus?: string;
    }): Promise<import("../entities/connected-ebay-account.entity.js").ConnectedEbayAccount>;
    getPolicies(id: string, organizationId: string | undefined, user: User): Promise<{
        policies: {
            id: string;
            marketplaceId: string;
            policyType: import("../entities/ebay-business-policy.entity.js").EbayPolicyType;
            ebayPolicyId: string;
            name: string;
            isDefault: boolean;
        }[];
        account: {
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
        };
    }>;
    patchDefaultPolicies(id: string, organizationId: string | undefined, body: EbayDefaultPoliciesPatchDto, user: User, xf?: string, ua?: string): Promise<{
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
    disconnect(id: string, organizationId: string | undefined, user: User, xf?: string, ua?: string): Promise<{
        ok: boolean;
    }>;
    reconnect(id: string, organizationId: string | undefined, body: EbayReconnectBodyDto | undefined, user: User): Promise<{
        authUrl: string;
        state: string;
    }>;
    syncListings(id: string, organizationId: string | undefined, marketplaceId: string | undefined, user: User): Promise<{
        jobId: string;
        syncLogId: string;
    }>;
    syncOrders(id: string, organizationId: string | undefined, user: User): Promise<{
        jobId: string;
    }>;
    syncLogs(id: string, organizationId: string | undefined, user: User): Promise<import("../entities/ebay-listing-sync-log.entity.js").EbayListingSyncLog[]>;
    listApiAudit(id: string, organizationId: string | undefined, user: User): Promise<import("../entities/ebay-api-audit-log.entity.js").EbayApiAuditLog[]>;
    syncPolicies(id: string, organizationId: string | undefined, user: User): Promise<{
        ok: boolean;
        synced: number;
        message: string;
    }>;
}
