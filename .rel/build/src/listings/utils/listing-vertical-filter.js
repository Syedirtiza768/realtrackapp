"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LISTING_VERTICALS = void 0;
exports.listingVerticalFilter = listingVerticalFilter;
const common_1 = require("@nestjs/common");
exports.LISTING_VERTICALS = [
    'automotive',
    'fashion',
    'business_industrial',
];
function listingVerticalFilter(vertical, alias = 'r') {
    const value = vertical?.trim();
    if (!value)
        return null;
    if (!exports.LISTING_VERTICALS.includes(value)) {
        throw new common_1.BadRequestException(`Unknown vertical: ${value}`);
    }
    if (value === 'automotive') {
        return {
            sql: `(${alias}.vertical = :listingVertical OR ${alias}.vertical IS NULL)`,
            params: { listingVertical: value },
        };
    }
    return {
        sql: `${alias}.vertical = :listingVertical`,
        params: { listingVertical: value },
    };
}
//# sourceMappingURL=listing-vertical-filter.js.map