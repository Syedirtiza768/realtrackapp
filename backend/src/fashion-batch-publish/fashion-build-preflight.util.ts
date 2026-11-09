import type { ComplianceIssue } from './fashion-compliance.rules.js';

/**
 * Publish-readiness checks come from the listing builder, which is the same
 * code the live publish runs. Its blocking errors are plain sentences; map the
 * known ones to stable codes so the batch report can count them.
 */
const BUILD_CODES: Array<[RegExp, string]> = [
  [/measurements are in cm or inches/i, 'MEASUREMENT_UNITS'],
  [/category-supported eBay condition/i, 'CONDITION_MISSING'],
  [/Missing fulfillment, payment, or return policy IDs/i, 'POLICY_MISSING'],
  [/return policy with at least 30 days/i, 'RETURN_POLICY'],
  [/merchant location/i, 'MERCHANT_LOCATION'],
  [/image URL/i, 'IMAGE_REQUIRED'],
];

export function buildIssueFromError(message: string): ComplianceIssue {
  const code = BUILD_CODES.find(([pattern]) => pattern.test(message))?.[1] ?? 'LISTING_BUILD';
  return { code, severity: 'review', message };
}
