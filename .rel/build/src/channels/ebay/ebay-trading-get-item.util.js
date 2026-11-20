"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePictureUrls = parsePictureUrls;
exports.parseTradingItemCompatibility = parseTradingItemCompatibility;
exports.parseTradingItemSpecifics = parseTradingItemSpecifics;
exports.parseTradingGetItemResponse = parseTradingGetItemResponse;
function tagValue(block, tag) {
    const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
    const raw = m?.[1]?.trim() ?? null;
    if (!raw)
        return null;
    return decodeXmlEntities(raw.replace(/^<!\[CDATA\[|\]\]>$/g, ''));
}
function decodeXmlEntities(value) {
    return value
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&amp;', '&')
        .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_match, code) => {
        const value = code.toLowerCase().startsWith('x')
            ? Number.parseInt(code.slice(1), 16)
            : Number.parseInt(code, 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : _match;
    });
}
function parseBoolean(value) {
    if (value == null)
        return null;
    if (/^(true|1)$/i.test(value))
        return true;
    if (/^(false|0)$/i.test(value))
        return false;
    return null;
}
function parsePictureUrls(itemBlock) {
    const section = itemBlock.match(/<PictureDetails>[\s\S]*?<\/PictureDetails>/i)?.[0] ??
        itemBlock;
    const urls = [];
    const matches = section.matchAll(/<PictureURL[^>]*>([\s\S]*?)<\/PictureURL>/gi);
    for (const m of matches) {
        const url = m[1]?.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
        if (url)
            urls.push(url);
    }
    const gallery = tagValue(section, 'GalleryURL');
    if (gallery)
        urls.push(gallery);
    return [...new Set(urls)];
}
function parseTradingItemCompatibility(itemBlock) {
    const section = itemBlock.match(/<ItemCompatibilityList>[\s\S]*?<\/ItemCompatibilityList>/i)?.[0];
    if (!section)
        return null;
    const compatibleProducts = [];
    const compatBlocks = section.match(/<Compatibility>[\s\S]*?<\/Compatibility>/gi) ?? [];
    for (const block of compatBlocks) {
        const compatibilityProperties = [];
        const nvlBlocks = block.match(/<NameValueList>[\s\S]*?<\/NameValueList>/gi) ?? [];
        for (const nvl of nvlBlocks) {
            const name = tagValue(nvl, 'Name');
            const value = tagValue(nvl, 'Value');
            if (name && value)
                compatibilityProperties.push({ name, value });
        }
        if (compatibilityProperties.length === 0)
            continue;
        const notes = tagValue(block, 'CompatibilityNotes');
        compatibleProducts.push({
            compatibilityProperties,
            ...(notes ? { notes } : {}),
        });
    }
    return compatibleProducts.length > 0 ? { compatibleProducts } : null;
}
function parseTradingItemSpecifics(itemBlock) {
    const section = itemBlock.match(/<ItemSpecifics>[\s\S]*?<\/ItemSpecifics>/i)?.[0] ?? '';
    if (!section)
        return {};
    const out = {};
    const nvlBlocks = section.match(/<NameValueList>[\s\S]*?<\/NameValueList>/gi) ?? [];
    for (const nvl of nvlBlocks) {
        const name = tagValue(nvl, 'Name');
        if (!name)
            continue;
        const values = [];
        const valueMatches = nvl.matchAll(/<Value(?:\s[^>]*)?>([\s\S]*?)<\/Value>/gi);
        for (const m of valueMatches) {
            const raw = m[1]?.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
            if (raw)
                values.push(raw);
        }
        if (values.length === 0)
            continue;
        const existing = out[name] ?? [];
        out[name] = [...new Set([...existing, ...values])];
    }
    return out;
}
function parseTradingGetItemResponse(xml) {
    const itemBlock = xml.match(/<Item>[\s\S]*?<\/Item>/i)?.[0] ?? xml;
    const listingDetailsBlock = itemBlock.match(/<ListingDetails>[\s\S]*?<\/ListingDetails>/i)?.[0] ?? '';
    const bestOfferEnabled = parseBoolean(tagValue(itemBlock, 'BestOfferEnabled') ??
        tagValue(listingDetailsBlock, 'BestOfferEnabled'));
    const immediatePayRequired = parseBoolean(tagValue(itemBlock, 'AutoPay'));
    const primaryCategoryBlock = itemBlock.match(/<PrimaryCategory>[\s\S]*?<\/PrimaryCategory>/i)?.[0];
    const sellerProfilesBlock = itemBlock.match(/<SellerProfiles>[\s\S]*?<\/SellerProfiles>/i)?.[0] ?? '';
    const paymentProfileBlock = sellerProfilesBlock.match(/<SellerPaymentProfile>[\s\S]*?<\/SellerPaymentProfile>/i)?.[0] ?? '';
    const shippingProfileBlock = sellerProfilesBlock.match(/<SellerShippingProfile>[\s\S]*?<\/SellerShippingProfile>/i)?.[0] ?? '';
    const returnProfileBlock = sellerProfilesBlock.match(/<SellerReturnProfile>[\s\S]*?<\/SellerReturnProfile>/i)?.[0] ?? '';
    const priceRaw = tagValue(itemBlock, 'BuyItNowPrice') ??
        tagValue(itemBlock, 'CurrentPrice') ??
        tagValue(itemBlock, 'StartPrice');
    const priceTag = itemBlock.match(/<(?:BuyItNowPrice|CurrentPrice|StartPrice)(?:\s[^>]*)?[^>]*>/i)?.[0];
    const currency = priceTag?.match(/currencyID="([^"]+)"/i)?.[1] ?? null;
    const numberOrNull = (value) => {
        if (value == null || value.trim() === '')
            return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };
    return {
        itemId: tagValue(itemBlock, 'ItemID'),
        sku: tagValue(itemBlock, 'SKU'),
        title: tagValue(itemBlock, 'Title'),
        categoryId: tagValue(itemBlock, 'PrimaryCategoryID') ??
            (primaryCategoryBlock
                ? tagValue(primaryCategoryBlock, 'CategoryID')
                : null),
        conditionId: numberOrNull(tagValue(itemBlock, 'ConditionID')),
        quantity: numberOrNull(tagValue(itemBlock, 'Quantity')),
        quantitySold: numberOrNull(tagValue(itemBlock, 'QuantitySold')),
        price: numberOrNull(priceRaw),
        currency,
        listingType: tagValue(itemBlock, 'ListingType'),
        listingStatus: tagValue(itemBlock, 'ListingStatus'),
        listingDuration: tagValue(itemBlock, 'ListingDuration'),
        inventoryTrackingMethod: tagValue(itemBlock, 'InventoryTrackingMethod'),
        location: tagValue(itemBlock, 'Location'),
        country: tagValue(itemBlock, 'Country'),
        postalCode: tagValue(itemBlock, 'PostalCode'),
        conditionDescription: tagValue(itemBlock, 'ConditionDescription'),
        paymentProfileId: tagValue(paymentProfileBlock, 'PaymentProfileID'),
        shippingProfileId: tagValue(shippingProfileBlock, 'ShippingProfileID'),
        returnProfileId: tagValue(returnProfileBlock, 'ReturnProfileID'),
        listingUrl: tagValue(itemBlock, 'ViewItemURL'),
        startTime: tagValue(itemBlock, 'StartTime'),
        endTime: tagValue(itemBlock, 'EndTime'),
        imageUrls: parsePictureUrls(itemBlock),
        compatibility: parseTradingItemCompatibility(itemBlock),
        listingDetails: {
            bestOfferEnabled,
            immediatePayRequired,
        },
        description: tagValue(itemBlock, 'Description'),
        itemSpecifics: parseTradingItemSpecifics(itemBlock),
    };
}
//# sourceMappingURL=ebay-trading-get-item.util.js.map