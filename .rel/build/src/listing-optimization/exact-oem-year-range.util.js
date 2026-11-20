"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCitedExactOemYearRange = findCitedExactOemYearRange;
function findCitedExactOemYearRange(rows, expectedMpn, target, maxSpan, maxYear) {
    const expectedMpnKey = normalizeIdentifier(expectedMpn ?? '');
    const targetMakeKey = normalizeIdentifier(target.make);
    const targetModelTokens = modelTokens(`${target.model} ${target.trim ?? ''}`);
    const targetVariantTokens = modelTokens(target.trim ?? '');
    const targetModelOnlyTokens = modelTokens(target.model);
    if (!expectedMpnKey ||
        !targetMakeKey ||
        targetModelTokens.length === 0) {
        return null;
    }
    const ranges = new Map();
    for (const row of rows) {
        const source = (row.evidenceSource ?? row.source ?? '').toLowerCase();
        if (source !== 'oem_catalog_lookup' ||
            normalizeIdentifier(row.make ?? '') !== targetMakeKey ||
            !row.notes ||
            !hasExactMpnCitation(row.notes, expectedMpnKey)) {
            continue;
        }
        for (const line of row.notes.split(/\r?\n/)) {
            const match = line.match(/^\s*[-*•]\s*((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\s+(.+?)\s*$/);
            if (!match)
                continue;
            const startYear = Number(match[1]);
            const endYear = Number(match[2]);
            if (endYear < startYear ||
                endYear - startYear > maxSpan ||
                startYear < 1900 ||
                endYear > maxYear) {
                continue;
            }
            const application = match[3]
                .replace(/\s*\([^)]*\).*$/, '')
                .trim();
            const make = row.make.trim();
            if (!application.toLowerCase().startsWith(`${make.toLowerCase()} `)) {
                continue;
            }
            const applicationTokens = modelTokens(application.slice(make.length));
            if (applicationTokens.length === 0 ||
                !applicationTokens.every((token) => targetModelTokens.includes(token))) {
                continue;
            }
            const relevantTokens = targetVariantTokens.length > 0
                ? targetVariantTokens
                : targetModelOnlyTokens;
            const overlap = applicationTokens.filter((token) => relevantTokens.includes(token)).length;
            if (overlap === 0)
                continue;
            const key = `${startYear}-${endYear}`;
            const score = overlap * 100 + applicationTokens.length;
            const existing = ranges.get(key);
            if (!existing || score > existing.score) {
                ranges.set(key, { startYear, endYear, make, score });
            }
        }
    }
    if (ranges.size === 0)
        return null;
    const bestScore = Math.max(...[...ranges.values()].map((range) => range.score));
    const bestRanges = [...ranges.values()].filter((range) => range.score === bestScore);
    if (bestRanges.length !== 1)
        return null;
    const { startYear, endYear, make } = bestRanges[0];
    return { startYear, endYear, make };
}
function hasExactMpnCitation(notes, expectedMpnKey) {
    const match = notes.match(/^\s*Exact MPN\s+([^\s]+)\s+matched\b/i);
    return !!match && normalizeIdentifier(match[1]) === expectedMpnKey;
}
function normalizeIdentifier(value) {
    return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}
function modelTokens(value) {
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => (token.length > 1 || /^[a-z]$/.test(token)) &&
        !/^(?:19|20)\d{2}$/.test(token) &&
        !/^mk\d+$/.test(token));
}
//# sourceMappingURL=exact-oem-year-range.util.js.map