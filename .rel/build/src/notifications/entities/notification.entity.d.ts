export declare class Notification {
    id: string;
    recipientId: string | null;
    type: string;
    title: string;
    body: string | null;
    icon: string | null;
    severity: 'info' | 'success' | 'warning' | 'error';
    entityType: string | null;
    entityId: string | null;
    actionUrl: string | null;
    read: boolean;
    readAt: Date | null;
    dismissed: boolean;
    createdAt: Date;
}
