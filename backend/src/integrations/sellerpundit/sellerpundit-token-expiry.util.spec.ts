import {
  computeSellerpunditAccessTokenExpiry,
  sellerpunditTokenNeedsRefresh,
  SELLERPUNDIT_MAX_TOKEN_AGE_MS,
} from './sellerpundit-token-expiry.util.js';

describe('sellerpundit token expiry', () => {
  const now = new Date('2026-06-05T12:00:00.000Z').getTime();

  it('uses lastTokenRefreshDate + expiresIn when still valid', () => {
    const expiry = computeSellerpunditAccessTokenExpiry(
      {
        expiresIn: 300,
        lastTokenRefreshDate: '2026-06-05T11:58:00.000Z',
      },
      now,
    );
    expect(expiry.toISOString()).toBe('2026-06-05T12:03:00.000Z');
  });

  it('shortens TTL when SellerPundit metadata is already expired', () => {
    const expiry = computeSellerpunditAccessTokenExpiry(
      {
        expiresIn: 300,
        lastTokenRefreshDate: '2026-06-03T15:20:29.557Z',
      },
      now,
    );
    expect(expiry.getTime()).toBeGreaterThan(now);
    expect(expiry.getTime() - now).toBeLessThanOrEqual(120 * 1000);
  });

  it('refreshes when token age exceeds max age', () => {
    const needs = sellerpunditTokenNeedsRefresh(
      {
        accessTokenExpiresAt: new Date(now + 10 * 60 * 1000),
        lastRefreshedAt: new Date(now - SELLERPUNDIT_MAX_TOKEN_AGE_MS - 1000),
      },
      undefined,
      now,
    );
    expect(needs).toBe(true);
  });

  it('forces refresh when force option is set', () => {
    const needs = sellerpunditTokenNeedsRefresh(
      {
        accessTokenExpiresAt: new Date(now + 10 * 60 * 1000),
        lastRefreshedAt: new Date(now),
      },
      { force: true },
      now,
    );
    expect(needs).toBe(true);
  });
});
