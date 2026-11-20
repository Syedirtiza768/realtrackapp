"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCatalogUpc = normalizeCatalogUpc;
const UPC_PLACEHOLDERS = new Set([
    '',
    '-',
    'n/a',
    'na',
    'none',
    'null',
    'does not apply',
]);
function normalizeCatalogUpc(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (UPC_PLACEHOLDERS.has(trimmed.toLowerCase()))
        return null;
    return trimmed;
}
//# sourceMappingURL=catalog-identifiers.js.map