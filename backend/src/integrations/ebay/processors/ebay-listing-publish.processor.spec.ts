import {
  extractExistingEbayListingId,
  isTransientPublishFailure,
} from './ebay-listing-publish.processor.js';

describe('isTransientPublishFailure', () => {
  it.each([
    'Input error. Seller Inventory Service can not publish the data. Availability not found. Please try again or contact customer support.',
    "Cannot revise listing. We're having trouble updating your listing right now. Please try again later.",
    'Input error. Seller Inventory Service can not publish the data. Product not found.',
  ])('retries eBay propagation failure: %s', (message) => {
    expect(isTransientPublishFailure(message)).toBe(true);
  });

  it('does not retry deterministic validation failures', () => {
    expect(isTransientPublishFailure('Invalid category ID')).toBe(false);
    expect(
      isTransientPublishFailure(
        'ReviseItem failed (21919474): Inventory-based listing management is not currently supported by this tool.',
      ),
    ).toBe(false);
    expect(
      isTransientPublishFailure(
        'Only approved sellers may list this airbag item; do not relist it.',
      ),
    ).toBe(false);
    expect(
      isTransientPublishFailure(
        'The item is mis-categorized. Select a different category.',
      ),
    ).toBe(false);
  });

  it('retries network and eBay service failures', () => {
    expect(
      isTransientPublishFailure('status code 503: service unavailable'),
    ).toBe(true);
    expect(isTransientPublishFailure('upstream connect error')).toBe(true);
  });
});

describe('extractExistingEbayListingId', () => {
  it('extracts an item ID only from an explicit duplicate-listing response', () => {
    expect(
      extractExistingEbayListingId(
        'It looks like this listing is for an item you already have on eBay (307118517987).',
      ),
    ).toBe('307118517987');
  });

  it('does not treat unrelated numeric errors as existing listings', () => {
    expect(
      extractExistingEbayListingId('Invalid category ID 33707'),
    ).toBeNull();
  });
});
