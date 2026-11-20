"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeTitle = sanitizeTitle;
exports.trimTitle = trimTitle;
exports.normalizeBrand = normalizeBrand;
exports.dedupeFitment = dedupeFitment;
exports.applyListingGuards = applyListingGuards;
exports.detectHallucinatedPartNumbers = detectHallucinatedPartNumbers;
const fitment_year_expand_js_1 = require("./fitment-year-expand.js");
const BRAND_MAP = {
    mercedes: 'Mercedes-Benz',
    'mercedes benz': 'Mercedes-Benz',
    bmw: 'BMW',
    vw: 'Volkswagen',
    chevy: 'Chevrolet',
    chevorlet: 'Chevrolet',
};
const DISCLAIMER = 'Please verify part number compatibility before purchasing';
const VIN_BLOCK_RE = /\s*[A-HJ-NPR-Z0-9]{17}\s*,\s*[A-Za-z][A-Za-z-]*,\s*[A-Za-z0-9]+,?\s*/g;
const USED_CONDITION_RE = /\b(used|refurbished|salvage|for.parts|not.working)\b/i;
const USED_NUMERIC_IDS = new Set([
    '3000',
    '4000',
    '5000',
    '6000',
    '7000',
    '2000',
    '2500',
]);
const NEW_NUMERIC_IDS = new Set(['1000', '1500', '1750']);
const USED_ENUM_RE = /^(USED_|FOR_PARTS|SELLER_REFURB|MANUFACTURER_REFURB|CERTIFIED_REFURB)/i;
function normSpaces(s) {
    return s.replace(/\s+/g, ' ').trim();
}
function normMpn(s) {
    return s.replace(/\s+/g, '').toLowerCase();
}
function isUsedCondition(condition) {
    const c = condition.toLowerCase().trim();
    if (USED_CONDITION_RE.test(c))
        return true;
    const numeric = c.replace(/-.*/, '').trim();
    if (USED_NUMERIC_IDS.has(numeric))
        return true;
    if (USED_ENUM_RE.test(condition))
        return true;
    return false;
}
function isNewCondition(condition) {
    const c = condition.toLowerCase().trim();
    if (c === 'new' ||
        c === 'new_oem' ||
        c === 'new_other' ||
        c === 'new_with_defects')
        return true;
    const numeric = c.replace(/-.*/, '').trim();
    if (NEW_NUMERIC_IDS.has(numeric))
        return true;
    if (/^NEW(?!_)/i.test(condition) || /^NEW_/i.test(condition))
        return true;
    return false;
}
function stripMismatchedCondition(title, condition) {
    if (!condition)
        return title;
    if (isUsedCondition(condition)) {
        return title
            .replace(/\bNew\b\s*/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    if (isNewCondition(condition)) {
        return title
            .replace(/\b(OEM\s*)?Used\b/gi, '')
            .replace(/\bRefurbished\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    return title;
}
function sanitizeTitle(title) {
    let t = title;
    t = t.replace(VIN_BLOCK_RE, ' ');
    return t.replace(/\s{2,}/g, ' ').trim();
}
function trimTitle(title, mpn) {
    let t = normSpaces(title);
    if (t.length <= 80)
        return t;
    const oemSuffix = 'OEM Used';
    if (t.endsWith(oemSuffix)) {
        const core = t.replace(/\s*OEM Used$/, '').trim();
        const maxCore = 80 - oemSuffix.length - 1;
        return core.slice(0, maxCore).trim() + ' ' + oemSuffix;
    }
    const mpnSuffix = mpn ? normSpaces(mpn).slice(-12) : '';
    const parts = t.split(/\s+/);
    while (parts.join(' ').length > 80 && parts.length > 4) {
        const mid = Math.floor(parts.length / 2);
        parts.splice(mid, 1);
    }
    t = parts.join(' ');
    if (t.length > 80 && mpnSuffix) {
        const base = t.slice(0, 80 - mpnSuffix.length - 1).trim();
        t = `${base} ${mpnSuffix}`.slice(0, 80);
    }
    return t.slice(0, 80);
}
function normalizeBrand(brand) {
    const key = brand.toLowerCase().trim();
    return BRAND_MAP[key] ?? brand;
}
function dedupeFitment(rows) {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
        const key = `${row.year}|${row.make}|${row.model}`.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(row);
    }
    return out;
}
function applyListingGuards(item, srcPart) {
    const fixes = [];
    const out = { ...item };
    const providedMpn = String(srcPart.partNumber ?? '').trim();
    const rawMpn = String(out.mpn ?? '').trim();
    if (providedMpn && !rawMpn) {
        out.mpn = providedMpn;
        fixes.push('MPN_SET_FROM_INPUT');
    }
    else if (providedMpn) {
        out.mpn = normSpaces(providedMpn);
        if (rawMpn !== out.mpn)
            fixes.push('MPN_NORMALIZED');
    }
    const brand = String(out.brand ?? '');
    if (brand) {
        const normalized = normalizeBrand(brand);
        if (normalized !== brand) {
            out.brand = normalized;
            fixes.push('BRAND_NORMALIZED');
        }
    }
    const specifics = typeof out.itemSpecifics === 'object' && out.itemSpecifics
        ? { ...out.itemSpecifics }
        : {};
    if (out.brand)
        specifics.Brand = String(out.brand);
    if (out.mpn)
        specifics['Manufacturer Part Number'] = String(out.mpn);
    if (out.type)
        specifics.Type = String(out.type);
    if (out.placement)
        specifics['Placement on Vehicle'] = String(out.placement);
    out.itemSpecifics = specifics;
    out.warranty = 'No Warranty';
    out.fitmentType = out.fitmentType || 'Direct Replacement';
    let title = String(out.title ?? '');
    const sanitized = sanitizeTitle(title);
    if (sanitized !== title) {
        title = sanitized;
        fixes.push('TITLE_SANITIZED');
    }
    const condition = srcPart.condition ?? out.condition ?? null;
    const conditionStripped = stripMismatchedCondition(title, condition);
    if (conditionStripped !== title) {
        title = conditionStripped;
        fixes.push('TITLE_CONDITION_MISMATCH_STRIPPED');
    }
    const trimmed = trimTitle(title, String(out.mpn ?? ''));
    if (trimmed !== title) {
        out.title = trimmed;
        fixes.push('TITLE_TRIMMED');
    }
    else {
        out.title = title;
    }
    let desc = String(out.description ?? '');
    if (!/verify part number compatibility/i.test(desc)) {
        if (desc && !desc.includes('</')) {
            desc += `\n<p>${DISCLAIMER}.</p>`;
        }
        else if (desc) {
            desc += `<p>${DISCLAIMER}.</p>`;
        }
        else {
            desc = `<p>${DISCLAIMER}.</p>`;
        }
        out.description = desc;
        fixes.push('DISCLAIMER_INJECTED');
    }
    if (Array.isArray(out.compatibility)) {
        const rawCompat = out.compatibility;
        const expanded = (0, fitment_year_expand_js_1.expandFitmentYearRanges)(rawCompat);
        const deduped = dedupeFitment(expanded);
        out.compatibility = deduped;
        if (deduped.length < expanded.length)
            fixes.push('FITMENT_DEDUPED');
        if (expanded.length > rawCompat.length)
            fixes.push('FITMENT_YEAR_RANGES_EXPANDED');
    }
    return { item: out, fixes };
}
function detectHallucinatedPartNumbers(parts, brand) {
    const BRAND_FORMATS = {
        toyota: /^\d{5}[-]?\d{3,5}$/i,
        lexus: /^\d{5}[-]?\d{3,5}$/i,
        bmw: /^(\d{2}\s?\d{2}\s?\d\s?\d{3}\s?\d{3}|\d{11})$/,
        'mercedes-benz': /^A?\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}$/i,
        ford: /^[A-Z0-9]{3,5}[-]?\d{4,5}[-]?[A-Z0-9]{0,3}$/i,
        lincoln: /^[A-Z0-9]{3,5}[-]?\d{4,5}[-]?[A-Z0-9]{0,3}$/i,
        chevrolet: /^\d{7,8}$/,
        gmc: /^\d{7,8}$/,
        cadillac: /^\d{7,8}$/,
        honda: /^\d{5}[-]?\w{5}$/i,
        acura: /^\d{5}[-]?\w{5}$/i,
        nissan: /^\d{5}[-]?[A-Z0-9]{5}$/i,
        infiniti: /^\d{5}[-]?[A-Z0-9]{5}$/i,
        hyundai: /^\d{3,5}[-]?\d{3,5}$/i,
        kia: /^\d{3,5}[-]?\d{3,5}$/i,
        volkswagen: /^[A-Z0-9]{3}\s?\d{3}\s?\d{3}[A-Z]?$/i,
        audi: /^[A-Z0-9]{3}\s?\d{3}\s?\d{3}[A-Z]?$/i,
        subaru: /^\d{3}[-]?\d{3}[-]?\d{2}$/i,
    };
    const normalizedBrand = brand.trim().toLowerCase();
    const format = BRAND_FORMATS[normalizedBrand];
    if (!format)
        return [];
    const warnings = [];
    for (const part of parts) {
        const pn = part.oem_part_number || part.oemPartNumber || '';
        const name = part.part_name || part.partName || 'Unknown part';
        if (!pn)
            continue;
        if (pn.includes('[VERIFY]'))
            continue;
        const normalized = pn.replace(/\s+/g, '').toUpperCase();
        if (!format.test(normalized)) {
            const matchedBrands = [];
            for (const [b, fmt] of Object.entries(BRAND_FORMATS)) {
                if (b !== normalizedBrand && fmt.test(normalized)) {
                    matchedBrands.push(b);
                }
            }
            const matchNote = matchedBrands.length > 0
                ? ` (matches ${matchedBrands.join(', ')} format)`
                : '';
            warnings.push(`"${name}": OEM# "${pn}" does not match ${brand} format${matchNote}`);
        }
    }
    return warnings;
}
//# sourceMappingURL=listing-guards.js.map