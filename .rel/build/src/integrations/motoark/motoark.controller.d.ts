import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../../auth/entities/user.entity.js';
import { EbayIntegrationPermissionsService } from '../ebay/services/ebay-integration-permissions.service.js';
import { MotoarkOrderEventDto } from './motoark.dto.js';
import { MotoarkService } from './motoark.service.js';
export declare class MotoarkController {
    private readonly service;
    private readonly permissions;
    constructor(service: MotoarkService, permissions: EbayIntegrationPermissionsService);
    accept(dto: MotoarkOrderEventDto, user: User, organizationId: string | undefined, timestamp: string | undefined, signature: string | undefined, request: RawBodyRequest<Request>): Promise<{
        eventId: string;
        status: import("./motoark.types.js").MotoarkInboxRow["status"];
        attempts: number;
        lastError: string | null;
        result: Record<string, unknown> | null;
        receivedAt: Date;
        appliedAt: Date | null;
        duplicate: boolean;
    }>;
    get(eventId: string, user: User, organizationId?: string): Promise<import("./motoark.types.js").MotoarkEventResult>;
    quantity(listingId: string, user: User, organizationId?: string): Promise<{
        mapped: boolean;
        quantityAvailable: null;
        mappingError: string;
        listingId: string;
        marketplaceQuantity: number;
        listingRevision: string;
        inventoryItemId: string | null;
        mappingCount: number | null;
        desiredQuantity: number | null;
        channelSyncStatus: string | null;
        channelSyncError: string | null;
        onHand: number;
        reserved: number;
        stockRevision: string;
    } | {
        mapped: boolean;
        quantityAvailable: number;
        warehouseAvailable: number;
        sourceable: number;
        channelSyncStatus: string;
        storeChannelPushEnabled: boolean;
        globalChannelPushEnabled: boolean;
        channelPushEnabled: boolean;
        listingId: string;
        marketplaceQuantity: number;
        listingRevision: string;
        inventoryItemId: string | null;
        mappingCount: number | null;
        desiredQuantity: number | null;
        channelSyncError: string | null;
        onHand: number;
        reserved: number;
        stockRevision: string;
    }>;
}
