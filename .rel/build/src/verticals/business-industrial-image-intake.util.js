"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseInstanceFolderName = parseInstanceFolderName;
exports.normalizeImageIntakePartName = normalizeImageIntakePartName;
exports.partFolderFromRelativePath = partFolderFromRelativePath;
exports.isSupportedBusinessIndustrialImage = isSupportedBusinessIndustrialImage;
exports.safeIntakePath = safeIntakePath;
exports.normalizeDetectedBusinessIndustrialAttributes = normalizeDetectedBusinessIndustrialAttributes;
exports.applyBusinessIndustrialFulfillmentDefaults = applyBusinessIndustrialFulfillmentDefaults;
exports.mapWithConcurrency = mapWithConcurrency;
function parseInstanceFolderName(rawFolderName) {
    const raw = rawFolderName.trim();
    const match = /^(.*)\.(\d+)$/.exec(raw);
    return {
        rawFolderName: raw,
        baseFolderName: (match?.[1] ?? raw).trim(),
        instanceSuffix: match?.[2] ?? null,
    };
}
function normalizeImageIntakePartName(name) {
    return name
        .trim()
        .toLocaleLowerCase()
        .replace(/[\s\-_\/\\]+/g, '');
}
function partFolderFromRelativePath(relativePath, rootFolderName) {
    const parts = relativePath
        .split(/[\\/]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (rootFolderName &&
        parts[0]?.toLocaleLowerCase() === rootFolderName.trim().toLocaleLowerCase())
        parts.shift();
    return parts.length > 1
        ? parts[0]
        : rootFolderName?.trim() || parts[0] || 'Unassigned';
}
function isSupportedBusinessIndustrialImage(filename, mimeType) {
    if (mimeType?.toLocaleLowerCase().startsWith('image/'))
        return true;
    return /\.(avif|bmp|gif|heic|jpeg|jpg|png|tif|tiff|webp)$/i.test(filename);
}
function safeIntakePath(value) {
    const path = value.replace(/\\/g, '/').trim();
    if (!path ||
        path.includes('\0') ||
        path.startsWith('/') ||
        /^[A-Za-z]:/.test(path))
        throw new Error('Invalid image path');
    const segments = path.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..'))
        throw new Error('Invalid image path');
    return segments.join('/');
}
const DETECTED_NUMERIC_UNIT_PAIRS = [
    ['voltage', 'voltageUnit', ['V', 'kV', 'mV']],
    ['frequency', 'frequencyUnit', ['Hz', 'kHz', 'MHz']],
    ['current', 'currentUnit', ['A', 'mA', 'kA']],
    ['power', 'powerUnit', ['W', 'kW', 'MW', 'VA', 'kVA', 'HP']],
    ['capacity', 'capacityUnit', ['L', 'mL', 'gal', 'kg', 't', 'A·h', 'Ah']],
    ['pressure', 'pressureUnit', ['Pa', 'kPa', 'MPa', 'bar', 'psi']],
    ['weight', 'weightUnit', ['g', 'kg', 'lb', 'oz', 't']],
    ['dimensionsLength', 'dimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
    ['dimensionsWidth', 'dimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
    ['dimensionsHeight', 'dimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
    ['packedLength', 'packedDimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
    ['packedWidth', 'packedDimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
    ['packedHeight', 'packedDimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
    ['packedWeight', 'packedWeightUnit', ['kg', 'lb', 'oz', 't']],
    ['palletWeight', 'palletWeightUnit', ['kg', 'lb', 'oz', 't']],
    ['crateWeight', 'crateWeightUnit', ['kg', 'lb', 'oz', 't']],
];
function normalizeDetectedBusinessIndustrialAttributes(value) {
    const attributes = value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : {};
    for (const [valueKey, unitKey, units] of DETECTED_NUMERIC_UNIT_PAIRS) {
        if (!(valueKey in attributes))
            continue;
        const rawValue = attributes[valueKey];
        const rawUnit = attributes[unitKey];
        const numericValue = typeof rawValue === 'number'
            ? Number.isFinite(rawValue)
                ? rawValue
                : null
            : typeof rawValue === 'string' && rawValue.trim()
                ? Number(rawValue.trim())
                : null;
        if (numericValue !== null && rawUnit !== undefined && rawUnit !== '') {
            if (typeof rawUnit === 'string' && units.includes(rawUnit.trim())) {
                attributes[valueKey] = numericValue;
                attributes[unitKey] = rawUnit.trim();
                continue;
            }
        }
        if (typeof rawValue === 'string') {
            const match = /^\s*(-?\d+(?:\.\d+)?)\s*([^\s]+)\s*$/u.exec(rawValue);
            const parsedUnit = match?.[2];
            if (match &&
                parsedUnit &&
                units.includes(parsedUnit) &&
                Number(match[1]) >= 0) {
                attributes[valueKey] = Number(match[1]);
                attributes[unitKey] = parsedUnit;
                continue;
            }
        }
        const observedValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        if (observedValue !== undefined &&
            observedValue !== null &&
            observedValue !== '')
            attributes[valueKey + 'Observed'] = observedValue;
        delete attributes[valueKey];
        delete attributes[unitKey];
    }
    return attributes;
}
function applyBusinessIndustrialFulfillmentDefaults(value, defaults = {}) {
    const attributes = { ...value };
    const shippingMode = typeof attributes.shippingMode === 'string' && attributes.shippingMode
        ? attributes.shippingMode
        : 'parcel';
    attributes.shippingMode = shippingMode;
    attributes.dispatchLocation =
        attributes.dispatchLocation || defaults.dispatchLocation || 'United States';
    attributes.shippingCoverage =
        attributes.shippingCoverage || defaults.shippingCoverage || 'United States';
    if (shippingMode !== 'parcel')
        return attributes;
    const dimensionsUnit = typeof attributes.dimensionsUnit === 'string'
        ? attributes.dimensionsUnit
        : undefined;
    const weightUnit = typeof attributes.weightUnit === 'string' ? attributes.weightUnit : undefined;
    attributes.packedLength =
        attributes.packedLength ?? attributes.dimensionsLength ?? defaults.packedLength ?? 12;
    attributes.packedWidth =
        attributes.packedWidth ?? attributes.dimensionsWidth ?? defaults.packedWidth ?? 10;
    attributes.packedHeight =
        attributes.packedHeight ?? attributes.dimensionsHeight ?? defaults.packedHeight ?? 8;
    attributes.packedDimensionsUnit =
        attributes.packedDimensionsUnit ?? dimensionsUnit ?? defaults.packedDimensionsUnit ?? 'in';
    attributes.packedWeight =
        attributes.packedWeight ?? attributes.weight ?? defaults.packedWeight ?? 5;
    attributes.packedWeightUnit =
        attributes.packedWeightUnit ?? weightUnit ?? defaults.packedWeightUnit ?? 'lb';
    return attributes;
}
async function mapWithConcurrency(items, concurrency, mapper) {
    if (!items.length)
        return [];
    const workerCount = Math.min(items.length, Math.max(1, Math.floor(Number(concurrency) || 1)));
    const results = new Array(items.length);
    let nextIndex = 0;
    const worker = async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length)
                return;
            results[index] = await mapper(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
//# sourceMappingURL=business-industrial-image-intake.util.js.map