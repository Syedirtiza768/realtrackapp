"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EBAY_TITLE_PART_NUMBER_PATTERN = exports.EBAY_TITLE_STRUCTURE_PATTERN = exports.EBAY_DESCRIPTION_MAX_LENGTH = exports.EBAY_OFFER_DESCRIPTION_MAX_LENGTH = exports.EBAY_TITLE_MAX_LENGTH = void 0;
exports.matchesStrictEbayTitleStructure = matchesStrictEbayTitleStructure;
exports.normalizeListingText = normalizeListingText;
exports.truncateEbayTitle = truncateEbayTitle;
exports.stripPartNameNoise = stripPartNameNoise;
exports.buildStructuredEbayTitle = buildStructuredEbayTitle;
exports.buildEbayListingTitle = buildEbayListingTitle;
exports.stripListingHtmlBoilerplate = stripListingHtmlBoilerplate;
exports.truncateEbayDescription = truncateEbayDescription;
exports.buildEbayListingDescription = buildEbayListingDescription;
exports.sanitizeEbayDescription = sanitizeEbayDescription;
exports.sanitizePublishListingText = sanitizePublishListingText;
exports.EBAY_TITLE_MAX_LENGTH = 80;
exports.EBAY_OFFER_DESCRIPTION_MAX_LENGTH = 4000;
exports.EBAY_DESCRIPTION_MAX_LENGTH = exports.EBAY_OFFER_DESCRIPTION_MAX_LENGTH;
exports.EBAY_TITLE_STRUCTURE_PATTERN = /^(\d{4}(-\d{4})?)\s+[A-Za-z].*\s+OEM Used$/;
exports.EBAY_TITLE_PART_NUMBER_PATTERN = /\b(?:[A-NPR-Z0-9]{1,3}\s+[A-NPR-Z0-9]{1,4}\s+[A-NPR-Z0-9]{1,4}(?:\s+[A-Z])?|[A-NPR-Z0-9]{2,6}(?:-[A-NPR-Z0-9]{2,6}){1,3}|[A-NPR-Z0-9]{7,12})\b/;
function matchesStrictEbayTitleStructure(title) {
    if (!title || title.length > exports.EBAY_TITLE_MAX_LENGTH)
        return false;
    if (!exports.EBAY_TITLE_STRUCTURE_PATTERN.test(title))
        return false;
    if (!exports.EBAY_TITLE_PART_NUMBER_PATTERN.test(title))
        return false;
    return true;
}
function normalizeListingText(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function truncateEbayTitle(title, maxLength = exports.EBAY_TITLE_MAX_LENGTH) {
    const normalized = normalizeListingText(title);
    if (normalized.length <= maxLength)
        return normalized;
    const truncated = normalized.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
        return truncated.slice(0, lastSpace).trim();
    }
    return truncated.trim();
}
function truncateAtWord(text, maxLength) {
    const normalized = normalizeListingText(text);
    if (normalized.length <= maxLength)
        return normalized;
    const cut = normalized.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return lastSpace > maxLength * 0.5
        ? cut.slice(0, lastSpace).trim()
        : cut.trim();
}
const EBAY_TITLE_SUFFIX = 'OEM Used';
const EBAY_TITLE_STRUCTURED_KEYS = [
    'yearRange',
    'make',
    'model',
    'generation',
    'position',
    'partName',
    'oemPartNumber',
];
const EBAY_TITLE_DROPPABLE_KEYS = ['position', 'generation', 'model'];
const PART_NAME_NOISE_PATTERNS = [
    /\b(?:Only|Also)?\s*To Be Used For\s*:.*$/gi,
    /\bD\s*(?:>>)?\s*-?\s*\d{1,2}\.\d{1,2}\.\s*(?:>>)?\s*(?:-\s*\d{1,2}\.\d{1,2}\.)?/gi,
    /\([^)]*\)/g,
];
const PART_NAME_ABBREVIATIONS = [
    [/\bAssembly\b/gi, 'Asm'],
    [/\bWithout\b/gi, 'w/o'],
    [/\bRegulator\b/gi, 'Reg'],
    [/\bReinforcement\b/gi, 'Reinf'],
    [/\bAdjustment\b/gi, 'Adj'],
    [/\bConvenience\b/gi, 'Conv'],
    [/\bOccupied\b/gi, 'Occ'],
    [/\bSupply\b/gi, 'Sply'],
    [/\bTransverse\b/gi, 'Trans'],
    [/\bManual\b/gi, 'Man'],
    [/\bPassenger\b/gi, 'Pass'],
    [/\bAdhesive\b/gi, 'Adh'],
    [/\bInsulation\b/gi, 'Insul'],
    [/\bSectional Part\b/gi, 'Section'],
    [/\bControl Unit\b/gi, 'Ctrl Unit'],
];
function stripPartNameNoise(raw, position) {
    let s = raw;
    for (const pattern of PART_NAME_NOISE_PATTERNS) {
        s = s.replace(pattern, ' ');
    }
    s = normalizeListingText(s);
    const positionWords = position?.trim()
        ? position
            .trim()
            .split(/\s+/)
            .map((w) => w.toLowerCase())
        : [];
    for (let i = 0; i < 6; i++) {
        const before = s;
        s = s.replace(/\s*\bPr\s*:\s*\w+\s*$/i, '');
        s = s.replace(/\s*\b[LR]hd\s*$/i, '');
        s = s.replace(/\s+\d+\s*$/, '');
        const lastWord = s.match(/\b(\w+)\s*$/);
        if (lastWord && positionWords.includes(lastWord[1].toLowerCase())) {
            s = s.slice(0, lastWord.index).trimEnd();
        }
        s = s.replace(/[,;:\-–]+\s*$/, '').trim();
        if (s === before)
            break;
    }
    return normalizeListingText(s);
}
function abbreviatePartName(name) {
    let s = name;
    for (const [pattern, replacement] of PART_NAME_ABBREVIATIONS) {
        s = s.replace(pattern, replacement);
    }
    return normalizeListingText(s);
}
function buildStructuredEbayTitle(input, maxLength = exports.EBAY_TITLE_MAX_LENGTH) {
    const segmentsByKey = {};
    for (const key of EBAY_TITLE_STRUCTURED_KEYS) {
        let value = input[key]?.trim();
        if (key === 'oemPartNumber' && value) {
            value = value.split(/[,;]/)[0]?.trim();
        }
        if (key === 'partName' && value) {
            value = stripPartNameNoise(value, input.position);
        }
        if (value)
            segmentsByKey[key] = value;
    }
    const buildSegments = (dropped) => EBAY_TITLE_STRUCTURED_KEYS.filter((k) => !dropped.has(k))
        .map((k) => segmentsByKey[k])
        .filter((v) => Boolean(v));
    const coreOf = (dropped) => buildSegments(dropped).join(' ');
    const withSuffixOf = (dropped) => {
        const core = coreOf(dropped);
        return core ? `${core} ${EBAY_TITLE_SUFFIX}` : '';
    };
    const noneDropped = new Set();
    if (!buildSegments(noneDropped).length)
        return '';
    const fullWithSuffix = withSuffixOf(noneDropped);
    if (fullWithSuffix.length <= maxLength) {
        return normalizeListingText(fullWithSuffix);
    }
    if (segmentsByKey.partName) {
        segmentsByKey.partName = abbreviatePartName(segmentsByKey.partName);
        const fullWithSuffixAbbrev = withSuffixOf(noneDropped);
        if (fullWithSuffixAbbrev.length <= maxLength) {
            return normalizeListingText(fullWithSuffixAbbrev);
        }
    }
    let dropped = new Set();
    let bestCoreDropped = null;
    if (coreOf(dropped).length <= maxLength)
        bestCoreDropped = new Set(dropped);
    for (const key of EBAY_TITLE_DROPPABLE_KEYS) {
        if (!segmentsByKey[key])
            continue;
        const next = new Set([...dropped, key]);
        if (!buildSegments(next).length)
            break;
        const withSuffix = withSuffixOf(next);
        if (withSuffix.length <= maxLength) {
            return normalizeListingText(withSuffix);
        }
        if (bestCoreDropped === null && coreOf(next).length <= maxLength) {
            bestCoreDropped = next;
        }
        dropped = next;
    }
    if (segmentsByKey.partName) {
        const fixedLen = coreOf(new Set([...dropped, 'partName'])).length;
        const separator = fixedLen > 0 ? 1 : 0;
        const suffixLen = EBAY_TITLE_SUFFIX.length + 1;
        const budgetWithSuffix = maxLength - fixedLen - separator - suffixLen;
        if (budgetWithSuffix > 0) {
            const truncated = truncateAtWord(segmentsByKey.partName, budgetWithSuffix);
            if (truncated) {
                segmentsByKey.partName = truncated;
                const candidate = withSuffixOf(dropped);
                if (candidate.length <= maxLength) {
                    return normalizeListingText(candidate);
                }
            }
        }
        const budgetNoSuffix = maxLength - fixedLen - separator;
        if (budgetNoSuffix > 0) {
            const truncated = truncateAtWord(segmentsByKey.partName, budgetNoSuffix);
            if (truncated) {
                segmentsByKey.partName = truncated;
                return normalizeListingText(coreOf(dropped));
            }
        }
        delete segmentsByKey.partName;
        dropped = new Set([...dropped, 'partName']);
        bestCoreDropped =
            bestCoreDropped ??
                (coreOf(dropped).length <= maxLength ? new Set(dropped) : null);
    }
    if (bestCoreDropped) {
        return normalizeListingText(coreOf(bestCoreDropped));
    }
    const core = coreOf(dropped);
    if (!core)
        return '';
    const budget = maxLength - (EBAY_TITLE_SUFFIX.length + 1);
    const truncatedCore = truncateAtWord(core, Math.max(0, budget));
    const withSuffix = `${truncatedCore} ${EBAY_TITLE_SUFFIX}`;
    if (truncatedCore && withSuffix.length <= maxLength) {
        return normalizeListingText(withSuffix);
    }
    return truncateAtWord(core, maxLength);
}
function buildEbayListingTitle(source) {
    const warnings = [];
    const override = source.titleOverride?.trim();
    if (override) {
        const title = truncateEbayTitle(override);
        if (normalizeListingText(override).length > exports.EBAY_TITLE_MAX_LENGTH) {
            warnings.push(`Title override truncated from ${normalizeListingText(override).length} to ${exports.EBAY_TITLE_MAX_LENGTH} characters for eBay`);
        }
        return { title, warnings };
    }
    const raw = source.title?.trim() || '';
    if (raw) {
        const title = truncateEbayTitle(raw);
        if (normalizeListingText(raw).length > exports.EBAY_TITLE_MAX_LENGTH) {
            warnings.push(`Title truncated from ${normalizeListingText(raw).length} to ${exports.EBAY_TITLE_MAX_LENGTH} characters for eBay`);
        }
        return { title, warnings };
    }
    const make = (source.make ?? source.brand)?.trim() || '';
    const partName = (source.partName ?? source.partType)?.trim() || '';
    const oemPartNumber = (source.oemPartNumber ?? source.mpn)?.trim() || '';
    if (make && (partName || oemPartNumber)) {
        const composed = buildStructuredEbayTitle({
            yearRange: source.yearRange,
            make,
            model: source.model,
            generation: source.generation,
            position: source.position,
            partName,
            oemPartNumber,
        });
        if (composed) {
            warnings.push('Title was empty — composed from structured catalog fields');
            return { title: composed, warnings };
        }
    }
    let title = '';
    if (!title) {
        const parts = [source.brand, source.partType, source.mpn]
            .map((part) => part?.trim())
            .filter((part) => Boolean(part));
        if (parts.length) {
            title = truncateEbayTitle(parts.join(' '));
            warnings.push('Title was empty — generated from brand/part type/MPN');
        }
    }
    if (!title && source.sku?.trim()) {
        title = truncateEbayTitle(source.sku.trim());
        warnings.push('Title was empty — using SKU as listing title');
    }
    if (!title) {
        title = 'Automotive Part';
        warnings.push('Title was empty — using generic fallback title');
    }
    return { title, warnings };
}
function stripListingHtmlBoilerplate(html) {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
}
function hasVisibleText(html) {
    const text = html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 0;
}
function escapeHtmlText(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function buildDescriptionFallback(source) {
    const metadata = [source.brand, source.partType, source.mpn]
        .map((part) => part?.trim())
        .filter((part) => Boolean(part))
        .join(' ');
    const summary = source.title?.trim() ||
        metadata ||
        (source.sku?.trim() ? `SKU ${source.sku.trim()}` : '') ||
        'Automotive part';
    return `<p>${escapeHtmlText(summary)}. See photos for condition and fitment details.</p>`;
}
function truncateEbayDescription(description, maxLength = exports.EBAY_OFFER_DESCRIPTION_MAX_LENGTH) {
    if (description.length <= maxLength)
        return description;
    let cut = description.slice(0, maxLength);
    const breakPoints = ['</p>', '</li>', '</div>', '. ', '\n'];
    for (const bp of breakPoints) {
        const idx = cut.lastIndexOf(bp);
        if (idx > maxLength * 0.6) {
            cut = cut.slice(0, idx + (bp === '. ' ? 1 : bp.length));
            break;
        }
    }
    return cut.trim();
}
function buildEbayListingDescription(source) {
    const warnings = [];
    let raw = (source.description ?? '').trim();
    if (raw) {
        const stripped = stripListingHtmlBoilerplate(raw);
        if (stripped.length < raw.length) {
            warnings.push('Removed embedded style/script blocks from description for eBay publish');
        }
        raw = stripped;
    }
    if (!raw || !hasVisibleText(raw)) {
        raw = buildDescriptionFallback(source);
        warnings.push('Description was empty — generated fallback text for eBay');
    }
    if (raw.length > exports.EBAY_OFFER_DESCRIPTION_MAX_LENGTH) {
        const before = raw.length;
        raw = truncateEbayDescription(raw);
        warnings.push(`Description truncated from ${before} to ${raw.length} characters for eBay (max ${exports.EBAY_OFFER_DESCRIPTION_MAX_LENGTH})`);
    }
    if (raw.length < 1) {
        raw = buildDescriptionFallback(source);
    }
    return { description: raw, warnings };
}
function sanitizeEbayDescription(description, source) {
    return buildEbayListingDescription({
        description,
        ...source,
    }).description;
}
function sanitizePublishListingText(req) {
    const built = buildEbayListingTitle({
        title: req.title,
        sku: req.sku,
        brand: req.brand,
        mpn: req.mpn,
        partType: req.partType,
        yearRange: req.yearRange,
        make: req.make,
        model: req.model,
        generation: req.generation,
        position: req.position,
        partName: req.partName,
        oemPartNumber: req.oemPartNumber,
    });
    const desc = buildEbayListingDescription({
        description: req.description,
        title: built.title,
        sku: req.sku,
        brand: req.brand,
        mpn: req.mpn,
        partType: req.partType,
    });
    return {
        title: built.title,
        description: desc.description,
        warnings: [...built.warnings, ...desc.warnings],
    };
}
//# sourceMappingURL=ebay-listing-text.util.js.map