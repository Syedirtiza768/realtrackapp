import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from './entities/notification.entity.js';
import type { NotificationsQueryDto } from './dto/notifications-query.dto.js';
export interface CreateNotificationPayload {
    recipientId?: string;
    type: string;
    title: string;
    body?: string;
    icon?: string;
    severity?: 'info' | 'success' | 'warning' | 'error';
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
}
export declare class NotificationsService {
    private readonly notifRepo;
    private readonly eventEmitter;
    private readonly logger;
    constructor(notifRepo: Repository<Notification>, eventEmitter: EventEmitter2);
    create(payload: CreateNotificationPayload): Promise<Notification>;
    findAll(dto: NotificationsQueryDto): Promise<{
        items: Notification[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getUnreadCount(recipientId?: string): Promise<number>;
    markAsRead(id: string): Promise<Notification>;
    markAllAsRead(recipientId?: string): Promise<number>;
    dismiss(id: string): Promise<void>;
    cleanupOld(daysToKeep?: number): Promise<number>;
}
