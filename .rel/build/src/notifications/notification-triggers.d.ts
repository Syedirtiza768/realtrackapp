import { NotificationsService } from './notifications.service.js';
export declare class NotificationTriggers {
    private readonly notifService;
    private readonly logger;
    constructor(notifService: NotificationsService);
    onIngestionComplete(data: {
        jobId: string;
        title?: string;
    }): Promise<void>;
    onIngestionFailed(data: {
        jobId: string;
        error?: string;
    }): Promise<void>;
    onReviewNeeded(data: {
        jobId: string;
        confidence?: number;
    }): Promise<void>;
    onChannelConnected(data: {
        channel: string;
        connectionId: string;
    }): Promise<void>;
    onChannelError(data: {
        channel: string;
        connectionId: string;
        error?: string;
    }): Promise<void>;
    onListingPublished(data: {
        listingId: string;
        channel: string;
        title?: string;
    }): Promise<void>;
    onLowStock(data: {
        listingId: string;
        title?: string;
        available: number;
        threshold: number;
    }): Promise<void>;
    onOutOfStock(data: {
        listingId: string;
        title?: string;
    }): Promise<void>;
    onNewOrder(data: {
        orderId: string;
        channel: string;
        total?: string;
    }): Promise<void>;
    onOrderShipped(data: {
        orderId: string;
        trackingNumber?: string;
    }): Promise<void>;
    onSystemAlert(data: {
        title: string;
        body?: string;
        severity?: 'info' | 'warning' | 'error';
    }): Promise<void>;
}
