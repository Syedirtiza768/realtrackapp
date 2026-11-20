"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMvlMarketplaceFromTreeId = resolveMvlMarketplaceFromTreeId;
exports.resolveMvlMarketplace = resolveMvlMarketplace;
exports.mvlMarketplaceToTreeId = mvlMarketplaceToTreeId;
const ebay_marketplace_tree_util_js_1 = require("../channels/ebay/ebay-marketplace-tree.util.js");
const TREE_ID_TO_MARKETPLACE = {
    '0': 'US',
    '15': 'AU',
    '77': 'DE',
    '3': 'GB',
};
const SHORT_CODE_TO_MVL = {
    US: 'US',
    AU: 'AU',
    DE: 'DE',
    GB: 'GB',
    UK: 'GB',
};
const EBAY_ID_TO_MVL = {
    EBAY_US: 'US',
    EBAY_MOTORS_US: 'US',
    EBAY_AU: 'AU',
    EBAY_DE: 'DE',
    EBAY_GB: 'GB',
};
function resolveMvlMarketplaceFromTreeId(treeId) {
    if (!treeId)
        return 'US';
    return TREE_ID_TO_MARKETPLACE[treeId] ?? 'US';
}
function resolveMvlMarketplace(marketplace) {
    if (!marketplace)
        return 'US';
    const upper = marketplace.toUpperCase();
    if (SHORT_CODE_TO_MVL[upper])
        return SHORT_CODE_TO_MVL[upper];
    if (EBAY_ID_TO_MVL[upper])
        return EBAY_ID_TO_MVL[upper];
    if (upper.includes('EBAY_')) {
        const suffix = upper.replace('EBAY_', '');
        if (suffix === 'MOTORS_US')
            return 'US';
        if (SHORT_CODE_TO_MVL[suffix])
            return SHORT_CODE_TO_MVL[suffix];
    }
    return 'US';
}
function mvlMarketplaceToTreeId(marketplace) {
    const ebayId = marketplace === 'US'
        ? 'EBAY_US'
        : marketplace === 'GB'
            ? 'EBAY_GB'
            : `EBAY_${marketplace}`;
    return ebay_marketplace_tree_util_js_1.MARKETPLACE_CATEGORY_TREE_IDS[ebayId] ?? '0';
}
//# sourceMappingURL=ebay-mvl-marketplace.util.js.map