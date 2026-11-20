"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIssueFromError = buildIssueFromError;
exports.preflightIssuesFromErrors = preflightIssuesFromErrors;
const BUILD_CODES = [
    [/measurements are in cm or inches/i, 'MEASUREMENT_UNITS'],
    [/category-supported eBay condition/i, 'CONDITION_MISSING'],
    [/Missing fulfillment, payment, or return policy IDs/i, 'POLICY_MISSING'],
    [/return policy with at least 30 days/i, 'RETURN_POLICY'],
    [/merchant location/i, 'MERCHANT_LOCATION'],
    [/image URL/i, 'IMAGE_REQUIRED'],
];
const APPROVAL_GATE = /authenticity\/compliance review must be approved/i;
function buildIssueFromError(message) {
    const code = BUILD_CODES.find(([pattern]) => pattern.test(message))?.[1] ?? 'LISTING_BUILD';
    return { code, severity: 'review', message };
}
function preflightIssuesFromErrors(messages) {
    return messages.filter((message) => !APPROVAL_GATE.test(message)).map(buildIssueFromError);
}
//# sourceMappingURL=fashion-build-preflight.util.js.map