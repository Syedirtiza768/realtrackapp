import { NotificationsService } from './notifications.service.js';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    findAll(dto: NotificationsQueryDto): Promise<{
        items: import("./entities/notification.entity.js").Notification[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getUnreadCount(): Promise<{
        count: number;
    }>;
    markAsRead(id: string): Promise<import("./entities/notification.entity.js").Notification>;
    markAllAsRead(): Promise<{
        marked: number;
    }>;
    dismiss(id: string): Promise<void>;
}
