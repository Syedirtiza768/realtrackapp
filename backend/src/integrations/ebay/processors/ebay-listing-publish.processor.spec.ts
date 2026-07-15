import { isTransientPublishFailure } from './ebay-listing-publish.processor.js';

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
  });
});
