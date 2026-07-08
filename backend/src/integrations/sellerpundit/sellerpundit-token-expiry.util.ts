import type { SellerpunditTokenRow } from './sellerpundit.types.js';

/** SellerPundit eBay user tokens are short-lived (~5 min). Refresh before this age. */
export const SELLERPUNDIT_MAX_TOKEN_AGE_MS = 2 * 60 * 1000;

/** Refresh when less than this remains on the cached expiry timestamp. */
export const SELLERPUNDIT_REFRESH_BUFFER_MS = 3 * 60 * 1000;

export function computeSellerpunditAccessTokenExpiry(
  row: Pick<SellerpunditTokenRow, 'expiresIn' | 'lastTokenRefreshDate'>,
  nowMs = Date.now(),
): Date {
  const expiresInSec = Math.max(60, row.expiresIn ?? 300);

  if (row.lastTokenRefreshDate) {
    const refreshedAt = new Date(row.lastTokenRefreshDate).getTime();
    if (!Number.isNaN(refreshedAt)) {
      const fromRefresh = refreshedAt + expiresInSec * 1000;
      if (fromRefresh > nowMs) {
        return new Date(fromRefresh);
      }
      // SP metadata says expired — keep a short local TTL so the next read re-fetches.
      return new Date(nowMs + Math.min(expiresInSec, 120) * 1000);
    }
  }

  return new Date(nowMs + expiresInSec * 1000);
}

export function sellerpunditTokenNeedsRefresh(
  row: {
    accessTokenExpiresAt: Date | string;
    lastRefreshedAt?: Date | string | null;
  },
  options?: { force?: boolean },
  nowMs = Date.now(),
): boolean {
  if (options?.force === true) return true;

  const expires = new Date(row.accessTokenExpiresAt).getTime();
  if (Number.isNaN(expires)) return true;

  const expiresSoon = expires - nowMs <= SELLERPUNDIT_REFRESH_BUFFER_MS;
  if (expiresSoon) return true;

  if (row.lastRefreshedAt) {
    const lastRefresh = new Date(row.lastRefreshedAt).getTime();
    if (
      !Number.isNaN(lastRefresh) &&
      nowMs - lastRefresh >= SELLERPUNDIT_MAX_TOKEN_AGE_MS
    ) {
      return true;
    }
  }

  return false;
}
