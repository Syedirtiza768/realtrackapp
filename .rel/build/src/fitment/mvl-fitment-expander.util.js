"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFitmentExpansionMode = resolveFitmentExpansionMode;
exports.resolveFitmentAiInterchange = resolveFitmentAiInterchange;
exports.getFitmentMinMvlRows = getFitmentMinMvlRows;
exports.getSiblingExpansionMode = getSiblingExpansionMode;
exports.normalizeFitmentBrand = normalizeFitmentBrand;
exports.classifyPartExpansion = classifyPartExpansion;
exports.fitmentRowKey = fitmentRowKey;
exports.addUniqueFitmentRow = addUniqueFitmentRow;
exports.collapseYearRanges = collapseYearRanges;
exports.evaluateNeedsAiInterchange = evaluateNeedsAiInterchange;
exports.expandFitmentDeterministic = expandFitmentDeterministic;
const platform_generation_util_js_1 = require("./platform-generation.util.js");
const BRAND_MAP = {
    mercedes: 'Mercedes-Benz',
    'mercedes benz': 'Mercedes-Benz',
    mb: 'Mercedes-Benz',
    vw: 'Volkswagen',
    chevy: 'Chevrolet',
    chevorlet: 'Chevrolet',
};
const BODY_RE = /bumper|fender|headlight|taillight|mirror|hood|grille|door|quarter|spoiler|moulding|molding/i;
const INTERIOR_RE = /seat|dash|console|trim|panel|carpet|airbag|steering|armrest|headliner/i;
const MECHANICAL_RE = /engine|transmission|turbo|alternator|starter|radiator|axle|brake|suspension|exhaust/i;
const ELECTRICAL_RE = /ecu|module|sensor|computer|wiring|harness|control unit/i;
function resolveFitmentExpansionMode(raw) {
    const v = String(raw ?? 'hybrid')
        .trim()
        .toLowerCase();
    if (v === 'ai' || v === 'mvl' || v === 'hybrid')
        return v;
    return 'hybrid';
}
function resolveFitmentAiInterchange(raw) {
    const v = String(raw ?? 'auto')
        .trim()
        .toLowerCase();
    if (v === 'off' || v === 'auto' || v === 'always')
        return v;
    return 'auto';
}
function getFitmentMinMvlRows(raw) {
    const n = Number(raw ?? 5);
    return Number.isFinite(n) && n > 0 ? n : 5;
}
function getSiblingExpansionMode(raw) {
    const v = String(raw ?? 'conservative')
        .trim()
        .toLowerCase();
    if (v === 'off' || v === 'conservative' || v === 'aggressive')
        return v;
    return 'conservative';
}
function normalizeFitmentBrand(brand) {
    const key = brand.toLowerCase().trim();
    return BRAND_MAP[key] ?? brand.trim();
}
function classifyPartExpansion(partType = '', placement = '') {
    const hay = `${partType} ${placement}`.toLowerCase();
    if (ELECTRICAL_RE.test(hay))
        return 'electrical';
    if (MECHANICAL_RE.test(hay))
        return 'mechanical';
    if (INTERIOR_RE.test(hay))
        return 'interior';
    if (BODY_RE.test(hay))
        return 'body';
    return 'general';
}
function fitmentRowKey(row) {
    return `${row.year}|${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}`.toLowerCase();
}
function addUniqueFitmentRow(fitments, seen, entry) {
    if (!entry.make || !entry.model || !entry.year)
        return false;
    const key = fitmentRowKey(entry);
    if (seen.has(key))
        return false;
    seen.add(key);
    fitments.push(entry);
    return true;
}
function collapseYearRanges(rows) {
    const groups = new Map();
    for (const row of rows) {
        const year = Number(row.year);
        if (!Number.isFinite(year))
            continue;
        const gk = `${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}|${row.submodel ?? ''}`;
        if (!groups.has(gk)) {
            groups.set(gk, {
                make: row.make,
                model: row.model,
                trim: row.trim,
                engine: row.engine,
                submodel: row.submodel,
                bodyType: row.bodyType,
                notes: row.notes,
                source: row.source,
                years: [],
            });
        }
        groups.get(gk).years.push(year);
    }
    const ranges = [];
    for (const g of groups.values()) {
        const years = [...new Set(g.years)].sort((a, b) => a - b);
        let start = years[0];
        let prev = years[0];
        for (let i = 1; i <= years.length; i++) {
            const y = years[i];
            if (y === prev + 1) {
                prev = y;
                continue;
            }
            ranges.push({
                yearStart: start,
                yearEnd: prev,
                make: g.make,
                model: g.model,
                trim: g.trim,
                engine: g.engine,
                chassisCode: g.submodel,
                bodyType: g.bodyType,
                notes: g.notes,
                source: g.source,
            });
            start = y;
            prev = y;
        }
    }
    return ranges;
}
function evaluateNeedsAiInterchange(rowCount, minRows, tier, aiInterchangeMode) {
    if (aiInterchangeMode === 'off')
        return false;
    if (aiInterchangeMode === 'always')
        return true;
    if (rowCount >= minRows)
        return false;
    if (tier === 'electrical' || tier === 'mechanical')
        return true;
    return rowCount < minRows;
}
function expandFitmentDeterministic(input) {
    const { donor, partType = '', placement = '', profile = 'full', siblingMode = 'conservative', maxRows = 400, platformRanges = {}, sharedPlatforms = {}, resolveEbayModel = (make, model, trim) => ({
        model,
        trim: trim ?? '',
    }), } = input;
    const coverage = {
        platformYears: 0,
        siblingModels: 0,
        crossVin: 0,
        sharedPlatform: 0,
        mvlRejected: 0,
    };
    if (profile === 'compact') {
        return {
            ranges: [],
            expandedRows: [],
            tier: classifyPartExpansion(partType, placement),
            platformKey: '',
            generation: null,
            coverage,
        };
    }
    const makeName = normalizeFitmentBrand(donor.make);
    const ebayFitment = resolveEbayModel(makeName, donor.model, donor.trim);
    const platformKey = (0, platform_generation_util_js_1.buildPlatformKey)(makeName, donor.model);
    const yearNum = parseInt(donor.year, 10) || 0;
    const fitments = [];
    const seen = new Set();
    let generation = null;
    let generationCode = '';
    if (platformKey && yearNum) {
        generation = (0, platform_generation_util_js_1.resolvePlatformGeneration)(makeName, donor.model, yearNum, platformRanges);
        if (generation) {
            generationCode = generation.code;
            let added = 0;
            for (let y = generation.start; y <= generation.end; y++) {
                if (addUniqueFitmentRow(fitments, seen, {
                    year: String(y),
                    make: makeName,
                    model: ebayFitment.model,
                    trim: ebayFitment.trim || '',
                    engine: donor.engine || '',
                    submodel: generation.code,
                    bodyType: donor.bodyClass || '',
                    notes: `Platform ${generation.code}`,
                    source: 'platform_generation',
                })) {
                    added++;
                }
            }
            coverage.platformYears = added;
        }
    }
    if (fitments.length === 0 && donor.year && makeName && ebayFitment.model) {
        addUniqueFitmentRow(fitments, seen, {
            year: String(donor.year),
            make: makeName,
            model: ebayFitment.model,
            trim: ebayFitment.trim || donor.trim || '',
            engine: donor.engine || '',
            submodel: generationCode,
            bodyType: donor.bodyClass || '',
            notes: donor.trim ? `Trim: ${donor.trim}` : '',
            source: 'donor_vehicle',
        });
    }
    const tier = classifyPartExpansion(partType, placement);
    const allowShared = siblingMode !== 'off' &&
        (tier === 'body' || tier === 'general' || siblingMode === 'aggressive');
    if (allowShared && fitments.length > 0 && yearNum) {
        const siblings = sharedPlatforms[platformKey] ?? [];
        const existingKeys = new Set(fitments.map((f) => `${f.make}|${f.model}`));
        for (const siblingKey of siblings) {
            if (existingKeys.has(siblingKey))
                continue;
            const sibPlatforms = platformRanges[siblingKey];
            if (!sibPlatforms)
                continue;
            const sibGen = sibPlatforms.find((g) => yearNum >= g.start && yearNum <= g.end);
            if (!sibGen)
                continue;
            const [sibMake, sibModel] = siblingKey.split('|');
            let added = 0;
            for (let y = sibGen.start; y <= sibGen.end; y++) {
                if (addUniqueFitmentRow(fitments, seen, {
                    year: String(y),
                    make: sibMake,
                    model: sibModel,
                    trim: '',
                    engine: '',
                    submodel: sibGen.code,
                    bodyType: '',
                    notes: `Shared platform with ${makeName} ${donor.model} (${sibGen.code})`,
                    source: 'shared_platform',
                })) {
                    added++;
                }
            }
            coverage.sharedPlatform += added;
        }
    }
    const capped = fitments.slice(0, maxRows);
    return {
        ranges: collapseYearRanges(capped),
        expandedRows: capped,
        tier,
        platformKey,
        generation,
        coverage,
    };
}
//# sourceMappingURL=mvl-fitment-expander.util.js.map