"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EBAY_ASPECT_VALUE_MAX_LENGTH = void 0;
exports.truncateEbayAspectValue = truncateEbayAspectValue;
exports.sanitizeListingAspects = sanitizeListingAspects;
exports.localizeAspectName = localizeAspectName;
exports.localizeAspectsForMarketplace = localizeAspectsForMarketplace;
exports.buildListingAspects = buildListingAspects;
exports.isUsedEbayCondition = isUsedEbayCondition;
exports.EBAY_ASPECT_VALUE_MAX_LENGTH = 65;
const EBAY_DE_ASPECT_NAME_MAP = {
    Brand: 'Hersteller',
    MPN: 'Herstellernummer',
    'Manufacturer Part Number': 'Herstellernummer',
    Type: 'Produktart',
    'Placement on Vehicle': 'Einbauposition',
    'OE/OEM Part Number': 'OE/OEM Referenznummer(n)',
    'Interchange Part Number': 'Vergleichsnummer',
    Material: 'Material',
    Color: 'Farbe',
    Features: 'Besonderheiten',
    Condition: 'Zustand',
    'Country/Region of Manufacture': 'Herstellungsland und -region',
    'Universal Fitment': 'Universelle Kompatibilität',
};
function truncateEbayAspectValue(value, maxLength = exports.EBAY_ASPECT_VALUE_MAX_LENGTH) {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed)
        return '';
    if (trimmed.length <= maxLength)
        return trimmed;
    const cut = trimmed.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.6)
        return cut.slice(0, lastSpace).trim();
    return cut.trim();
}
function sanitizeListingAspects(aspects) {
    const out = {};
    for (const [name, values] of Object.entries(aspects)) {
        const cleaned = (values ?? [])
            .map((v) => truncateEbayAspectValue(String(v ?? '')))
            .filter(Boolean);
        if (cleaned.length)
            out[name] = cleaned;
    }
    return out;
}
function localizeAspectName(name, marketplaceId) {
    if (marketplaceId?.toUpperCase() === 'EBAY_DE') {
        return EBAY_DE_ASPECT_NAME_MAP[name] ?? name;
    }
    return name;
}
function localizeAspectsForMarketplace(aspects, marketplaceId) {
    const sanitized = sanitizeListingAspects(aspects);
    if (marketplaceId?.toUpperCase() !== 'EBAY_DE') {
        return sanitized;
    }
    const out = {};
    for (const [name, values] of Object.entries(sanitized)) {
        out[localizeAspectName(name, marketplaceId)] = values;
    }
    return out;
}
function buildListingAspects(input) {
    const aspects = { ...(input.existing ?? {}) };
    const setAspect = (name, value) => {
        const v = value?.trim();
        if (!v)
            return;
        if (!aspects[name]?.length) {
            aspects[name] = [v];
        }
    };
    setAspect('Brand', input.brand);
    setAspect('MPN', input.mpn);
    setAspect('Type', input.partType);
    setAspect('UPC', input.upc?.trim() || 'Does not apply');
    setAspect('OE/OEM Part Number', input.oeOemPartNumber);
    return sanitizeListingAspects(aspects);
}
function isUsedEbayCondition(condition) {
    if (!condition?.trim())
        return false;
    const c = condition
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    return c.startsWith('USED_') || c === 'FOR_PARTS_OR_NOT_WORKING';
}
//# sourceMappingURL=ebay-listing-aspects.util.js.map