"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fashionSkuStem = fashionSkuStem;
exports.keyFromServeUrl = keyFromServeUrl;
exports.isOrganizationFashionKey = isOrganizationFashionKey;
function fashionSkuStem(sku) {
    return (sku ?? '')
        .trim()
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}
function keyFromServeUrl(url) {
    try {
        const parsed = new URL(url, 'http://localhost');
        const marker = '/api/storage/serve/';
        const index = parsed.pathname.indexOf(marker);
        if (index < 0)
            return null;
        return decodeURIComponent(parsed.pathname.slice(index + marker.length));
    }
    catch {
        return null;
    }
}
function isOrganizationFashionKey(key, organizationId) {
    return (key.includes(`fashion/intake/${organizationId}/`) ||
        key.includes(`fashion/size-charts/${organizationId}/`));
}
//# sourceMappingURL=fashion-storage-keys.util.js.map