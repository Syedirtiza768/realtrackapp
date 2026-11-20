import type { SellerpunditTokenRow } from './sellerpundit.types.js';
export declare const SELLERPUNDIT_MAX_TOKEN_AGE_MS: number;
export declare const SELLERPUNDIT_REFRESH_BUFFER_MS: number;
export declare function computeSellerpunditAccessTokenExpiry(row: Pick<SellerpunditTokenRow, 'expiresIn' | 'lastTokenRefreshDate'>, nowMs?: number): Date;
export declare function sellerpunditTokenNeedsRefresh(row: {
    accessTokenExpiresAt: Date | string;
    lastRefreshedAt?: Date | string | null;
}, options?: {
    force?: boolean;
}, nowMs?: number): boolean;
