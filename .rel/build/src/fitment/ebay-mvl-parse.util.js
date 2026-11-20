"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMvlMarketplaceFromFileName = detectMvlMarketplaceFromFileName;
exports.detectMvlDataSheetName = detectMvlDataSheetName;
exports.extractVersionLabel = extractVersionLabel;
exports.expandYearsFromValue = expandYearsFromValue;
exports.expandYearsFromDePeriod = expandYearsFromDePeriod;
exports.parseUsMvlRow = parseUsMvlRow;
exports.parseAuMvlRow = parseAuMvlRow;
exports.parseUkMvlRow = parseUkMvlRow;
exports.parseDeMvlRow = parseDeMvlRow;
exports.parseMvlSheetRows = parseMvlSheetRows;
const DATA_SHEET_PATTERNS = [
    { marketplace: 'US', test: /^US_MVL_/i },
    { marketplace: 'AU', test: /^AU_MVL_/i },
    { marketplace: 'DE', test: /^DE_MVL_/i },
    { marketplace: 'GB', test: /^UK_MVL_/i },
];
const FILE_MARKETPLACE_PATTERNS = [
    { marketplace: 'US', test: /(?:^|[_\-\s])US[_\-\s]?MVL/i },
    {
        marketplace: 'AU',
        test: /(?:^|[_\-\s])AU[_\-\s]?MVL|eBay[-_]AU|AU_Master_Vehicle/i,
    },
    { marketplace: 'DE', test: /(?:^|[_\-\s])DE[_\-\s]?MVL/i },
    { marketplace: 'GB', test: /(?:^|[_\-\s])UK[_\-\s]?MVL/i },
];
function detectMvlMarketplaceFromFileName(fileName) {
    for (const { marketplace, test } of FILE_MARKETPLACE_PATTERNS) {
        if (test.test(fileName))
            return marketplace;
    }
    return null;
}
function detectMvlDataSheetName(sheetNames, fileName) {
    for (const sheetName of sheetNames) {
        for (const { marketplace, test } of DATA_SHEET_PATTERNS) {
            if (test.test(sheetName)) {
                return { marketplace, sheetName };
            }
        }
    }
    const fromFile = detectMvlMarketplaceFromFileName(fileName);
    if (!fromFile)
        return null;
    const fallback = sheetNames.find((name) => !/agreement|nutzungsbedingungen|deletion|delete/i.test(name) &&
        name.trim().length > 0);
    return fallback ? { marketplace: fromFile, sheetName: fallback } : null;
}
function extractVersionLabel(fileName, sheetName) {
    const fromSheet = sheetName.match(/(US|AU|DE|UK)_MVL_[\w.]+/i)?.[0];
    if (fromSheet)
        return fromSheet.replace(/^UK_/i, 'GB_');
    const fromFile = fileName.match(/(US|AU|DE|UK)_MVL_[\w.]+/i)?.[0];
    if (fromFile)
        return fromFile.replace(/^UK_/i, 'GB_');
    return sheetName;
}
function clean(value) {
    return String(value ?? '').trim();
}
function isBlank(value) {
    const v = clean(value);
    return !v || v === '--' || v === 'N/A';
}
function expandYearsFromValue(raw) {
    const text = clean(raw);
    if (!text)
        return [];
    if (text.includes('|')) {
        return text
            .split('|')
            .map((part) => parseInt(part.trim(), 10))
            .filter((y) => Number.isFinite(y) && y >= 1900 && y <= 2100);
    }
    const single = parseInt(text, 10);
    if (Number.isFinite(single) && single >= 1900 && single <= 2100) {
        return [single];
    }
    return [];
}
function expandYearsFromDePeriod(period) {
    const text = clean(period);
    if (!text || text === '--')
        return [];
    const match = text.match(/^(\d{4})\/\d{2}-(\d{4})\/\d{2}$/);
    if (!match)
        return [];
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return [];
    }
    const years = [];
    for (let y = start; y <= end; y++)
        years.push(y);
    return years;
}
function rowToMap(headers, row) {
    const out = {};
    for (let i = 0; i < headers.length; i++) {
        const key = clean(headers[i]);
        if (!key)
            continue;
        out[key] = clean(row[i]);
    }
    return out;
}
function entriesForYears(base, years) {
    return years.map((year) => ({ ...base, year }));
}
function parseUsMvlRow(row) {
    const make = clean(row.Make);
    const model = clean(row.Model);
    const years = expandYearsFromValue(row.Year);
    if (!make || !model || years.length === 0)
        return [];
    const trim = !isBlank(row.Trim) ? clean(row.Trim) : undefined;
    const engine = !isBlank(row.Engine) ? clean(row.Engine) : undefined;
    const submodel = !isBlank(row.Submodel) ? clean(row.Submodel) : undefined;
    return entriesForYears({
        epid: !isBlank(row.ePID) ? clean(row.ePID) : undefined,
        make,
        model,
        trim,
        engine,
        submodel,
        body: !isBlank(row.Body) ? clean(row.Body) : undefined,
        displayName: !isBlank(row.DisplayName)
            ? clean(row.DisplayName)
            : undefined,
        extras: {
            aspiration: row.Aspiration || undefined,
            driveType: row['Drive Type'] || undefined,
            fuelType: row['Fuel Type Name'] || undefined,
            partsModel: row['Parts Model'] || undefined,
            region: row.Region || undefined,
        },
    }, years);
}
function parseAuMvlRow(row) {
    const make = clean(row.Make);
    const model = clean(row.Model);
    const years = expandYearsFromValue(row.Year);
    if (!make || !model || years.length === 0)
        return [];
    return entriesForYears({
        epid: !isBlank(row.ePID) ? clean(row.ePID) : undefined,
        make,
        model,
        trim: !isBlank(row.Submodel) ? clean(row.Submodel) : undefined,
        submodel: !isBlank(row.Submodel) ? clean(row.Submodel) : undefined,
        variant: !isBlank(row.Variant) ? clean(row.Variant) : undefined,
        platform: !isBlank(row.Plat_Gen) ? clean(row.Plat_Gen) : undefined,
        engine: !isBlank(row.Engine) ? clean(row.Engine) : undefined,
        body: !isBlank(row.Body) ? clean(row.Body) : undefined,
        ktype: !isBlank(row.Ktype) ? clean(row.Ktype) : undefined,
        extras: {
            type: row.Type || undefined,
            relationship: row.Relationship || undefined,
        },
    }, years);
}
function parseUkMvlRow(row) {
    const make = clean(row.Make);
    const model = clean(row.Model);
    const years = expandYearsFromValue(row.Year);
    if (!make || !model || years.length === 0)
        return [];
    return entriesForYears({
        make,
        model,
        variant: !isBlank(row.Variant) ? clean(row.Variant) : undefined,
        body: !isBlank(row.BodyStyle) ? clean(row.BodyStyle) : undefined,
        trim: !isBlank(row.Type) ? clean(row.Type) : undefined,
        engine: !isBlank(row.Engine) ? clean(row.Engine) : undefined,
        ktype: !isBlank(row['K-Type']) ? clean(row['K-Type']) : undefined,
        extras: {
            additions: row['Additions (I) / Updates (U)'] || undefined,
        },
    }, years);
}
function parseDeMvlRow(row) {
    const make = clean(row.Marke_Make_EN || row.Make);
    const model = clean(row.Modell_Model_EN || row.Model);
    const years = expandYearsFromDePeriod(row.Baujahr_ProductionPeriod_EN || row.Year);
    if (!make || !model || years.length === 0)
        return [];
    return entriesForYears({
        make,
        model,
        trim: !isBlank(row.Typ_Type_EN) ? clean(row.Typ_Type_EN) : undefined,
        platform: !isBlank(row.Plattform_Platform_EN)
            ? clean(row.Plattform_Platform_EN)
            : undefined,
        engine: !isBlank(row.Motor_Engine_EN)
            ? clean(row.Motor_Engine_EN)
            : undefined,
        ktype: !isBlank(row['K-Type']) ? clean(row['K-Type']) : undefined,
        extras: {
            hsnTsn: row.HSN_TSN_nur_zur_Hilfe || undefined,
            additions: row.Ergaenzungen_mit_I_nur_zur_Hilfe || undefined,
        },
    }, years);
}
function parseMvlSheetRows(marketplace, headers, rows) {
    const parser = marketplace === 'US'
        ? parseUsMvlRow
        : marketplace === 'AU'
            ? parseAuMvlRow
            : marketplace === 'DE'
                ? parseDeMvlRow
                : parseUkMvlRow;
    const parsed = [];
    for (const row of rows) {
        if (!row?.some((cell) => clean(cell)))
            continue;
        const map = rowToMap(headers, row);
        parsed.push(...parser(map));
    }
    return parsed;
}
//# sourceMappingURL=ebay-mvl-parse.util.js.map