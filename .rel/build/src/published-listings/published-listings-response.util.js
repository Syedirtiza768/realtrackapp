"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preferLargeEbayImageUrl = void 0;
exports.orderImageUrlsForConsumer = orderImageUrlsForConsumer;
exports.extractSalvageDetails = extractSalvageDetails;
exports.toPublishedListingCatalogData = toPublishedListingCatalogData;
exports.toPublishedListingApiResponse = toPublishedListingApiResponse;
const fitment_mvl_util_js_1 = require("../fitment/fitment-mvl.util.js");
const ebay_listing_images_util_js_1 = require("../channels/ebay/ebay-listing-images.util.js");
Object.defineProperty(exports, "preferLargeEbayImageUrl", { enumerable: true, get: function () { return ebay_listing_images_util_js_1.preferLargeEbayImageUrl; } });
const SPECIFIC_KEYS = {
    brand: ['brand', 'manufacturer', 'marque'],
    mpn: [
        'manufacturer part number',
        'mpn',
        'mfr part number',
        'manufacturer part no',
    ],
    oe: [
        'oe/oem number',
        'oem number',
        'oe number',
        'oe/oem part number',
        'interchange part number',
        'other part number',
    ],
    donorYear: ['donor year', 'donor vehicle year'],
    donorMake: ['donor make', 'donor vehicle make'],
    donorModel: ['donor model', 'donor vehicle model'],
    donorTrim: ['donor trim', 'donor vehicle trim'],
    mileage: ['mileage', 'odometer', 'miles', 'donor mileage'],
    stockNumber: ['stock number', 'stock #', 'stock no', 'inventory id'],
    yard: ['yard', 'yard name'],
    bin: ['bin', 'bin location', 'shelf'],
    vin: ['vin', 'vehicle identification number'],
    conditionGrade: ['condition grade', 'grade'],
    testedStatus: ['tested', 'tested status', 'functionality'],
};
function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();
}
function classifyImageSource(url) {
    const lower = url.toLowerCase();
    if (lower.includes('ebayimg.com') || lower.includes('ebaystatic.com')) {
        return 'ebay';
    }
    if (lower.includes('gridx') || lower.includes('grid-x'))
        return 'gridx';
    return 'other';
}
function orderImageUrlsForConsumer(urls) {
    const upgraded = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(urls.map(ebay_listing_images_util_js_1.preferLargeEbayImageUrl)).imageUrls;
    const ebay = [];
    const other = [];
    for (const url of upgraded) {
        if (classifyImageSource(url) === 'ebay')
            ebay.push(url);
        else
            other.push(url);
    }
    return [...ebay, ...other];
}
function asStringValues(raw) {
    if (Array.isArray(raw)) {
        return raw.filter((v) => typeof v === 'string');
    }
    if (typeof raw === 'string' && raw.trim())
        return [raw];
    return [];
}
function firstSpecific(specifics, keys) {
    const entries = Object.entries(specifics ?? {});
    for (const want of keys) {
        const hit = entries.find(([k]) => k.trim().toLowerCase() === want);
        const value = asStringValues(hit?.[1]).find((v) => v?.trim());
        if (value?.trim())
            return value.trim();
    }
    return null;
}
function allSpecifics(specifics, keys) {
    const out = [];
    const seen = new Set();
    const entries = Object.entries(specifics ?? {});
    for (const want of keys) {
        const hit = entries.find(([k]) => k.trim().toLowerCase() === want);
        for (const value of asStringValues(hit?.[1])) {
            const trimmed = value?.trim();
            if (!trimmed)
                continue;
            const key = trimmed.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push(trimmed);
        }
    }
    return out;
}
function parseMileage(raw) {
    if (!raw)
        return { mileage: null, mileageUnit: null };
    const match = raw.match(/([\d,.]+)\s*(km|mi|miles|kilometers)?/i);
    if (!match)
        return { mileage: raw, mileageUnit: null };
    const unitRaw = (match[2] ?? '').toLowerCase();
    const mileageUnit = unitRaw.startsWith('km') || unitRaw.startsWith('kilometer')
        ? 'km'
        : unitRaw
            ? 'mi'
            : null;
    return { mileage: match[1].replace(/,/g, ''), mileageUnit };
}
function extractSalvageDetails(specifics) {
    const mileageRaw = firstSpecific(specifics, SPECIFIC_KEYS.mileage);
    const { mileage, mileageUnit } = parseMileage(mileageRaw);
    const details = {
        donorYear: firstSpecific(specifics, SPECIFIC_KEYS.donorYear),
        donorMake: firstSpecific(specifics, SPECIFIC_KEYS.donorMake),
        donorModel: firstSpecific(specifics, SPECIFIC_KEYS.donorModel),
        donorTrim: firstSpecific(specifics, SPECIFIC_KEYS.donorTrim),
        mileage,
        mileageUnit,
        stockNumber: firstSpecific(specifics, SPECIFIC_KEYS.stockNumber),
        yard: firstSpecific(specifics, SPECIFIC_KEYS.yard),
        bin: firstSpecific(specifics, SPECIFIC_KEYS.bin),
        vin: firstSpecific(specifics, SPECIFIC_KEYS.vin),
        conditionGrade: firstSpecific(specifics, SPECIFIC_KEYS.conditionGrade),
        testedStatus: firstSpecific(specifics, SPECIFIC_KEYS.testedStatus),
    };
    const hasAny = Object.values(details).some((v) => v != null && String(v).trim() !== '');
    return hasAny ? details : null;
}
function toPublishedListingCatalogData(product) {
    const validatedFitmentRows = (0, fitment_mvl_util_js_1.selectPublishFitmentSource)(product.fitmentData, product.fitmentRows, {
        requireValidated: true,
    }) ?? [];
    return {
        source: 'RealTrackApp.catalog_products',
        identifiers: {
            sku: product.sku ?? null,
            mpn: product.mpn ?? null,
            mpnNormalized: product.mpnNormalized ?? null,
            upc: product.upc ?? null,
            ean: product.ean ?? null,
            epid: product.epid ?? null,
            oemPartNumber: product.oemPartNumber ?? null,
        },
        product: {
            title: product.title,
            brand: product.brand ?? null,
            partType: product.partType ?? null,
            placement: product.placement ?? null,
            material: product.material ?? null,
            features: product.features ?? null,
            countryOfOrigin: product.countryOfOrigin ?? null,
        },
        attributes: {
            weight: product.weight ?? null,
            verticalAttributes: product.verticalAttributes ?? {},
        },
        category: {
            id: product.categoryId ?? null,
            name: product.categoryName ?? null,
            source: 'RealTrackApp.catalog_products',
        },
        fitment: {
            validation: validatedFitmentRows.length > 0 ? 'mvl_validated' : 'none',
            validatedRows: validatedFitmentRows,
        },
    };
}
function toPublishedListingApiResponse(listing, options) {
    const descriptionHtml = listing.description?.trim()
        ? listing.description
        : null;
    const descriptionText = descriptionHtml ? stripHtml(descriptionHtml) : null;
    const specifics = listing.itemSpecifics ?? {};
    const brand = firstSpecific(specifics, SPECIFIC_KEYS.brand);
    const orderedImages = orderImageUrlsForConsumer(listing.imageUrls ?? []);
    const imageUrls = (0, ebay_listing_images_util_js_1.isSingleImageBrand)(brand ?? listing.title)
        ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(orderedImages, brand ?? listing.title)
        : orderedImages;
    const images = imageUrls.map((url, index) => ({
        url,
        source: classifyImageSource(url),
        sortOrder: index,
        isPrimary: index === 0,
    }));
    return {
        ...listing,
        description: listing.description,
        descriptionHtml,
        descriptionText,
        storeSlug: options?.storeSlug ?? null,
        imageUrls,
        images,
        brand,
        mpn: firstSpecific(specifics, SPECIFIC_KEYS.mpn),
        oeNumbers: allSpecifics(specifics, SPECIFIC_KEYS.oe),
        salvageDetails: extractSalvageDetails(specifics),
        ...(options?.includeCatalogData
            ? { catalogData: options.catalogData ?? null }
            : {}),
    };
}
//# sourceMappingURL=published-listings-response.util.js.map