"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_OUTPUT_MARKETPLACE_CODES = exports.PIPELINE_MARKETPLACE_CODES = void 0;
exports.pipelineMarketplaceToEbayId = pipelineMarketplaceToEbayId;
exports.isPipelineMarketplaceCode = isPipelineMarketplaceCode;
exports.storeMatchesPipelineMarketplace = storeMatchesPipelineMarketplace;
exports.ebayMarketplaceIdToPipelineCode = ebayMarketplaceIdToPipelineCode;
exports.shouldApplyJobProfilesToOutput = shouldApplyJobProfilesToOutput;
exports.allPipelineOutputMarketplaces = allPipelineOutputMarketplaces;
exports.resolveJobOutputMarketplaces = resolveJobOutputMarketplaces;
exports.shouldApplyJobProfilesToCatalogMaster = shouldApplyJobProfilesToCatalogMaster;
exports.PIPELINE_MARKETPLACE_CODES = ['US', 'UK', 'AU', 'DE'];
exports.PIPELINE_OUTPUT_MARKETPLACE_CODES = [
    'US',
    'UK',
    'AU',
    'DE',
];
const EBAY_ID_TO_PIPELINE = {
    EBAY_US: 'US',
    EBAY_MOTORS_US: 'US',
    EBAY_MOTORS: 'US',
    EBAY_GB: 'UK',
    EBAY_AU: 'AU',
    EBAY_DE: 'DE',
};
function pipelineMarketplaceToEbayId(code) {
    switch (code) {
        case 'US':
            return 'EBAY_MOTORS_US';
        case 'UK':
            return 'EBAY_GB';
        case 'AU':
            return 'EBAY_AU';
        case 'DE':
            return 'EBAY_DE';
        default:
            return 'EBAY_MOTORS_US';
    }
}
function isPipelineMarketplaceCode(value) {
    return exports.PIPELINE_MARKETPLACE_CODES.includes(value);
}
function storeMatchesPipelineMarketplace(ebayMarketplaceId, code) {
    if (!ebayMarketplaceId)
        return false;
    const normalized = ebayMarketplaceId.toUpperCase();
    if (code === 'US') {
        return (normalized === 'EBAY_US' ||
            normalized === 'EBAY_MOTORS_US' ||
            normalized === 'EBAY_MOTORS');
    }
    return normalized === pipelineMarketplaceToEbayId(code);
}
function ebayMarketplaceIdToPipelineCode(ebayMarketplaceId) {
    if (!ebayMarketplaceId)
        return null;
    const upper = ebayMarketplaceId.toUpperCase();
    if (EBAY_ID_TO_PIPELINE[upper])
        return EBAY_ID_TO_PIPELINE[upper];
    if (upper.startsWith('EBAY_')) {
        const suffix = upper.replace('EBAY_', '');
        if (suffix === 'MOTORS_US' || suffix === 'MOTORS')
            return 'US';
        if (suffix === 'GB')
            return 'UK';
        if (isPipelineMarketplaceCode(suffix))
            return suffix;
    }
    return null;
}
function shouldApplyJobProfilesToOutput(outputMarketplace, jobMarketplace) {
    if (!jobMarketplace)
        return false;
    return outputMarketplace === jobMarketplace;
}
function allPipelineOutputMarketplaces() {
    return [...exports.PIPELINE_OUTPUT_MARKETPLACE_CODES];
}
function resolveJobOutputMarketplaces(jobMarketplace) {
    if (jobMarketplace)
        return [jobMarketplace];
    return allPipelineOutputMarketplaces();
}
function shouldApplyJobProfilesToCatalogMaster(jobMarketplace, catalogSourceMarketplace) {
    if (!jobMarketplace)
        return catalogSourceMarketplace === 'US';
    return jobMarketplace === catalogSourceMarketplace;
}
//# sourceMappingURL=pipeline-marketplaces.js.map