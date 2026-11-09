import { buildIssueFromError } from './fashion-build-preflight.util.js';

describe('buildIssueFromError', () => {
  it.each([
    [
      'Confirm whether the imported source measurements are in cm or inches before publishing',
      'MEASUREMENT_UNITS',
    ],
    [
      'A category-supported eBay condition is required; no condition was inferred',
      'CONDITION_MISSING',
    ],
    [
      'Missing fulfillment, payment, or return policy IDs — sync policies and map defaults.',
      'POLICY_MISSING',
    ],
    [
      'New and New Other Parts & Accessories listings require a return policy with at least 30 days and seller-paid return shipping (eBay June 2025 P&A rule). Update a return business policy in eBay Seller Hub if needed, re-sync policies in Settings → eBay Integrations, then publish again.',
      'RETURN_POLICY',
    ],
    [
      'At least one valid image URL (http/https) is required — add images to the catalog listing or linked image assets',
      'IMAGE_REQUIRED',
    ],
    ['Something the builder reports in a new way', 'LISTING_BUILD'],
  ])('maps "%s" to %s', (message, code) => {
    const issue = buildIssueFromError(message);
    expect(issue.code).toBe(code);
    expect(issue.severity).toBe('review');
    expect(issue.message).toBe(message);
  });
});
