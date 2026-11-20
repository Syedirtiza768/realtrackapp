"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKETPLACE_CATEGORY_TREE_IDS = void 0;
exports.resolveCategoryTreeId = resolveCategoryTreeId;
exports.MARKETPLACE_CATEGORY_TREE_IDS = {
    EBAY_US: '0',
    EBAY_MOTORS_US: '100',
    EBAY_GB: '3',
    EBAY_DE: '77',
    EBAY_AU: '15',
};
const SHORT_CODE_TO_EBAY = {
    US: 'EBAY_US',
    UK: 'EBAY_GB',
    AU: 'EBAY_AU',
    DE: 'EBAY_DE',
    GB: 'EBAY_GB',
};
function resolveCategoryTreeId(marketplace) {
    if (!marketplace)
        return '0';
    const ebayMkt = marketplace.includes('EBAY_')
        ? marketplace
        : (SHORT_CODE_TO_EBAY[marketplace] ?? 'EBAY_US');
    return exports.MARKETPLACE_CATEGORY_TREE_IDS[ebayMkt] ?? '0';
}
//# sourceMappingURL=ebay-marketplace-tree.util.js.map