"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PUBLISHED_LISTINGS_STORE_SLUGS = exports.EBAY_STORE_SLUG_ALIASES = void 0;
exports.resolveDefaultPublishedListingsStoreSlugs = resolveDefaultPublishedListingsStoreSlugs;
exports.normalizeStoreSlug = normalizeStoreSlug;
exports.parseStoreSlugQuery = parseStoreSlugQuery;
exports.isAllStoresSlugQuery = isAllStoresSlugQuery;
exports.EBAY_STORE_SLUG_ALIASES = {
    salvagea: ['3b84b063-3811-481f-a61d-f7846a03558f'],
    salvage: ['3b84b063-3811-481f-a61d-f7846a03558f'],
    blacklineusedautoparts: ['d16199c4-55b5-429e-ad27-892bed94e00d'],
    blackline: ['d16199c4-55b5-429e-ad27-892bed94e00d'],
};
exports.DEFAULT_PUBLISHED_LISTINGS_STORE_SLUGS = 'salvagea,blackline';
function resolveDefaultPublishedListingsStoreSlugs() {
    const fromEnv = process.env.PUBLISHED_LISTINGS_DEFAULT_STORE_SLUGS?.trim();
    if (fromEnv === '' || fromEnv === 'all' || fromEnv === '*')
        return '';
    return fromEnv || exports.DEFAULT_PUBLISHED_LISTINGS_STORE_SLUGS;
}
function normalizeStoreSlug(raw) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\/(www\.)?ebay\.com\/str\//i, '')
        .replace(/\/+$/, '')
        .replace(/[^a-z0-9_-]/g, '');
}
function parseStoreSlugQuery(raw) {
    if (!raw?.trim())
        return [];
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'all' || normalized === '*')
        return [];
    return [
        ...new Set(raw
            .split(',')
            .map((s) => normalizeStoreSlug(s))
            .filter(Boolean)),
    ];
}
function isAllStoresSlugQuery(raw) {
    const normalized = raw?.trim().toLowerCase();
    return normalized === 'all' || normalized === '*';
}
//# sourceMappingURL=store-slug.util.js.map