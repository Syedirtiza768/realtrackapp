"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELLERPUNDIT_REFRESH_BUFFER_MS = exports.SELLERPUNDIT_MAX_TOKEN_AGE_MS = void 0;
exports.computeSellerpunditAccessTokenExpiry = computeSellerpunditAccessTokenExpiry;
exports.sellerpunditTokenNeedsRefresh = sellerpunditTokenNeedsRefresh;
exports.SELLERPUNDIT_MAX_TOKEN_AGE_MS = 2 * 60 * 1000;
exports.SELLERPUNDIT_REFRESH_BUFFER_MS = 3 * 60 * 1000;
function computeSellerpunditAccessTokenExpiry(row, nowMs = Date.now()) {
    const expiresInSec = Math.max(60, row.expiresIn ?? 300);
    if (row.lastTokenRefreshDate) {
        const refreshedAt = new Date(row.lastTokenRefreshDate).getTime();
        if (!Number.isNaN(refreshedAt)) {
            const fromRefresh = refreshedAt + expiresInSec * 1000;
            if (fromRefresh > nowMs) {
                return new Date(fromRefresh);
            }
            return new Date(nowMs + Math.min(expiresInSec, 120) * 1000);
        }
    }
    return new Date(nowMs + expiresInSec * 1000);
}
function sellerpunditTokenNeedsRefresh(row, options, nowMs = Date.now()) {
    if (options?.force === true)
        return true;
    const expires = new Date(row.accessTokenExpiresAt).getTime();
    if (Number.isNaN(expires))
        return true;
    const expiresSoon = expires - nowMs <= exports.SELLERPUNDIT_REFRESH_BUFFER_MS;
    if (expiresSoon)
        return true;
    if (row.lastRefreshedAt) {
        const lastRefresh = new Date(row.lastRefreshedAt).getTime();
        if (!Number.isNaN(lastRefresh) &&
            nowMs - lastRefresh >= exports.SELLERPUNDIT_MAX_TOKEN_AGE_MS) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=sellerpundit-token-expiry.util.js.map