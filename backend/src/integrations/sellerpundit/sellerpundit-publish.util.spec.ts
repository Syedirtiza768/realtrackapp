import {
  isSellerpunditBulkCreatePlatformError,
  isSellerpunditGatewayTimeoutError,
  isSellerpunditRecoverableEbayPublishError,
  shouldAttemptSellerpunditBulkCreate,
  shouldFallbackFromSellerpunditBulkCreate,
} from './sellerpundit-publish.util.js';

describe('isSellerpunditGatewayTimeoutError', () => {
  it('detects 504 gateway timeout messages', () => {
    expect(isSellerpunditGatewayTimeoutError('API 504: Gateway Time-out')).toBe(
      true,
    );
  });
});

describe('isSellerpunditBulkCreatePlatformError', () => {
  it('detects tokens.marketplaceId SQL defect', () => {
    expect(
      isSellerpunditBulkCreatePlatformError(
        'column tokens.marketplaceId does not exist',
      ),
    ).toBe(true);
  });

  it('detects errors array entries', () => {
    expect(
      isSellerpunditBulkCreatePlatformError(undefined, [
        'Failed to process file',
      ]),
    ).toBe(true);
  });

  it('returns false for unrelated validation errors', () => {
    expect(
      isSellerpunditBulkCreatePlatformError('Missing business policy IDs'),
    ).toBe(false);
  });
});

describe('shouldAttemptSellerpunditBulkCreate', () => {
  it('skips when direct_ebay mode', () => {
    expect(shouldAttemptSellerpunditBulkCreate('direct_ebay')).toBe(false);
  });

  it('skips when forceDirectEbay is set', () => {
    expect(shouldAttemptSellerpunditBulkCreate('auto', true)).toBe(false);
  });
});

describe('isSellerpunditRecoverableEbayPublishError', () => {
  it('does not treat P&A return policy errors as recoverable via direct eBay', () => {
    expect(
      isSellerpunditRecoverableEbayPublishError(
        'This P&A listing has a non-compliant domestic return policy',
      ),
    ).toBe(false);
  });

  it('still treats other invalid policy errors as recoverable', () => {
    expect(
      isSellerpunditRecoverableEbayPublishError(
        'Invalid fulfillment policy id',
      ),
    ).toBe(true);
  });
});

describe('shouldFallbackFromSellerpunditBulkCreate', () => {
  it('falls back on SellerPundit 504 gateway timeout in auto mode', () => {
    expect(
      shouldFallbackFromSellerpunditBulkCreate('auto', {
        success: false,
        error: 'API 504: Gateway Time-out',
        platformError: true,
      }),
    ).toBe(true);
  });

  it('falls back on platform errors in auto mode', () => {
    expect(
      shouldFallbackFromSellerpunditBulkCreate('auto', {
        success: false,
        platformError: true,
      }),
    ).toBe(true);
  });

  it('does not fall back in sellerpundit-only mode', () => {
    expect(
      shouldFallbackFromSellerpunditBulkCreate('sellerpundit', {
        success: false,
        platformError: true,
      }),
    ).toBe(false);
  });

  it('does not fall back on P&A return policy errors in auto mode', () => {
    expect(
      shouldFallbackFromSellerpunditBulkCreate('auto', {
        success: false,
        error:
          'This P&A listing has a non-compliant domestic return policy. Request failed with status code 400',
      }),
    ).toBe(false);
  });
});
