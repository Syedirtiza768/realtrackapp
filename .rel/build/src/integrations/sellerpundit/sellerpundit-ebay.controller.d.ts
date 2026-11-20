import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayIntegrationPermissionsService } from '../ebay/services/ebay-integration-permissions.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditAccountSyncService } from './sellerpundit-account-sync.service.js';
import { SellerpunditPolicySyncService } from './sellerpundit-policy-sync.service.js';
export declare class SellerpunditEbayController {
    private readonly auth;
    private readonly accounts;
    private readonly policies;
    private readonly permissions;
    private readonly accountRepo;
    constructor(auth: SellerpunditAuthService, accounts: SellerpunditAccountSyncService, policies: SellerpunditPolicySyncService, permissions: EbayIntegrationPermissionsService, accountRepo: Repository<ConnectedEbayAccount>);
    getConfig(organizationId: string | undefined, user: User): Promise<{
        enabled: boolean;
        configured: boolean;
        hasOrgCredentials: boolean;
        lastJwtRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastError: string | null;
    }>;
    putConfig(organizationId: string | undefined, body: {
        email?: string;
        password?: string;
        enabled?: boolean;
    }, user: User): Promise<{
        enabled: boolean;
        configured: boolean;
        hasOrgCredentials: boolean;
        lastJwtRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastError: string | null;
    }>;
    testConnection(organizationId: string | undefined, user: User): Promise<{
        ok: boolean;
        storeCount: number;
    }>;
    syncStores(organizationId: string | undefined, user: User): Promise<{
        imported: number;
        updated: number;
        skipped: number;
        accounts: string[];
    }>;
    syncAllPolicies(organizationId: string | undefined, accountId: string | undefined, user: User): Promise<{
        ok: boolean;
        synced: number;
        message: string;
    } | {
        ok: boolean;
        synced: number;
        accounts: {
            accountId: string;
            synced: number;
            ok: boolean;
        }[];
    }>;
    syncAll(organizationId: string | undefined, user: User): Promise<{
        stores: {
            imported: number;
            updated: number;
            skipped: number;
            accounts: string[];
        };
        policies: {
            ok: boolean;
            synced: number;
            message: string;
        } | {
            ok: boolean;
            synced: number;
            accounts: {
                accountId: string;
                synced: number;
                ok: boolean;
            }[];
        };
    }>;
}
