"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivePartNameFromTitle = derivePartNameFromTitle;
const STOP_WORDS = new Set([
    'oem',
    'genuine',
    'used',
    'new',
    'original',
    'factory',
    'oe',
    'fits',
]);
function stripSpecialChars(value) {
    return (value ?? '')
        .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function derivePartNameFromTitle(title, partNumber, brand) {
    if (!title?.trim())
        return undefined;
    const brandTokens = new Set((brand ?? '').toLowerCase().split(/\s+/).filter(Boolean));
    const normalize = (v) => v.toLowerCase().replace(/[\s\-]/g, '');
    const targetPn = normalize(partNumber ?? '');
    const words = stripSpecialChars(title)
        .split(/\s+/)
        .filter((w) => {
        const lower = w.toLowerCase();
        if (STOP_WORDS.has(lower))
            return false;
        if (brandTokens.has(lower))
            return false;
        if (targetPn && normalize(w) === targetPn)
            return false;
        if (/^[a-z0-9\-]{8,}$/i.test(w) && /\d/.test(w))
            return false;
        if (/^(19|20)\d{2}([-/](19|20)?\d{2})?$/.test(w))
            return false;
        return true;
    });
    const name = words.join(' ').replace(/\s+/g, ' ').trim();
    return name.length >= 3 ? name.slice(0, 65) : undefined;
}
//# sourceMappingURL=derive-part-name-from-title.js.map