import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../../../auth/entities/user.entity.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayPlatformNotificationsService } from '../services/ebay-platform-notifications.service.js';
import { EbayOrderNotificationsSubscribeDto } from '../dto/ebay-order-notifications.dto.js';
export declare class EbayPlatformNotificationsController {
    private readonly notifications;
    private readonly permissions;
    constructor(notifications: EbayPlatformNotificationsService, permissions: EbayIntegrationPermissionsService);
    receive(req: RawBodyRequest<Request>): Promise<import("../services/ebay-platform-notifications.service.js").NotificationOutcome>;
    status(id: string, organizationId: string | undefined, user: User): Promise<import("../services/ebay-platform-notifications.service.js").OrderNotificationStatus>;
    subscribe(id: string, organizationId: string | undefined, dto: EbayOrderNotificationsSubscribeDto, user: User): Promise<import("../services/ebay-platform-notifications.service.js").OrderNotificationStatus>;
    unsubscribe(id: string, organizationId: string | undefined, user: User): Promise<import("../services/ebay-platform-notifications.service.js").OrderNotificationStatus>;
}
