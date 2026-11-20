"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EBAY_MAX_LISTING_IMAGES = void 0;
exports.parseImageUrlField = parseImageUrlField;
exports.flattenImageUrlInputs = flattenImageUrlInputs;
exports.normalizePublishImageUrl = normalizePublishImageUrl;
exports.isValidPublishImageUrl = isValidPublishImageUrl;
exports.preferLargeEbayImageUrl = preferLargeEbayImageUrl;
exports.isSingleImageBrand = isSingleImageBrand;
exports.selectPrimaryImageForBrand = selectPrimaryImageForBrand;
exports.preferRicherImageUrls = preferRicherImageUrls;
exports.sanitizeEbayImageUrls = sanitizeEbayImageUrls;
exports.applyImageOrderOverride = applyImageOrderOverride;
exports.EBAY_MAX_LISTING_IMAGES = 24;
const SINGLE_IMAGE_BRAND_PATTERN = /\b(?:febi(?:\s+bilstein)?|lemforder|lemförder)\b/i;
const PLACEHOLDER_IMAGE_PATTERN = /placeholder|no-image|default-image|logo-only/i;
const PARTSFINDER_ROTATING_IMAGE_TEMPLATE = /(\/pf-allaround-)zoomed(\/[^/]+\/[^/]+\/)([^/]+)-\{col\}(\.[a-z0-9]+)([?#].*)?$/i;
function parseImageUrlField(raw) {
    if (!raw?.trim())
        return [];
    return raw
        .split(/[\n|,]+/)
        .flatMap((s) => s.split(/\s+/))
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && /^https?:\/\//i.test(s))
        .map((s) => s.replace(/^http:\/\//i, 'https://'));
}
function flattenImageUrlInputs(urls) {
    if (!urls?.length)
        return [];
    const out = [];
    for (const raw of urls) {
        if (typeof raw !== 'string')
            continue;
        const parts = raw
            .split('|')
            .map((part) => part.trim())
            .filter(Boolean);
        out.push(...parts);
    }
    return out;
}
function normalizePublishImageUrl(url) {
    let trimmed = url.trim();
    if (!trimmed)
        return null;
    if (trimmed.startsWith('//'))
        trimmed = `https:${trimmed}`;
    if (!/^https?:\/\//i.test(trimmed))
        return null;
    if (trimmed.length > 2048)
        return null;
    trimmed = trimmed.replace(PARTSFINDER_ROTATING_IMAGE_TEMPLATE, '$1details$2$3-01$4$5');
    if (/[{}]/.test(trimmed))
        return null;
    return trimmed;
}
function isValidPublishImageUrl(url) {
    return normalizePublishImageUrl(url) != null;
}
function preferLargeEbayImageUrl(url) {
    return url
        .replace(/\/s-l(64|96|140|225|300|400|500)\./gi, '/s-l1600.')
        .replace(/([?&]s-l)(64|96|140|225|300|400|500)(?=\D|$)/gi, '$11600');
}
function isSingleImageBrand(brandOrTitle) {
    return SINGLE_IMAGE_BRAND_PATTERN.test(brandOrTitle?.trim() ?? '');
}
function embeddedEbayImageDimensions(url) {
    const token = url.match(/\/s\/([^/]+)\//i)?.[1];
    if (!token) {
        const size = url.match(/(?:^|[/?])s-l(\d+)(?:\D|$)/i)?.[1];
        return size ? [Number(size), Number(size)] : null;
    }
    try {
        const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - (normalized.length % 4)) % 4;
        const padded = normalized.padEnd(normalized.length + padding, '=');
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        const match = decoded.match(/(\d{2,5})x(\d{2,5})/i);
        return match ? [Number(match[1]), Number(match[2])] : null;
    }
    catch {
        return null;
    }
}
function selectPrimaryImageForBrand(urls, brandOrTitle) {
    if (!isSingleImageBrand(brandOrTitle)) {
        return sanitizeEbayImageUrls((urls ?? []).map(preferLargeEbayImageUrl))
            .imageUrls;
    }
    const rawCount = Math.max(flattenImageUrlInputs(urls).length, 1);
    const candidates = sanitizeEbayImageUrls((urls ?? []).map(preferLargeEbayImageUrl), { maxImages: rawCount }).imageUrls;
    if (candidates.length <= 1)
        return candidates;
    let best = candidates[0];
    let bestScore = -1;
    for (const candidate of candidates) {
        const dimensions = embeddedEbayImageDimensions(candidate);
        const score = dimensions ? dimensions[0] * dimensions[1] : 0;
        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }
    return [best];
}
function preferRicherImageUrls(primary, secondary) {
    const a = sanitizeEbayImageUrls((primary ?? []).map((u) => preferLargeEbayImageUrl(u))).imageUrls;
    const b = sanitizeEbayImageUrls((secondary ?? []).map((u) => preferLargeEbayImageUrl(u))).imageUrls;
    if (a.length > b.length)
        return a;
    if (b.length > a.length)
        return b;
    return a.length > 0 ? a : b;
}
function sanitizeEbayImageUrls(urls, options) {
    const warnings = [];
    const maxImages = options?.maxImages ?? exports.EBAY_MAX_LISTING_IMAGES;
    const seen = new Set();
    const imageUrls = [];
    for (const raw of flattenImageUrlInputs(urls)) {
        const normalized = normalizePublishImageUrl(raw);
        if (!normalized) {
            warnings.push(`Skipped invalid image URL: ${raw.slice(0, 80)}`);
            continue;
        }
        const key = normalized.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        if (PLACEHOLDER_IMAGE_PATTERN.test(normalized)) {
            warnings.push(`Skipped placeholder image URL: ${normalized.slice(0, 80)}`);
            continue;
        }
        imageUrls.push(normalized);
        if (imageUrls.length >= maxImages)
            break;
    }
    const rawCount = flattenImageUrlInputs(urls).length;
    if (rawCount > imageUrls.length && imageUrls.length > 0) {
        warnings.push(`Using ${imageUrls.length} valid image URL(s) after filtering invalid or duplicate entries`);
    }
    if (rawCount > maxImages && imageUrls.length === maxImages) {
        warnings.push(`Image list capped at ${maxImages} URLs for eBay publish`);
    }
    return { imageUrls, warnings };
}
function applyImageOrderOverride(imageUrls, override) {
    if (!Array.isArray(override) || !override.length || !imageUrls.length) {
        return imageUrls;
    }
    const ordered = [];
    const remaining = new Map(imageUrls.map((url) => [url.toLowerCase(), url]));
    for (const entry of override) {
        if (typeof entry !== 'string')
            continue;
        const trimmed = entry.trim();
        if (!trimmed)
            continue;
        const match = remaining.get(trimmed.toLowerCase());
        if (match) {
            ordered.push(match);
            remaining.delete(trimmed.toLowerCase());
        }
    }
    for (const url of imageUrls) {
        if (!ordered.includes(url))
            ordered.push(url);
    }
    return ordered;
}
//# sourceMappingURL=ebay-listing-images.util.js.map