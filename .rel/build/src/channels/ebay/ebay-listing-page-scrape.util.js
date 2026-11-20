"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractEbayImageUrlsFromHtml = extractEbayImageUrlsFromHtml;
exports.extractItemSpecificsFromHtml = extractItemSpecificsFromHtml;
exports.extractCompatibilityFromHtml = extractCompatibilityFromHtml;
exports.parseEbayListingPageHtml = parseEbayListingPageHtml;
exports.isNonEnglishEbayListingHost = isNonEnglishEbayListingHost;
exports.buildPublicEbayItemUrl = buildPublicEbayItemUrl;
function decodeHtmlEntities(raw) {
    return raw
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, ' ');
}
function stripTags(html) {
    return decodeHtmlEntities(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function uniqUrls(urls) {
    const seen = new Set();
    const out = [];
    for (const raw of urls) {
        const url = raw.trim().replace(/^http:\/\//i, 'https://');
        if (!/^https?:\/\//i.test(url))
            continue;
        const key = url.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(url);
    }
    return out;
}
function parseJsonLdProducts(html) {
    const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    const products = [];
    for (const block of blocks) {
        const body = block
            .replace(/^[\s\S]*?>/, '')
            .replace(/<\/script>\s*$/i, '')
            .trim();
        if (!body)
            continue;
        try {
            const parsed = JSON.parse(body);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            for (const entry of list) {
                if (!entry || typeof entry !== 'object')
                    continue;
                const type = String(entry['@type'] ?? '').toLowerCase();
                if (type.includes('product')) {
                    products.push(entry);
                }
            }
        }
        catch {
        }
    }
    return products;
}
function collectImagesFromJsonLd(products) {
    const urls = [];
    for (const product of products) {
        const image = product.image;
        if (typeof image === 'string')
            urls.push(image);
        else if (Array.isArray(image)) {
            for (const entry of image) {
                if (typeof entry === 'string')
                    urls.push(entry);
                else if (entry && typeof entry === 'object' && 'url' in entry) {
                    const url = entry.url;
                    if (typeof url === 'string')
                        urls.push(url);
                }
            }
        }
        else if (image && typeof image === 'object' && 'url' in image) {
            const url = image.url;
            if (typeof url === 'string')
                urls.push(url);
        }
    }
    return urls;
}
function collectTitleFromJsonLd(products) {
    for (const product of products) {
        const name = product.name;
        if (typeof name === 'string' && name.trim())
            return name.trim();
    }
    return null;
}
function collectDescriptionFromJsonLd(products) {
    for (const product of products) {
        const desc = product.description;
        if (typeof desc === 'string' && desc.trim())
            return desc.trim();
    }
    return null;
}
function extractEbayImageUrlsFromHtml(html) {
    const matches = html.matchAll(/https?:\/\/i\.ebayimg\.com\/[^"'\\\s<>]+/gi);
    const urls = [];
    for (const m of matches) {
        let url = m[0]
            .replace(/&amp;/gi, '&')
            .replace(/\\u002F/gi, '/')
            .replace(/\\\//g, '/');
        url = url.replace(/[),.;]+$/, '');
        urls.push(url);
    }
    const escaped = html.matchAll(/https?:\\\/\\\/i\.ebayimg\.com\\\/[^"'\\\s<>]+/gi);
    for (const m of escaped) {
        urls.push(m[0].replace(/\\\//g, '/').replace(/\\u002F/gi, '/'));
    }
    return uniqUrls(urls);
}
function extractOgImages(html) {
    const urls = [];
    const metas = html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi);
    for (const m of metas) {
        if (m[1])
            urls.push(decodeHtmlEntities(m[1]));
    }
    const metas2 = html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi);
    for (const m of metas2) {
        if (m[1])
            urls.push(decodeHtmlEntities(m[1]));
    }
    return uniqUrls(urls);
}
function extractItemSpecificsFromHtml(html) {
    const out = {};
    const add = (name, value) => {
        const n = decodeHtmlEntities(name).replace(/\s+/g, ' ').trim();
        const v = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
        if (!n || !v)
            return;
        const existing = out[n] ?? [];
        if (!existing.includes(v))
            existing.push(v);
        out[n] = existing;
    };
    const labelValueBlocks = html.matchAll(/ux-labels-values__labels-content[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?ux-labels-values__values-content[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi);
    for (const m of labelValueBlocks) {
        add(stripTags(m[1] ?? ''), stripTags(m[2] ?? ''));
    }
    const rows = html.matchAll(/<td[^>]*class=["'][^"']*attrLabels[^"']*["'][^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi);
    for (const m of rows) {
        add(stripTags(m[1] ?? ''), stripTags(m[2] ?? ''));
    }
    const jsonPairs = html.matchAll(/"name"\s*:\s*"([^"\\]+)"\s*,\s*"value"\s*:\s*"([^"\\]+)"/gi);
    for (const m of jsonPairs) {
        add(m[1] ?? '', m[2] ?? '');
    }
    return out;
}
function extractCompatibilityFromHtml(html) {
    const products = [];
    const tableRows = html.matchAll(/<tr[^>]*>\s*<td[^>]*>(\d{4})<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>(?:\s*<td[^>]*>([^<]*)<\/td>)?(?:\s*<td[^>]*>([^<]*)<\/td>)?/gi) ?? [];
    for (const m of tableRows) {
        const props = [
            { name: 'Year', value: (m[1] ?? '').trim() },
            { name: 'Make', value: decodeHtmlEntities((m[2] ?? '').trim()) },
            { name: 'Model', value: decodeHtmlEntities((m[3] ?? '').trim()) },
        ];
        if (m[4]?.trim()) {
            props.push({
                name: 'Trim',
                value: decodeHtmlEntities(m[4].trim()),
            });
        }
        if (m[5]?.trim()) {
            props.push({
                name: 'Engine',
                value: decodeHtmlEntities(m[5].trim()),
            });
        }
        if (props.every((p) => p.value)) {
            products.push({ compatibilityProperties: props });
        }
    }
    const jsonRows = html.matchAll(/"Year"\s*:\s*"(\d{4})"\s*,\s*"Make"\s*:\s*"([^"\\]+)"\s*,\s*"Model"\s*:\s*"([^"\\]+)"/gi);
    for (const m of jsonRows) {
        products.push({
            compatibilityProperties: [
                { name: 'Year', value: m[1] ?? '' },
                { name: 'Make', value: m[2] ?? '' },
                { name: 'Model', value: m[3] ?? '' },
            ],
        });
    }
    if (products.length === 0)
        return null;
    return { compatibleProducts: products.slice(0, 5000) };
}
function extractDescriptionHtml(html) {
    const iframeSrc = html.match(/id=["']desc_ifr["'][^>]*src=["']([^"']+)["']/i)?.[1] ?? null;
    void iframeSrc;
    const sections = [
        html.match(/id=["']ds_div["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/section|<\/td)/i)?.[1],
        html.match(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
        html.match(/class=["'][^"']*d-item-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    ];
    for (const section of sections) {
        if (section && stripTags(section).length > 40) {
            return section.trim();
        }
    }
    return null;
}
function parseEbayListingPageHtml(html) {
    const sources = [];
    const products = parseJsonLdProducts(html);
    const title = collectTitleFromJsonLd(products);
    if (title)
        sources.push('json_ld_title');
    const jsonLdImages = collectImagesFromJsonLd(products);
    const ogImages = extractOgImages(html);
    const pageImages = extractEbayImageUrlsFromHtml(html);
    const imageUrls = uniqUrls([...jsonLdImages, ...ogImages, ...pageImages]);
    if (jsonLdImages.length)
        sources.push('json_ld_images');
    if (ogImages.length)
        sources.push('og_image');
    if (pageImages.length)
        sources.push('html_ebayimg');
    let descriptionHtml = collectDescriptionFromJsonLd(products) ?? extractDescriptionHtml(html);
    if (descriptionHtml && !descriptionHtml.includes('<')) {
        descriptionHtml = `<p>${descriptionHtml}</p>`;
        sources.push('json_ld_description');
    }
    else if (descriptionHtml) {
        sources.push('html_description');
    }
    const itemSpecifics = extractItemSpecificsFromHtml(html);
    if (Object.keys(itemSpecifics).length)
        sources.push('html_item_specifics');
    const compatibility = extractCompatibilityFromHtml(html);
    if (compatibility)
        sources.push('html_compatibility');
    return {
        title,
        imageUrls,
        descriptionHtml: descriptionHtml?.trim() || null,
        descriptionText: descriptionHtml ? stripTags(descriptionHtml) : null,
        itemSpecifics,
        compatibility,
        sources: [...new Set(sources)],
    };
}
function isNonEnglishEbayListingHost(url) {
    if (!url?.trim())
        return false;
    try {
        const host = new URL(url.trim()).hostname.toLowerCase();
        if (host === 'www.ebay.com' || host === 'ebay.com')
            return false;
        if (host.endsWith('.ebay.com'))
            return false;
        if (host === 'www.ebay.co.uk' || host === 'ebay.co.uk')
            return false;
        if (host === 'www.ebay.ca' || host === 'ebay.ca')
            return false;
        if (host === 'www.ebay.com.au' || host === 'ebay.com.au')
            return false;
        return /(^|\.)ebay\.(de|fr|it|es|nl|be|at|ch|pl|ie|com\.br)$/i.test(host);
    }
    catch {
        return false;
    }
}
function buildPublicEbayItemUrl(ebayItemId, listingUrl, options) {
    const preferEnglish = options?.preferEnglishSite !== false;
    if (preferEnglish && ebayItemId?.trim()) {
        return `https://www.ebay.com/itm/${ebayItemId.trim()}`;
    }
    if (listingUrl?.trim() && /^https?:\/\//i.test(listingUrl.trim())) {
        return listingUrl.trim();
    }
    return `https://www.ebay.com/itm/${ebayItemId}`;
}
//# sourceMappingURL=ebay-listing-page-scrape.util.js.map