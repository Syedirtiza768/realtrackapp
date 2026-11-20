"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTSBAZAR_MAX_PAYLOAD_BYTES = void 0;
exports.storedImageUrls = storedImageUrls;
exports.buildPartsBazarPushItem = buildPartsBazarPushItem;
const fitment_mvl_util_js_1 = require("../../fitment/fitment-mvl.util.js");
const ebay_listing_aspects_util_js_1 = require("../ebay/ebay-listing-aspects.util.js");
const ebay_listing_condition_util_js_1 = require("../ebay/ebay-listing-condition.util.js");
const ebay_listing_images_util_js_1 = require("../ebay/ebay-listing-images.util.js");
exports.PARTSBAZAR_MAX_PAYLOAD_BYTES = 90_000;
const MAX_DESCRIPTION_CHARS = 40_000;
const TRIMMED_DESCRIPTION_CHARS = 8_000;
const text = (value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
};
const firstText = (...values) => {
    for (const value of values) {
        const found = text(value);
        if (found)
            return found;
    }
    return null;
};
function priceOf(listing, catalog, override) {
    const candidates = [
        override,
        listing.startPriceNum,
        listing.startPrice,
        catalog?.price,
    ];
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || candidate === '')
            continue;
        const n = typeof candidate === 'number'
            ? candidate
            : Number(String(candidate).replace(/[$,\s]/g, ''));
        if (Number.isFinite(n))
            return n;
    }
    return null;
}
function quantityOf(listing, catalog, override) {
    const candidates = [
        override,
        listing.quantityNum,
        listing.quantity,
        catalog?.quantity,
    ];
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || candidate === '')
            continue;
        const n = typeof candidate === 'number'
            ? candidate
            : parseInt(String(candidate), 10);
        if (Number.isInteger(n) && n >= 0)
            return { quantity: n, defaulted: false };
    }
    return { quantity: 1, defaulted: true };
}
function storedImageUrls(listing, catalog) {
    const fromCatalog = catalog?.imageUrls ?? [];
    return fromCatalog.length > 0
        ? fromCatalog
        : (0, ebay_listing_images_util_js_1.parseImageUrlField)(listing.itemPhotoUrl);
}
function imagesOf(listing, catalog, resolved) {
    if (resolved)
        return (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(resolved).imageUrls;
    const notTemp = (urls) => urls.filter((u) => !/\/temp\//.test(u));
    const fromCatalog = notTemp(catalog?.imageUrls ?? []);
    const fromListing = notTemp((0, ebay_listing_images_util_js_1.parseImageUrlField)(listing.itemPhotoUrl));
    const source = fromCatalog.length > 0 ? fromCatalog : fromListing;
    return (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(source).imageUrls;
}
function oeNumbersOf(listing, catalog) {
    const seen = new Map();
    for (const raw of [listing.cOeOemPartNumber, catalog?.oemPartNumber]) {
        for (const part of (raw ?? '').split(/[,;|\n]+/)) {
            const value = part.trim();
            if (value && !seen.has(value.toLowerCase()))
                seen.set(value.toLowerCase(), value);
        }
    }
    return [...seen.values()];
}
function qualityTierOf(conditionEnum) {
    if (conditionEnum.startsWith('NEW'))
        return 'NEW';
    if (conditionEnum === 'FOR_PARTS_OR_NOT_WORKING')
        return 'FOR_PARTS';
    if (conditionEnum.includes('REFURBISHED'))
        return 'REFURBISHED';
    return 'USED';
}
const humanize = (value) => value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
function specificsOf(listing, catalog, brand, mpn, oeNumbers) {
    const aspects = (0, ebay_listing_aspects_util_js_1.buildListingAspects)({
        brand,
        mpn,
        partType: firstText(listing.cType, catalog?.partType),
        existing: {
            ...(firstText(listing.cPlacement, catalog?.placement)
                ? {
                    'Placement on Vehicle': [
                        firstText(listing.cPlacement, catalog?.placement),
                    ],
                }
                : {}),
            ...(firstText(listing.cMaterial, catalog?.material)
                ? { Material: [firstText(listing.cMaterial, catalog?.material)] }
                : {}),
            ...(firstText(listing.countryOfOrigin, catalog?.countryOfOrigin)
                ? {
                    'Country/Region of Manufacture': [
                        firstText(listing.countryOfOrigin, catalog?.countryOfOrigin),
                    ],
                }
                : {}),
        },
    });
    const out = {};
    for (const [name, values] of Object.entries(aspects)) {
        if (name === 'UPC' && values.every((v) => /^does not apply$/i.test(v)))
            continue;
        if (!values.length)
            continue;
        out[name] = values.length === 1 ? values[0] : values;
    }
    if (oeNumbers.length > 0) {
        out['OE/OEM Part Number'] =
            oeNumbers.length === 1 ? oeNumbers[0] : oeNumbers;
    }
    return out;
}
function compatibilityOf(catalog) {
    if (!catalog)
        return null;
    const source = (0, fitment_mvl_util_js_1.selectPublishFitmentSource)(catalog.fitmentData, catalog.fitmentRows);
    return ((0, fitment_mvl_util_js_1.fitmentDataToCompatibilityPayload)(source) ??
        null);
}
function fitToBudget(listing, warnings) {
    const size = (l) => Buffer.byteLength(JSON.stringify(l), 'utf8');
    let current = listing;
    if (size(current) <= exports.PARTSBAZAR_MAX_PAYLOAD_BYTES)
        return current;
    if (current.description &&
        current.description.length > TRIMMED_DESCRIPTION_CHARS) {
        current = {
            ...current,
            description: current.description.slice(0, TRIMMED_DESCRIPTION_CHARS),
        };
        warnings.push('Description was shortened to fit the publish size limit');
    }
    while (size(current) > exports.PARTSBAZAR_MAX_PAYLOAD_BYTES &&
        current.compatibility &&
        current.compatibility.compatibleProducts.length > 1) {
        const rows = current.compatibility.compatibleProducts;
        current = {
            ...current,
            compatibility: {
                compatibleProducts: rows.slice(0, Math.ceil(rows.length / 2)),
            },
        };
        warnings.push('Fitment rows were reduced to fit the publish size limit');
    }
    return current;
}
function buildPartsBazarPushItem(listing, catalog, context) {
    const warnings = [];
    const title = firstText(context.overrides?.title, listing.title, catalog?.optimizedTitle, catalog?.title);
    if (!title)
        return { ok: false, reason: 'Listing has no title', warnings };
    const price = priceOf(listing, catalog, context.overrides?.price);
    if (price === null || price <= 0) {
        return {
            ok: false,
            reason: 'Listing has no price greater than zero',
            warnings,
        };
    }
    const imageUrls = imagesOf(listing, catalog, context.imageUrls);
    if (imageUrls.length === 0) {
        return { ok: false, reason: 'Listing has no valid image URL', warnings };
    }
    const qty = quantityOf(listing, catalog, context.overrides?.quantity);
    if (qty.defaulted) {
        warnings.push('Listing has no quantity; published with quantity 1');
    }
    const conditionSource = firstText(listing.conditionId, catalog?.conditionId, listing.conditionLabel, catalog?.conditionLabel);
    if (!conditionSource) {
        warnings.push('Listing has no condition; published as Used');
    }
    const conditionEnum = (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(conditionSource ?? undefined);
    const qualityTier = qualityTierOf(conditionEnum);
    const brand = firstText(listing.cBrand, listing.manufacturerName, catalog?.brand);
    const mpn = firstText(listing.cManufacturerPartNumber, catalog?.mpn);
    const oeNumbers = oeNumbersOf(listing, catalog);
    const ebayItemId = firstText(listing.ebayListingId, catalog?.ebayItemId);
    const description = firstText(listing.description, catalog?.optimizedDescription, catalog?.description);
    const hints = { qualityTier };
    if (qualityTier === 'NEW') {
        hints.partSource = oeNumbers.length > 0 ? 'OEM' : 'AFTERMARKET';
        hints.partType =
            hints.partSource === 'AFTERMARKET' ? 'AFTERMARKET' : 'UNCLASSIFIED';
    }
    const payload = {
        title,
        sku: firstText(listing.customLabelSku, catalog?.sku),
        price: price.toFixed(2),
        currency: context.currency,
        quantityAvailable: qty.quantity,
        listingStatus: ['sold', 'delisted', 'archived'].includes(listing.status)
            ? 'ended'
            : 'active',
        marketplaceId: context.marketplaceId,
        condition: humanize(conditionEnum),
        categoryName: firstText(catalog?.categoryName, listing.categoryName),
        brand,
        mpn,
        oeNumbers,
        description: description
            ? description.slice(0, MAX_DESCRIPTION_CHARS)
            : null,
        imageUrls,
        itemSpecifics: specificsOf(listing, catalog, brand, mpn, oeNumbers),
        compatibility: compatibilityOf(catalog),
        ebayItemId,
        listingUrl: ebayItemId ? `https://www.ebay.com/itm/${ebayItemId}` : null,
    };
    return {
        ok: true,
        warnings,
        item: {
            sourceListingId: listing.id,
            listing: fitToBudget(payload, warnings),
            hints,
        },
    };
}
//# sourceMappingURL=partsbazar360-listing.mapper.js.map