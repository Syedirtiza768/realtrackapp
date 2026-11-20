export declare const ORDER_NOTIFICATION_EVENTS: readonly ["FixedPriceTransaction", "AuctionCheckoutComplete", "ItemSold"];
export type OrderNotificationEvent = (typeof ORDER_NOTIFICATION_EVENTS)[number];
export declare const NOTIFICATION_MAX_AGE_MS: number;
export declare function isOrderNotificationEvent(eventName: string | null | undefined): eventName is OrderNotificationEvent;
export interface ParsedPlatformNotification {
    eventName: string | null;
    timestamp: string | null;
    signature: string | null;
    recipientUserId: string | null;
    sellerUserId: string | null;
    itemId: string | null;
}
export declare function firstTagText(xml: string, tag: string): string | null;
export declare function parsePlatformNotification(xml: string): ParsedPlatformNotification | null;
export interface NotificationKeys {
    devId: string;
    appId: string;
    certId: string;
}
export declare function computeNotificationSignature(timestamp: string, keys: NotificationKeys): string;
export type SignatureCheck = {
    ok: true;
} | {
    ok: false;
    reason: 'missing' | 'mismatch' | 'bad_timestamp' | 'stale';
};
export declare function verifyNotificationSignature(input: {
    signature: string | null | undefined;
    timestamp: string | null | undefined;
    keys: NotificationKeys;
    now?: Date;
    maxAgeMs?: number;
}): SignatureCheck;
export declare function buildSetNotificationPreferencesRequest(input: {
    enable: boolean;
    applicationUrl?: string | null;
}): string;
export declare function buildGetNotificationPreferencesRequest(level: 'Application' | 'User'): string;
export interface ApplicationNotificationPreferences {
    applicationUrl: string | null;
    applicationEnabled: boolean;
}
export declare function parseApplicationPreferences(xml: string): ApplicationNotificationPreferences;
export declare function parseUserEventPreferences(xml: string): Record<string, boolean>;
export declare function buildGetUserRequest(): string;
export declare function parseGetUserLogin(xml: string): string | null;
export declare function isNoPreferencesError(err: unknown): boolean;
export declare function tradingFailure(xml: string): string | null;
