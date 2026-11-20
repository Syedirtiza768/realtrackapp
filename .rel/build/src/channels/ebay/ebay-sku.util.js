"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conflictSafeSkuFor = conflictSafeSkuFor;
const MAX_EBAY_SKU_LENGTH = 50;
function stableSkuHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0');
}
function conflictSafeSkuFor(canonicalSku, variant = 0) {
    const normalized = canonicalSku.trim();
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(normalized))
        return null;
    if (!Number.isInteger(variant) || variant < 0 || variant > 35)
        return null;
    const match = normalized.match(/^BLA-(.+)$/i);
    if (match?.[1] && variant === 0) {
        const candidate = 'BLAP-' + match[1];
        return /^[A-Za-z0-9._-]{1,50}$/.test(candidate) ? candidate : null;
    }
    const hashInput = variant === 0 ? normalized : normalized + ':' + variant;
    const suffix = '-RT' +
        stableSkuHash(hashInput) +
        (variant > 0 ? '-' + variant.toString(36).toUpperCase() : '');
    const prefixLength = MAX_EBAY_SKU_LENGTH - suffix.length;
    if (prefixLength < 1)
        return null;
    return normalized.slice(0, prefixLength) + suffix;
}
//# sourceMappingURL=ebay-sku.util.js.map