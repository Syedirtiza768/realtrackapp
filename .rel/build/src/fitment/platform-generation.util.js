"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePlatformMake = normalizePlatformMake;
exports.normalizePlatformModel = normalizePlatformModel;
exports.buildPlatformKey = buildPlatformKey;
exports.resolvePlatformModelFromTitle = resolvePlatformModelFromTitle;
exports.resolvePlatformGeneration = resolvePlatformGeneration;
exports.formatYearRange = formatYearRange;
exports.parseYearRange = parseYearRange;
exports.validateGenerationYearAlignment = validateGenerationYearAlignment;
exports.alignGenerationAndYearRange = alignGenerationAndYearRange;
exports.extractFitmentVariantTokens = extractFitmentVariantTokens;
exports.detectTitleGenerationMismatch = detectTitleGenerationMismatch;
exports.buildPlatformSeoTitle = buildPlatformSeoTitle;
exports.getPlatformRanges = getPlatformRanges;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function loadPlatformRanges() {
    const candidates = [
        (0, node_path_1.join)(process.cwd(), 'shared/automotive-platform-ranges.json'),
        (0, node_path_1.join)(process.cwd(), '../shared/automotive-platform-ranges.json'),
    ];
    for (const candidate of candidates) {
        if ((0, node_fs_1.existsSync)(candidate)) {
            return JSON.parse((0, node_fs_1.readFileSync)(candidate, 'utf8'));
        }
    }
    return {};
}
const PLATFORM_RANGES = loadPlatformRanges();
const MODEL_ALIASES = {
    rx350: 'RX',
    rx450h: 'RX',
    rx400h: 'RX',
    rx300: 'RX',
    rx330: 'RX',
    '3-series': '3 Series',
    '5-series': '5 Series',
    '7-series': '7 Series',
    '4-series': '4 Series',
    'c-class': 'C-Class',
    'e-class': 'E-Class',
    's-class': 'S-Class',
    'gle-class': 'GLE',
    'glc-class': 'GLC',
    'a-class': 'A-Class',
    c350: 'C-Class',
    'c-350': 'C-Class',
    c300: 'C-Class',
    'c-300': 'C-Class',
    c250: 'C-Class',
    c230: 'C-Class',
    c280: 'C-Class',
    c320: 'C-Class',
    c400: 'C-Class',
    c43: 'C-Class',
    c63: 'C-Class',
    e350: 'E-Class',
    'e-350': 'E-Class',
    e550: 'E-Class',
    e63: 'E-Class',
    s550: 'S-Class',
    s63: 'S-Class',
    a250: 'A-Class',
    cla250: 'CLA-Class',
    glc300: 'GLC',
    gle350: 'GLE',
    ml350: 'M-Class',
    glk350: 'GLK-Class',
    slk350: 'SLK-Class',
};
const BRAND_ALIASES = {
    mercedes: 'Mercedes-Benz',
    'mercedes-benz': 'Mercedes-Benz',
    mb: 'Mercedes-Benz',
    bently: 'Bentley',
    vw: 'Volkswagen',
    chevy: 'Chevrolet',
    landrover: 'Land Rover',
    'land rover': 'Land Rover',
};
function normalizePlatformMake(make) {
    const raw = String(make ?? '').trim();
    if (!raw)
        return '';
    const key = raw.toLowerCase();
    return BRAND_ALIASES[key] ?? raw.replace(/\b\w/g, (c) => c.toUpperCase());
}
const MERCEDES_SERIES_TO_CLASS = {
    A: 'A-Class',
    B: 'B-Class',
    C: 'C-Class',
    E: 'E-Class',
    S: 'S-Class',
    CLA: 'CLA-Class',
    CLS: 'CLS-Class',
    GLK: 'GLK-Class',
    GLC: 'GLC',
    GLE: 'GLE',
    GLS: 'GLS',
    GL: 'GL-Class',
    ML: 'M-Class',
    SLK: 'SLK-Class',
    SL: 'SL-Class',
    CLK: 'CLK-Class',
    G: 'G-Class',
};
function normalizePlatformModel(make, model) {
    const raw = String(model ?? '').trim();
    if (!raw)
        return '';
    const lower = raw.toLowerCase().replace(/\s+/g, ' ');
    if (MODEL_ALIASES[lower])
        return MODEL_ALIASES[lower];
    if (/^rx\d/i.test(raw))
        return 'RX';
    if (/^nx\d/i.test(raw))
        return 'NX';
    if (/^gx\d/i.test(raw))
        return 'GX';
    if (/^es\d/i.test(raw))
        return 'ES';
    if (/^is\d/i.test(raw))
        return 'IS';
    const platformMake = normalizePlatformMake(make).toLowerCase();
    if (platformMake === 'mercedes-benz' || platformMake === 'mercedes') {
        const series = raw.match(/^([A-Za-z]{1,3})[-\s]?(\d{2,3})[A-Za-z]{0,2}$/);
        if (series) {
            const prefix = series[1].toUpperCase();
            if (MERCEDES_SERIES_TO_CLASS[prefix]) {
                return MERCEDES_SERIES_TO_CLASS[prefix];
            }
        }
    }
    return raw;
}
function buildPlatformKey(make, model) {
    const mk = normalizePlatformMake(make);
    const md = normalizePlatformModel(mk, model);
    return mk && md ? `${mk}|${md}` : '';
}
function resolvePlatformModelFromTitle(make, title, ranges = PLATFORM_RANGES) {
    const normalizedMake = normalizePlatformMake(make);
    let remainder = String(title ?? '').trim().replace(/^(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\s+/, '');
    if (!normalizedMake || !remainder)
        return null;
    const canonicalMakeVariants = normalizedMake.toLowerCase() === 'infiniti'
        ? [normalizedMake, 'Infinity']
        : [normalizedMake];
    const makeVariants = [
        ...new Set([String(make ?? '').trim(), ...canonicalMakeVariants]),
    ]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    const titleMake = makeVariants.find((candidate) => {
        const prefix = candidate.toLowerCase();
        const text = remainder.toLowerCase();
        return (text.startsWith(prefix) &&
            (text.length === prefix.length || /\s/.test(text[prefix.length])));
    });
    if (!titleMake)
        return null;
    remainder = remainder.slice(titleMake.length).trimStart();
    const makeKey = normalizePlatformMake(make).toLowerCase();
    const prefix = `${makeKey}|`;
    const models = Object.keys(ranges)
        .filter((key) => key.toLowerCase().startsWith(prefix))
        .map((key) => key.slice(key.indexOf('|') + 1))
        .sort((a, b) => b.length - a.length);
    const text = remainder.toLowerCase();
    return (models.find((model) => {
        const candidate = model.toLowerCase();
        return (text.startsWith(candidate) &&
            (text.length === candidate.length ||
                /[\s\-/,]/.test(text[candidate.length])));
    }) ?? null);
}
function resolvePlatformGeneration(make, model, year, ranges = PLATFORM_RANGES) {
    const yearNum = Number(year);
    if (!Number.isFinite(yearNum) || yearNum < 1900)
        return null;
    const key = buildPlatformKey(make, model);
    const generations = ranges[key];
    if (!generations?.length)
        return null;
    return (generations.find((g) => yearNum >= g.start && yearNum <= g.end) ?? null);
}
function formatYearRange(start, end) {
    return start === end ? String(start) : `${start}-${end}`;
}
function parseYearRange(yearRange) {
    const raw = String(yearRange ?? '').trim();
    if (!raw)
        return null;
    const match = raw.match(/^(19|20)\d{2}(?:\s*[-–]\s*((19|20)\d{2}))?/);
    if (!match)
        return null;
    const start = Number(match[0].slice(0, 4));
    const endMatch = raw.match(/[-–]\s*((19|20)\d{2})/);
    const end = endMatch ? Number(endMatch[1]) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end))
        return null;
    return { min: Math.min(start, end), max: Math.max(start, end) };
}
function validateGenerationYearAlignment(input) {
    const ranges = input.ranges ?? PLATFORM_RANGES;
    const generation = String(input.generation ?? '').trim();
    const parsed = parseYearRange(input.yearRange);
    const anchor = Number(input.anchorYear);
    const key = buildPlatformKey(input.make, input.model);
    let expected = null;
    if (Number.isFinite(anchor) && anchor >= 1900) {
        expected = resolvePlatformGeneration(input.make, input.model, anchor, ranges);
    }
    else if (parsed && key) {
        const gens = ranges[key] ?? [];
        expected =
            gens.find((g) => parsed.min >= g.start && parsed.max <= g.end + 1) ??
                gens.find((g) => parsed.min <= g.end && parsed.max >= g.start) ??
                null;
    }
    if (generation &&
        expected &&
        generation.toUpperCase() !== expected.code.toUpperCase()) {
        return {
            valid: false,
            message: `Generation ${generation} conflicts with expected ${expected.code} (${expected.start}-${expected.end})`,
            expected,
        };
    }
    if (generation && parsed && key) {
        const gens = ranges[key] ?? [];
        const genRow = gens.find((g) => g.code.toUpperCase() === generation.toUpperCase());
        if (genRow && (parsed.min < genRow.start || parsed.max > genRow.end)) {
            return {
                valid: false,
                message: `Year range ${input.yearRange} outside ${generation} platform (${genRow.start}-${genRow.end})`,
                expected: genRow,
            };
        }
    }
    if (expected && parsed) {
        if (parsed.min < expected.start || parsed.max > expected.end) {
            return {
                valid: false,
                message: `Year range ${input.yearRange} extends beyond ${expected.code} (${expected.start}-${expected.end})`,
                expected,
            };
        }
    }
    return { valid: true, expected: expected ?? undefined };
}
function alignGenerationAndYearRange(input) {
    const ranges = input.ranges ?? PLATFORM_RANGES;
    const anchor = Number(input.anchorYear);
    const platform = Number.isFinite(anchor) && anchor >= 1900
        ? resolvePlatformGeneration(input.make, input.model, anchor, ranges)
        : null;
    const fitmentNums = (input.fitmentYears ?? [])
        .map((y) => Number(y))
        .filter((y) => Number.isFinite(y) && y >= 1900);
    let yearStart = platform?.start;
    let yearEnd = platform?.end;
    if (fitmentNums.length > 0) {
        const fitMin = Math.min(...fitmentNums);
        const fitMax = Math.max(...fitmentNums);
        if (platform) {
            yearStart = Math.max(platform.start, fitMin);
            yearEnd = Math.min(platform.end, fitMax);
        }
        else {
            yearStart = fitMin;
            yearEnd = fitMax;
        }
    }
    if (yearStart == null || yearEnd == null) {
        const parsed = parseYearRange(input.yearRange);
        if (parsed) {
            yearStart = parsed.min;
            yearEnd = parsed.max;
        }
        else if (Number.isFinite(anchor) && anchor >= 1900) {
            yearStart = anchor;
            yearEnd = anchor;
        }
    }
    const generation = platform?.code ?? String(input.generation ?? '').trim() ?? '';
    const yearRange = yearStart != null && yearEnd != null
        ? formatYearRange(yearStart, yearEnd)
        : String(input.yearRange ?? '').trim();
    return {
        generation,
        yearRange,
    };
}
function extractFitmentVariantTokens(rows, max = 2) {
    const tokens = new Set();
    const pattern = /\b(RX\s?\d{3}h?|RX\d{3}h?|NX\d{3}|GX\d{3}|ES\d{3}|IS\d{3}|C\s?\d{3}|E\s?\d{3}|GLC\s?\d{3}|GLE\s?\d{3}|3\s?Series|5\s?Series)\b/gi;
    for (const row of rows) {
        for (const field of [row.trim, row.submodel, row.model]) {
            const text = String(field ?? '');
            if (!text)
                continue;
            for (const match of text.matchAll(pattern)) {
                const normalized = match[0].replace(/\s+/g, '').toUpperCase();
                if (normalized.length >= 3)
                    tokens.add(normalized);
            }
        }
    }
    return [...tokens].slice(0, max);
}
function detectTitleGenerationMismatch(title, make, model, anchorYear, ranges = PLATFORM_RANGES) {
    const text = String(title ?? '');
    if (!text.trim())
        return null;
    const yearMatch = text.match(/\b((19|20)\d{2})(?:\s*[-–]\s*((19|20)\d{2}))?\b/);
    const yearRange = yearMatch
        ? yearMatch[3]
            ? `${yearMatch[1]}-${yearMatch[3]}`
            : yearMatch[1]
        : undefined;
    const genMatch = text.match(/\b([A-Z]{1,3}\d{1,3}(?:\/[A-Z0-9]+)?|W\d{3}|XW\d{2}|XV\d{2}|XE\d{2}|AL\d{2}|XU\d{2})\b/i);
    const generation = genMatch?.[1];
    if (!generation && !yearRange)
        return null;
    const check = validateGenerationYearAlignment({
        generation,
        yearRange,
        make,
        model,
        anchorYear,
        ranges,
    });
    return check.valid ? null : (check.message ?? 'GENERATION_YEAR_MISMATCH');
}
function buildPlatformSeoTitle(input) {
    const make = normalizePlatformMake(input.make);
    const model = normalizePlatformModel(make, input.model);
    const yearNum = Number(input.year);
    const platform = Number.isFinite(yearNum) && yearNum >= 1900
        ? resolvePlatformGeneration(make, model, yearNum)
        : null;
    const aligned = platform
        ? {
            generation: platform.code,
            yearRange: formatYearRange(platform.start, platform.end),
        }
        : alignGenerationAndYearRange({
            make,
            model,
            anchorYear: input.year,
            fitmentYears: input.fitmentRows?.map((r) => r.year),
        });
    const variants = extractFitmentVariantTokens((input.fitmentRows ?? []).map((r) => ({
        trim: r.trim,
        submodel: r.submodel,
        model: r.model,
    })), 2);
    const partLabel = (input.partName ?? input.partType ?? '').trim();
    const placement = input.placement?.trim();
    const mpn = input.mpn?.trim();
    const segments = [
        aligned.yearRange,
        make,
        model !== 'RX' ? model : null,
        ...variants,
        platform?.code ?? aligned.generation,
        partLabel,
        placement,
        mpn,
        'Used',
        'OEM',
    ].filter(Boolean);
    return segments.join(' ').replace(/\s+/g, ' ').slice(0, 80).trim();
}
function getPlatformRanges() {
    return PLATFORM_RANGES;
}
//# sourceMappingURL=platform-generation.util.js.map