"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_IMAGE_URL_LIMIT = void 0;
exports.isHttpImageUrl = isHttpImageUrl;
exports.parseImageUrlPipe = parseImageUrlPipe;
exports.hasHttpImageUrls = hasHttpImageUrls;
exports.mergeImageUrls = mergeImageUrls;
exports.PIPELINE_IMAGE_URL_LIMIT = 24;
function isHttpImageUrl(value) {
    return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}
function parseImageUrlPipe(value) {
    return (value ?? '')
        .split('|')
        .map((candidate) => candidate.trim())
        .filter(isHttpImageUrl);
}
function hasHttpImageUrls(value) {
    if (typeof value === 'string')
        return parseImageUrlPipe(value).length > 0;
    return Array.isArray(value) && value.some(isHttpImageUrl);
}
function mergeImageUrls(existing, additions, limit = exports.PIPELINE_IMAGE_URL_LIMIT) {
    const merged = new Set();
    for (const candidate of additions) {
        if (isHttpImageUrl(candidate))
            merged.add(candidate.trim());
    }
    for (const candidate of existing ?? []) {
        if (isHttpImageUrl(candidate))
            merged.add(candidate.trim());
    }
    return [...merged].slice(0, limit);
}
//# sourceMappingURL=pipeline-image-matching.util.js.map