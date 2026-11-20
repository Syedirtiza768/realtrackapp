import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
import type { EbayOrderSyncJobPayload } from './ebay-sync.service.js';
export interface OrderNotificationStatus {
    ebayAccountId: string;
    ebayUsername: string | null;
    expectedUrl: string | null;
    applicationUrl: string | null;
    applicationEnabled: boolean;
    events: Record<string, boolean>;
    subscribed: boolean;
}
export type NotificationOutcome = {
    status: 'ignored';
    reason: string;
    eventName?: string | null;
} | {
    status: 'queued';
    eventName: string;
    ebayAccountIds: string[];
};
export declare class EbayPlatformNotificationsService {
    private readonly config;
    private readonly auth;
    private readonly accountRepo;
    private readonly storeRepo;
    private readonly orderSyncQueue;
    private readonly logger;
    private readonly http;
    constructor(config: ConfigService, auth: EbayAuthService, accountRepo: Repository<ConnectedEbayAccount>, storeRepo: Repository<Store>, orderSyncQueue: Queue<EbayOrderSyncJobPayload>);
    private notificationKeys;
    handleNotification(rawXml: string): Promise<NotificationOutcome>;
    resolveAccountsForSeller(sellerUserId: string): Promise<ConnectedEbayAccount[]>;
    private queueOrderImport;
    private expectedUrl;
    private loadAccount;
    private postTrading;
    private getPreferences;
    getStatus(ebayAccountId: string, organizationId: string): Promise<OrderNotificationStatus>;
    private readStatus;
    subscribe(ebayAccountId: string, organizationId: string, options: {
        replaceApplicationUrl?: boolean;
        actorUserId?: string | null;
    }): Promise<OrderNotificationStatus>;
    private recordSellerLogin;
    unsubscribe(ebayAccountId: string, organizationId: string, options?: {
        actorUserId?: string | null;
    }): Promise<OrderNotificationStatus>;
}
