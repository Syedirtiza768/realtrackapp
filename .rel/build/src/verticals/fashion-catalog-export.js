"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fashionCatalogExportAttributes = fashionCatalogExportAttributes;
exports.customAspectPairs = customAspectPairs;
const fashion_config_js_1 = require("./fashion.config.js");
const SOURCE_FORMAT = 'artisticserver-fashion-export';
const DIRECT_FASHION_KEYS = [
    'department',
    'itemType',
    'productType',
    'categoryFamily',
    'size',
    'sizeSystem',
    'sizeType',
    'color',
    'secondaryColor',
    'pattern',
    'style',
    'material',
    'composition',
    'fabricType',
    'sleeveLength',
    'neckline',
    'closure',
    'length',
    'fit',
    'features',
    'countryOfManufacture',
    'season',
    'occasion',
    'theme',
    'vintage',
    'garmentCare',
];
function stringArray(value) {
    if (Array.isArray(value))
        return value.map((item) => item.trim()).filter(Boolean);
    if (typeof value === 'string' && value.trim())
        return [value.trim()];
    return [];
}
function normalizeAspectName(value) {
    return value
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
function parseSpecificPairs(raw) {
    const text = raw.trim();
    if (!text)
        return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.flatMap((entry) => {
                if (!entry || typeof entry !== 'object')
                    return [];
                const record = entry;
                const name = String(record.name ?? record.Name ?? '').trim();
                const value = String(record.value ?? record.Value ?? '').trim();
                return name && value ? [[name, value]] : [];
            });
        }
        if (parsed && typeof parsed === 'object') {
            return Object.entries(parsed)
                .map(([name, value]) => [name.trim(), String(value ?? '').trim()])
                .filter(([name, value]) => name && value);
        }
    }
    catch {
    }
    return text
        .split(/;(?=\s*[^;:\r\n]+\s*:)|\r?\n(?=\s*[^;:\r\n]+\s*:)/)
        .flatMap((part) => {
        const colon = part.indexOf(':');
        return colon > 0
            ? [[part.slice(0, colon).trim(), part.slice(colon + 1).trim()]]
            : [];
    })
        .filter(([name, value]) => Boolean(name && value));
}
function measurementNotes(raw) {
    const text = raw.trim();
    if (!text)
        return '';
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            const notes = parsed.flatMap((entry) => {
                if (!entry || typeof entry !== 'object')
                    return [];
                const record = entry;
                const name = String(record.name ?? record.Name ?? '').trim();
                const label = String(record.label ?? record.Label ?? '').trim();
                const value = String(record.value ?? record.Value ?? '').trim();
                if (!label && !value)
                    return [];
                const labelIsLetter = /^[A-E]$/i.test(label);
                const letter = labelIsLetter
                    ? label.toUpperCase()
                    : /^[A-E]$/i.test(name)
                        ? name.toUpperCase()
                        : '';
                const measurementLabel = labelIsLetter ? name : label || name;
                const prefix = letter ? `${letter}. ` : '';
                return [
                    `${prefix}${measurementLabel || 'Measurement'}: ${value || '(blank)'}`,
                ];
            });
            if (notes.length)
                return notes.join('\n');
        }
    }
    catch {
    }
    return text;
}
function inferredFamily(data) {
    const text = `${data.categoryName ?? ''} ${data.title ?? ''}`.toLowerCase();
    if (/\b(shoes?|boots?|sneakers?|sandals?|loafers?|heels?)\b/.test(text))
        return 'footwear';
    if (/\b(bags?|handbags?|belts?|wallets?|hats?|caps?|scarves?|ties?)\b/.test(text))
        return 'accessories';
    return 'clothing';
}
function fashionCatalogExportAttributes(data, base = {}) {
    const attributes = {
        ...base,
        categoryFamily: base.categoryFamily ?? inferredFamily(data),
    };
    for (const key of DIRECT_FASHION_KEYS) {
        const value = data[key]?.trim();
        if (value && !attributes[key])
            attributes[key] = value;
    }
    const customNames = stringArray(attributes.customAspectNames);
    const customValues = stringArray(attributes.customAspectValues);
    for (const [name, value] of parseSpecificPairs(data.itemSpecifics ?? '')) {
        const key = (0, fashion_config_js_1.fashionAttributeKeyForAspect)(name);
        if (key) {
            const mappedValue = key === 'features' || key === 'season'
                ? value.split(/\s*[,|]\s*/).filter(Boolean)
                : value;
            if (!attributes[key] || !String(attributes[key]).trim())
                attributes[key] = mappedValue;
            continue;
        }
        const normalized = normalizeAspectName(name);
        const index = customNames.findIndex((candidate) => normalizeAspectName(candidate) === normalized);
        if (index >= 0) {
            if (!customValues[index])
                customValues[index] = value;
            continue;
        }
        customNames.push(name);
        customValues.push(value);
    }
    if (data.brand && !attributes.brand)
        attributes.brand = data.brand;
    if (customNames.length || customValues.length) {
        attributes.customAspectNames = customNames;
        attributes.customAspectValues = customValues;
    }
    const rawMeasurements = (data.measurements ?? '').trim();
    const notes = measurementNotes(rawMeasurements);
    if (notes)
        attributes.measurements = notes;
    if (rawMeasurements) {
        attributes._sourceMeasurements = rawMeasurements;
        attributes._measurementUnitReviewRequired = !String(attributes.measurementsUnit ?? data.measurementsUnit ?? '').trim();
    }
    const isSourceExport = Boolean(data.sourceMarketplaceItemId?.trim() &&
        data.sourceMarketplaceId?.trim() &&
        data.sourceChannelId?.trim() &&
        data.sourceAccountName?.trim());
    if (isSourceExport) {
        const sourceImageUrls = (data.imageUrls ?? '')
            .split('|')
            .map((url) => url.trim())
            .filter((url, index, all) => /^https?:\/\//i.test(url) && all.indexOf(url) === index);
        attributes._sourceFormat = SOURCE_FORMAT;
        attributes._sourceItemSpecifics = data.itemSpecifics ?? '';
        attributes._sourceImageUrls = sourceImageUrls;
        attributes._imageMirrorExpected = String(sourceImageUrls.length);
        attributes._imageMirrorStored = '0';
        attributes._imageMirrorFailed = String(sourceImageUrls.length);
        attributes._imageMirrorStatus = sourceImageUrls.length
            ? 'pending'
            : 'failed';
        attributes._sourceChannelStatus = data.sourceChannelStatus ?? '';
        attributes._sourceChannelId = data.sourceChannelId ?? '';
        attributes._sourceMarketplaceId = data.sourceMarketplaceId ?? '';
        attributes._sourceMarketplaceName = data.sourceMarketplaceName ?? '';
        attributes._sourceMarketplaceSiteId = data.sourceMarketplaceSiteId ?? '';
        attributes._sourceMarketplaceItemId = data.sourceMarketplaceItemId ?? '';
        attributes._sourceAccountName = data.sourceAccountName ?? '';
        attributes._sourcePriceCurrency = data.sourcePriceCurrency ?? '';
        attributes._sourceCondition = data.sourceCondition ?? '';
        attributes._sourceListingUrl = data.sourceListingUrl ?? '';
    }
    return attributes;
}
function customAspectPairs(attributes) {
    const names = stringArray(attributes.customAspectNames);
    const values = stringArray(attributes.customAspectValues);
    return names
        .map((name, index) => [name.trim(), values[index]?.trim() ?? ''])
        .filter(([name, value]) => Boolean(name && value));
}
//# sourceMappingURL=fashion-catalog-export.js.map