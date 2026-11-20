"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFitmentValidationStatus = getFitmentValidationStatus;
exports.isUnpublishableFitmentRow = isUnpublishableFitmentRow;
exports.selectPublishFitmentSource = selectPublishFitmentSource;
exports.pickCanonicalPropertyValue = pickCanonicalPropertyValue;
exports.parseFitmentEntry = parseFitmentEntry;
exports.isSameMakeVariant = isSameMakeVariant;
exports.fitmentDataToCompatibilityPayload = fitmentDataToCompatibilityPayload;
exports.compatibilityHasOptionalFields = compatibilityHasOptionalFields;
exports.toCoreCompatibilityPayload = toCoreCompatibilityPayload;
exports.serializeValidatedFitmentRow = serializeValidatedFitmentRow;
const MAX_YEAR_RANGE_SPAN = 100;
const MIN_VALID_YEAR = 1900;
function getString(raw, keys) {
    for (const key of keys) {
        const rawValue = raw[key];
        if (rawValue == null)
            continue;
        if (typeof rawValue !== 'string' &&
            typeof rawValue !== 'number' &&
            typeof rawValue !== 'boolean') {
            continue;
        }
        const value = String(rawValue).trim();
        if (value)
            return value;
    }
    return '';
}
function getFitmentValidationStatus(raw) {
    return getString(raw, [
        'MvlStatus',
        'mvlStatus',
        'validationStatus',
        'ValidationStatus',
    ]).toLowerCase();
}
function isUnpublishableFitmentRow(raw) {
    const status = getFitmentValidationStatus(raw);
    return status === 'rejected' || status === 'needs_review';
}
function selectPublishFitmentSource(fitmentData, fitmentRows, options) {
    const rows = Array.isArray(fitmentRows) ? fitmentRows : [];
    const data = Array.isArray(fitmentData) ? fitmentData : [];
    const validRows = rows.filter((row) => getFitmentValidationStatus(row) === 'valid');
    if (validRows.length > 0)
        return validRows;
    const validData = data.filter((row) => getFitmentValidationStatus(row) === 'valid');
    if (validData.length > 0)
        return validData;
    const hasStatusTaggedRows = rows.some((row) => Boolean(getFitmentValidationStatus(row))) ||
        data.some((row) => Boolean(getFitmentValidationStatus(row)));
    if (hasStatusTaggedRows) {
        return undefined;
    }
    if (options?.requireValidated)
        return undefined;
    if (data.length > 0)
        return data;
    if (rows.length > 0)
        return rows;
    return undefined;
}
function pickCanonicalPropertyValue(options, query) {
    const q = query.trim().toLowerCase();
    if (!q || options.length === 0)
        return undefined;
    const exact = options.find((o) => o.value.toLowerCase() === q);
    if (exact)
        return exact.value;
    if (q.length < 3)
        return undefined;
    const prefix = options.find((o) => o.value.toLowerCase().startsWith(q));
    if (prefix)
        return prefix.value;
    if (q.length >= 4) {
        const contains = options.find((o) => o.value.toLowerCase().includes(q));
        return contains?.value;
    }
    return undefined;
}
function resolveYears(raw) {
    const single = getString(raw, ['Year', 'year']);
    if (single) {
        const yearNum = Number(single);
        if (Number.isFinite(yearNum) && yearNum >= MIN_VALID_YEAR) {
            return [String(yearNum)];
        }
    }
    const startRaw = raw['yearStart'] ?? raw['YearStart'];
    const endRaw = raw['yearEnd'] ?? raw['YearEnd'];
    if (startRaw == null || endRaw == null)
        return [];
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (!Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < MIN_VALID_YEAR ||
        end < start ||
        end - start > MAX_YEAR_RANGE_SPAN) {
        return [];
    }
    const years = [];
    for (let y = start; y <= end; y++) {
        years.push(String(y));
    }
    return years;
}
function normalizeNoteValue(value) {
    if (value == null)
        return undefined;
    if (typeof value === 'string') {
        return value.trim() || undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim() || undefined;
    }
    return undefined;
}
function normalizeNotes(raw) {
    const value = raw['Notes'] ?? raw['notes'];
    if (value == null)
        return undefined;
    if (Array.isArray(value)) {
        const joined = value
            .map((v) => normalizeNoteValue(v))
            .filter((v) => Boolean(v))
            .join('; ');
        return joined || undefined;
    }
    return normalizeNoteValue(value);
}
function parseFitmentEntry(raw) {
    const make = getString(raw, ['Make', 'make']);
    const model = getString(raw, ['Model', 'model']);
    const year = getString(raw, ['Year', 'year']);
    if (!make || !model || !year)
        return null;
    const yearNum = Number(year);
    if (!Number.isFinite(yearNum) || yearNum < MIN_VALID_YEAR)
        return null;
    const trim = getString(raw, ['Trim', 'trim']) || undefined;
    const engine = getString(raw, ['Engine', 'engine']) || undefined;
    const submodel = getString(raw, ['Submodel', 'submodel', 'SubModel']) || undefined;
    const notes = normalizeNotes(raw);
    return { year, make, model, trim, engine, submodel, notes };
}
function normalizeMakeForComparison(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function levenshteinDistance(a, b) {
    if (a === b)
        return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++)
        dp[j] = j;
    for (let i = 1; i <= m; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const temp = dp[j];
            dp[j] =
                a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
            prev = temp;
        }
    }
    return dp[n];
}
function isSameMakeVariant(rawBrand, fitmentMake) {
    const a = normalizeMakeForComparison(rawBrand);
    const b = normalizeMakeForComparison(fitmentMake);
    if (!a || !b)
        return false;
    if (a === b || a.includes(b) || b.includes(a))
        return true;
    const maxLen = Math.max(a.length, b.length);
    return levenshteinDistance(a, b) <= Math.min(3, Math.ceil(maxLen * 0.3));
}
function fitmentDataToCompatibilityPayload(fitmentData, options) {
    if (!Array.isArray(fitmentData) || fitmentData.length === 0)
        return undefined;
    const compatibleProducts = [];
    const seenRows = new Set();
    const excludeRejected = options?.excludeRejected !== false;
    const excludeNeedsReview = options?.excludeNeedsReview !== false;
    for (const raw of fitmentData) {
        const status = getFitmentValidationStatus(raw);
        if (excludeRejected && status === 'rejected')
            continue;
        if (excludeNeedsReview && status === 'needs_review')
            continue;
        const make = getString(raw, ['Make', 'make']);
        const model = getString(raw, ['Model', 'model']);
        const years = resolveYears(raw);
        if (!make || !model || years.length === 0)
            continue;
        const trim = getString(raw, ['Trim', 'trim']) || undefined;
        const engine = getString(raw, ['Engine', 'engine']) || undefined;
        const notes = normalizeNotes(raw);
        for (const year of years) {
            const properties = [
                { name: 'Make', value: make },
                { name: 'Model', value: model },
                { name: 'Year', value: year },
            ];
            if (trim)
                properties.push({ name: 'Trim', value: trim });
            if (engine)
                properties.push({ name: 'Engine', value: engine });
            const rowKey = properties
                .map((property) => `${property.name}:${property.value}`)
                .join('|');
            if (seenRows.has(rowKey))
                continue;
            seenRows.add(rowKey);
            compatibleProducts.push({
                compatibilityProperties: properties,
                ...(notes ? { notes } : {}),
            });
        }
    }
    if (compatibleProducts.length === 0)
        return undefined;
    return { compatibleProducts };
}
const CORE_COMPATIBILITY_PROPERTY_NAMES = new Set(['make', 'model', 'year']);
function propertyByName(row, name) {
    const wanted = name.toLowerCase();
    for (const property of row.compatibilityProperties ?? []) {
        if (property.name.trim().toLowerCase() !== wanted)
            continue;
        const value = property.value?.trim();
        if (value)
            return value;
    }
    return '';
}
function compatibilityHasOptionalFields(payload) {
    for (const row of payload?.compatibleProducts ?? []) {
        if (row.notes?.trim())
            return true;
        for (const property of row.compatibilityProperties ?? []) {
            const name = property.name.trim().toLowerCase();
            if (name && !CORE_COMPATIBILITY_PROPERTY_NAMES.has(name))
                return true;
        }
    }
    return false;
}
function toCoreCompatibilityPayload(payload) {
    if (!payload?.compatibleProducts?.length)
        return undefined;
    const seenRows = new Set();
    const compatibleProducts = [];
    for (const row of payload.compatibleProducts) {
        const make = propertyByName(row, 'Make');
        const model = propertyByName(row, 'Model');
        const year = propertyByName(row, 'Year');
        if (!make || !model || !year)
            continue;
        const rowKey = `make:${make.toLowerCase()}|model:${model.toLowerCase()}|year:${year.toLowerCase()}`;
        if (seenRows.has(rowKey))
            continue;
        seenRows.add(rowKey);
        compatibleProducts.push({
            compatibilityProperties: [
                { name: 'Make', value: make },
                { name: 'Model', value: model },
                { name: 'Year', value: year },
            ],
        });
    }
    if (compatibleProducts.length === 0)
        return undefined;
    return { compatibleProducts };
}
function serializeValidatedFitmentRow(row, mvlStatus, extra) {
    return {
        Year: row.year,
        Make: row.make,
        Model: row.model,
        ...(row.trim ? { Trim: row.trim } : {}),
        ...(row.engine ? { Engine: row.engine } : {}),
        ...(row.submodel ? { Submodel: row.submodel } : {}),
        ...(row.notes ? { Notes: row.notes } : {}),
        MvlStatus: mvlStatus,
        ...extra,
    };
}
//# sourceMappingURL=fitment-mvl.util.js.map