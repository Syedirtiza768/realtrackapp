import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultSourcePath = 'C:/Users/Irtiza Hassan/Downloads/B12_p2_eBay_Verified.xlsx';

const sourcePathInput = process.argv[2] || process.env.INVENTORY_XLSX_PATH || defaultSourcePath;
const sourcePath = path.resolve(sourcePathInput);

if (!fs.existsSync(sourcePath)) {
    console.error(`Inventory file not found: ${sourcePath}`);
    process.exit(1);
}

const workbook = XLSX.readFile(sourcePath, { cellDates: true });
if (workbook.SheetNames.length === 0) {
    console.error('No worksheets found in workbook.');
    process.exit(1);
}

const normalizeHeader = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const toText = (value) => String(value ?? '').trim();

const splitMulti = (value) =>
    toText(value)
        .split(/[|,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);

const toColumnLetter = (zeroBasedIndex) => {
    let index = zeroBasedIndex;
    let letters = '';

    while (index >= 0) {
        letters = String.fromCharCode((index % 26) + 65) + letters;
        index = Math.floor(index / 26) - 1;
    }

    return letters;
};

/** Known automotive OEM brands for auto-detection */
const KNOWN_BRANDS = new Map([
    // German
    ['mercedes', 'Mercedes-Benz'], ['mercedes-benz', 'Mercedes-Benz'], ['mercedesbenz', 'Mercedes-Benz'],
    ['bmw', 'BMW'], ['audi', 'Audi'], ['volkswagen', 'Volkswagen'], ['vw', 'Volkswagen'],
    ['porsche', 'Porsche'], ['opel', 'Opel'],
    // British
    ['jaguar', 'Jaguar'], ['land rover', 'Land Rover'], ['landrover', 'Land Rover'],
    ['range rover', 'Land Rover'], ['rangerover', 'Land Rover'],
    ['bentley', 'Bentley'], ['rolls-royce', 'Rolls-Royce'], ['rollsroyce', 'Rolls-Royce'],
    ['aston martin', 'Aston Martin'], ['astonmartin', 'Aston Martin'], ['mclaren', 'McLaren'],
    ['mini', 'MINI'], ['lotus', 'Lotus'],
    // American
    ['ford', 'Ford'], ['chevrolet', 'Chevrolet'], ['chevy', 'Chevrolet'],
    ['dodge', 'Dodge'], ['chrysler', 'Chrysler'], ['jeep', 'Jeep'],
    ['gmc', 'GMC'], ['cadillac', 'Cadillac'], ['lincoln', 'Lincoln'],
    ['buick', 'Buick'], ['tesla', 'Tesla'], ['ram', 'RAM'],
    // Japanese
    ['toyota', 'Toyota'], ['honda', 'Honda'], ['nissan', 'Nissan'],
    ['mazda', 'Mazda'], ['subaru', 'Subaru'], ['mitsubishi', 'Mitsubishi'],
    ['lexus', 'Lexus'], ['infiniti', 'Infiniti'], ['acura', 'Acura'],
    ['suzuki', 'Suzuki'], ['isuzu', 'Isuzu'],
    // Korean
    ['hyundai', 'Hyundai'], ['kia', 'Kia'], ['genesis', 'Genesis'],
    // Italian
    ['ferrari', 'Ferrari'], ['lamborghini', 'Lamborghini'], ['maserati', 'Maserati'],
    ['fiat', 'Fiat'], ['alfa romeo', 'Alfa Romeo'], ['alfaromeo', 'Alfa Romeo'],
    // Swedish
    ['volvo', 'Volvo'], ['saab', 'Saab'],
    // Aftermarket brands
    ['bosch', 'Bosch'], ['denso', 'Denso'], ['delphi', 'Delphi'],
    ['valeo', 'Valeo'], ['hella', 'Hella'], ['brembo', 'Brembo'],
    ['sachs', 'Sachs'], ['monroe', 'Monroe'], ['moog', 'Moog'],
    ['dorman', 'Dorman'], ['acdelco', 'ACDelco'], ['motorcraft', 'Motorcraft'],
    ['gates', 'Gates'], ['dayco', 'Dayco'], ['ngk', 'NGK'],
    ['aisin', 'Aisin'], ['continental', 'Continental'], ['trw', 'TRW'],
    ['febi', 'Febi Bilstein'], ['meyle', 'Meyle'], ['lemforder', 'Lemforder'],
    ['mahle', 'Mahle'], ['mann', 'Mann-Filter'], ['ate', 'ATE'],
    ['bilstein', 'Bilstein'], ['sachs', 'Sachs'], ['pierburg', 'Pierburg'],
]);

/**
 * Smart brand detection from title, description, and other fields.
 * 1. Scan all text for known brand names (multi-word aware)
 * 2. Extract from common patterns like "Genuine [Brand]" or "OEM [Brand]"
 * 3. Fall back to first alphabetic token from title
 */
const deriveBrandFromTitle = (title, description = '', specifics = '') => {
    const allText = `${toText(title)} ${toText(description)} ${toText(specifics)}`.toLowerCase();

    // 1. Check for known brands (try multi-word first, then single-word)
    for (const [key, brandName] of KNOWN_BRANDS) {
        if (key.includes(' ')) {
            // Multi-word brand: check as phrase
            if (allText.includes(key)) return brandName;
        }
    }
    for (const [key, brandName] of KNOWN_BRANDS) {
        if (!key.includes(' ')) {
            // Single-word brand: check as whole word
            const regex = new RegExp(`\\b${key}\\b`, 'i');
            if (regex.test(allText)) return brandName;
        }
    }

    // 2. Pattern-based extraction: "Genuine [Brand]", "OEM [Brand]", "by [Brand]"
    const patternMatch = allText.match(/(?:genuine|oem|original|by)\s+([a-z][a-z\-]+)/i);
    if (patternMatch) {
        const candidate = patternMatch[1].toLowerCase();
        if (KNOWN_BRANDS.has(candidate)) return KNOWN_BRANDS.get(candidate);
        if (candidate.length >= 3) return titleCase(candidate);
    }

    // 3. Fallback: first alphabetic token >= 2 chars from title only
    const tokens = toText(title).split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        const normalized = token.replace(/[^A-Za-z]/g, '');
        if (normalized.length >= 2) {
            return titleCase(normalized);
        }
    }
    return '';
};

const toSlug = (value) =>
    toText(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'catalog-item';

const parseNumber = (value, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : fallback;
};

const titleCase = (value) => {
    const input = toText(value);
    if (!input) {
        return '';
    }

    return input
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
};

const normalizeCondition = (raw) => {
    const value = toText(raw).toLowerCase();
    if (value.includes('new')) return 'new';
    if (value.includes('reman')) return 'remanufactured';
    if (value.includes('used')) return 'used';
    return 'new';
};

const normalizeShipping = (raw) => {
    const value = toText(raw).toLowerCase();
    if (value.includes('free')) return 'free';
    if (value.includes('freight') || value.includes('truck')) return 'freight';
    return 'calculated';
};

const normalizeSellerRating = (raw) => {
    const value = toText(raw).toLowerCase();
    if (value.includes('top')) return 'top_rated';
    if (value.includes('prem')) return 'premium';
    return 'standard';
};

const normalizeAvailability = (quantity, rawStatus) => {
    const status = toText(rawStatus).toLowerCase();
    if (status.includes('out')) return 'out_of_stock';
    if (status.includes('low')) return 'low_stock';
    if (quantity <= 0) return 'out_of_stock';
    if (quantity <= 10) return 'low_stock';
    return 'in_stock';
};

const choosePlacement = (title, category) => {
    const source = `${toText(title)} ${toText(category)}`.toLowerCase();
    if (source.includes('front left')) return 'Front Left';
    if (source.includes('front right')) return 'Front Right';
    if (source.includes('rear left')) return 'Rear Left';
    if (source.includes('rear right')) return 'Rear Right';
    if (source.includes('rear')) return 'Rear';
    if (source.includes('left')) return 'Left';
    if (source.includes('right')) return 'Right';
    if (source.includes('interior')) return 'Interior';
    return 'Front';
};

const chooseMaterial = (title, description) => {
    const source = `${toText(title)} ${toText(description)}`.toLowerCase();
    if (source.includes('plastic')) return 'ABS Plastic';
    if (source.includes('aluminum')) return 'Aluminum';
    if (source.includes('chrome')) return 'Chrome';
    if (source.includes('lcd') || source.includes('display')) return 'Composite';
    return 'Steel';
};

const chooseColor = (title, description) => {
    const source = `${toText(title)} ${toText(description)}`.toLowerCase();
    if (source.includes('black')) return 'Black';
    if (source.includes('silver')) return 'Silver';
    if (source.includes('gray') || source.includes('grey')) return 'Gray';
    if (source.includes('red')) return 'Red';
    return 'Black';
};

const stripHtml = (html) => toText(html).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const parseCompatibilityFromDescription = (descriptionHtml) => {
    const rows = [];
    const normalizedHtml = toText(descriptionHtml);
    if (!normalizedHtml) {
        return rows;
    }

    const tableRowRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/gi;
    let match;

    while ((match = tableRowRegex.exec(normalizedHtml)) !== null) {
        const make = titleCase(match[1]);
        const model = titleCase(match[2]);
        const yearToken = toText(match[3]);
        const yearMatch = yearToken.match(/(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}))?/);

        if (!make || !model || !yearMatch) {
            continue;
        }

        const startYear = Number(yearMatch[1]);
        const endYear = Number(yearMatch[2] || yearMatch[1]);
        for (let year = startYear; year <= endYear; year += 1) {
            rows.push({ year, make, model, trim: 'Base' });
        }
    }

    return rows;
};

const parseCompatibilityFromTitle = (title) => {
    const value = toText(title);
    const yearRangeMatch = value.match(/(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2})/);
    if (!yearRangeMatch) {
        return [];
    }

    const startYear = Number(yearRangeMatch[1]);
    const endYear = Number(yearRangeMatch[2]);

    const rightSegment = value.slice(yearRangeMatch.index + yearRangeMatch[0].length).trim();
    const tokens = rightSegment.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
        return [];
    }

    const make = titleCase(tokens[0]);
    const model = titleCase(tokens[1]);

    const entries = [];
    for (let year = startYear; year <= endYear; year += 1) {
        entries.push({ year, make, model, trim: 'Base' });
    }

    return entries;
};

const parsePartNumbers = (title, descriptionText, sku) => {
    const source = `${toText(title)} ${toText(descriptionText)} ${toText(sku)}`;
    const pattern = /\b[A-Z0-9]{4,}(?:[-/][A-Z0-9]{2,})*\b/g;
    const candidates = source.toUpperCase().match(pattern) || [];
    const unique = Array.from(new Set(candidates.filter(token => /\d/.test(token) && token.length <= 18)));
    return unique;
};

const detectListingsSheetName = () => {
    const candidate = workbook.SheetNames.find((name) => normalizeHeader(name).includes('listings'));
    return candidate || workbook.SheetNames[0];
};

const detectHeaderRow = (matrix) => {
    for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 25); rowIndex += 1) {
        const row = matrix[rowIndex] || [];
        const normalizedCells = row.map(cell => normalizeHeader(cell));
        const hasAction = normalizedCells.some(cell => cell.includes('action'));
        const hasTitle = normalizedCells.some(cell => cell === 'title');
        const hasPhoto = normalizedCells.some(cell => cell.includes('itemphotourl') || cell.includes('picurl'));

        if (hasAction && hasTitle && hasPhoto) {
            return rowIndex;
        }
    }

    return -1;
};

const listingsSheetName = detectListingsSheetName();
const worksheet = workbook.Sheets[listingsSheetName];
const matrixRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
const headerRowIndex = detectHeaderRow(matrixRows);

if (headerRowIndex < 0) {
    console.error(`Could not detect listing header row in sheet: ${listingsSheetName}`);
    process.exit(1);
}

const headerCells = matrixRows[headerRowIndex].map(cell => toText(cell));
const dataRows = matrixRows.slice(headerRowIndex + 1);

const rows = dataRows
    .filter(row => row.some(value => toText(value) !== ''))
    .map((row) => {
        const mapped = {};
        headerCells.forEach((header, index) => {
            const colLetter = toColumnLetter(index);
            mapped[`COL_${colLetter}`] = row[index] ?? '';
            mapped[`COLUMN_${colLetter}`] = row[index] ?? '';

            if (!header) {
                return;
            }
            mapped[header] = row[index] ?? '';

            const normalizedHeader = normalizeHeader(header);
            if (colLetter === 'C' && (normalizedHeader.includes('brand') || normalizedHeader === 'cbrand' || normalizedHeader === 'columncbrand')) {
                mapped.EXPLICIT_COLUMN_C_BRAND = row[index] ?? '';
            }
        });
        return mapped;
    })
    .filter((row) => {
        const actionKey = Object.keys(row).find(key => normalizeHeader(key).includes('action'));
        if (!actionKey) {
            return true;
        }
        const action = toText(row[actionKey]).toLowerCase();
        return action === 'add' || action === 'revise' || action === 'relist';
    });

const pickField = (row, aliases) => {
    const aliasSet = new Set(aliases.map((alias) => normalizeHeader(alias)));

    for (const [key, value] of Object.entries(row)) {
        if (aliasSet.has(normalizeHeader(key)) && toText(value)) {
            return value;
        }
    }

    return '';
};

const parseFitmentString = (fitmentValue) => {
    const fitment = toText(fitmentValue);
    if (!fitment) return null;

    const parts = fitment.split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;

    const year = Number(parts[0]);
    if (!Number.isInteger(year)) return null;

    const make = parts[1];
    const model = parts[2];
    const trim = parts.slice(3).join(' ') || 'Base';

    return { year, make, model, trim };
};

const imageFallback = 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80';

/**
 * Build an SEO-optimized title from item details instead of copy-pasting from description.
 * Format: [Brand] [Part Type] [Placement] [Key Detail] [MPN] [Fitment Summary]
 * Max 80 chars for eBay.
 */
const buildTitleFromDetails = ({
    rawTitle, brand, partType, placement, material, mpn, categoryName,
    yearRange, make, model, condition, descriptionText
}) => {
    // Extract part type from rawTitle or categoryName if not explicitly provided
    const inferredPartType = partType
        || extractPartTypeFromText(rawTitle)
        || extractPartTypeFromText(categoryName)
        || '';

    // Build segments in priority order
    const segments = [];

    // 1. Fitment: year+make+model (highest search value)
    if (yearRange) {
        segments.push(yearRange);
    } else if (make && model) {
        segments.push(`${make} ${model}`.trim());
    }

    // 2. Part type (core search term)
    if (inferredPartType) segments.push(inferredPartType);

    // 3. Placement
    if (placement && placement !== 'Front') segments.push(placement);

    // 4. Material if distinctive
    if (material && material !== 'Steel') segments.push(material);

    // 5. MPN/OEM number
    if (mpn) segments.push(mpn);

    // 6. Brand
    if (brand && brand !== 'Generic') segments.push(brand);

    // 7. Condition for used parts
    if (condition === 'used') segments.push('OEM');

    let title = segments.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    // If generated title is too short or meaningless, fallback to cleaned raw title
    if (title.length < 15 && rawTitle && rawTitle.length >= 10) {
        return rawTitle.slice(0, 80).trim();
    }

    return title.slice(0, 80).trim() || rawTitle.slice(0, 80).trim();
};

/** Extract a meaningful part type from free text (title or category). */
const PART_TYPE_PATTERNS = [
    /\b(headlight|headlamp)\s*(assembly)?/i,
    /\b(tail\s*light|taillight)\s*(assembly)?/i,
    /\b(fog\s*light|fog\s*lamp)/i,
    /\b(door\s*lock\s*actuator)/i,
    /\b(window\s*regulator)/i,
    /\b(control\s*arm)/i,
    /\b(wheel\s*hub|hub\s*bearing|hub\s*assembly)/i,
    /\b(brake\s*caliper)/i,
    /\b(brake\s*pad)s?/i,
    /\b(brake\s*rotor|brake\s*disc)/i,
    /\b(power\s*steering\s*pump)/i,
    /\b(steering\s*rack)/i,
    /\b(alternator)/i,
    /\b(starter\s*motor|starter)/i,
    /\b(radiator)/i,
    /\b(a\/?c\s*compressor|ac\s*compressor)/i,
    /\b(condenser)/i,
    /\b(blower\s*motor)/i,
    /\b(turbo|turbocharger)/i,
    /\b(exhaust\s*manifold)/i,
    /\b(catalytic\s*converter)/i,
    /\b(fuel\s*pump)/i,
    /\b(fuel\s*injector)/i,
    /\b(ignition\s*coil)/i,
    /\b(shock\s*absorber|strut)/i,
    /\b(mirror|side\s*mirror)/i,
    /\b(door\s*handle)/i,
    /\b(door\s*hinge)/i,
    /\b(fender|wing)/i,
    /\b(bumper)/i,
    /\b(grille|grill)/i,
    /\b(hood|bonnet)/i,
    /\b(trunk\s*lid|tailgate|liftgate)/i,
    /\b(seat\s*belt)/i,
    /\b(air\s*bag|airbag)/i,
    /\b(instrument\s*cluster|speedometer)/i,
    /\b(infotainment|head\s*unit|radio)/i,
    /\b(ecu|ecm|control\s*module)/i,
    /\b(wiring\s*harness)/i,
    /\b(cv\s*axle|drive\s*shaft)/i,
    /\b(water\s*pump)/i,
    /\b(thermostat)/i,
    /\b(sun\s*visor)/i,
    /\b(glove\s*box)/i,
    /\b(center\s*console)/i,
];

const extractPartTypeFromText = (text) => {
    const source = toText(text);
    if (!source) return '';
    for (const pattern of PART_TYPE_PATTERNS) {
        const match = source.match(pattern);
        if (match) return titleCase(match[0]);
    }
    return '';
};

const grouped = new Map();

rows.forEach((row, index) => {
    const sku = toText(pickField(row, ['custom label (sku)', 'custom label', 'sku', 'part sku', 'stock keeping unit', 'item number', 'item id'])) || `SKU-${index + 1}`;
    const rawTitle = toText(pickField(row, ['title', 'name', 'product name', 'listing title'])) || `Catalog Item ${index + 1}`;

    const quantity = parseNumber(pickField(row, ['quantity', 'qty', 'stock', 'available qty']), 0);
    const price = parseNumber(pickField(row, ['start price', 'buy it now price', 'price', 'unit price', 'sale price']), 0);

    const categoryName = toText(pickField(row, ['category name']));

    const make = toText(pickField(row, ['make', 'vehicle make']));
    const model = toText(pickField(row, ['model', 'vehicle model']));
    const trim = toText(pickField(row, ['trim', 'submodel'])) || 'Base';
    const year = parseNumber(pickField(row, ['year', 'vehicle year']), 0);

    const rawCompatibility = parseFitmentString(pickField(row, ['fitment', 'vehicle compatibility']));
    const compatibilityEntry = rawCompatibility
        || (year > 0 && make && model ? { year, make, model, trim } : null);

    const descriptionHtml = toText(pickField(row, ['description']));
    const descriptionText = stripHtml(descriptionHtml);

    const extractedPartNumbers = parsePartNumbers(rawTitle, descriptionText, sku);
    const oemParts = Array.from(new Set([
        ...splitMulti(pickField(row, ['oem', 'oem part number', 'oem part no', 'manufacturer part number', 'mpn'])),
        ...extractedPartNumbers,
    ]));
    const aftermarketParts = Array.from(new Set([
        ...splitMulti(pickField(row, ['aftermarket', 'aftermarket part number', 'part number'])),
        ...extractedPartNumbers,
    ]));

    const epids = splitMulti(pickField(row, ['epid', 'e pid', 'epid id']));
    const kTypes = splitMulti(pickField(row, ['ktype', 'k-type', 'k type']));

    const condition = normalizeCondition(pickField(row, ['condition id', 'condition']));
    const shippingType = normalizeShipping(pickField(row, ['shipping', 'shipping type']));
    const sellerRating = normalizeSellerRating(pickField(row, ['seller rating', 'seller tier']));
    const availability = normalizeAvailability(quantity, pickField(row, ['status', 'availability']));

    const parsedCompatibilityFromDescription = parseCompatibilityFromDescription(descriptionHtml);
    const parsedCompatibilityFromTitle = parseCompatibilityFromTitle(rawTitle);

    const allCompatibility = [
        ...(compatibilityEntry ? [compatibilityEntry] : []),
        ...parsedCompatibilityFromDescription,
        ...parsedCompatibilityFromTitle,
    ];

    const compatibility = [];
    const compatibilitySet = new Set();
    allCompatibility.forEach((entry) => {
        if (!entry || !entry.year || !entry.make || !entry.model) {
            return;
        }
        const key = `${entry.year}|${entry.make}|${entry.model}|${entry.trim || 'Base'}`;
        if (!compatibilitySet.has(key)) {
            compatibilitySet.add(key);
            compatibility.push({
                year: entry.year,
                make: titleCase(entry.make),
                model: titleCase(entry.model),
                trim: titleCase(entry.trim || 'Base'),
            });
        }
    });

    const inferredBrandFromCompatibility = compatibility[0]?.make || '';
    const explicitBrand = toText(pickField(row, ['brand', 'manufacturer', 'c:brand', 'column c:brand', 'column c brand', 'c brand', 'cbrand', 'columncbrand', 'explicit_column_c_brand']));
    const brand = titleCase(explicitBrand)
        || titleCase(inferredBrandFromCompatibility)
        || deriveBrandFromTitle(rawTitle, descriptionText, toText(pickField(row, ['c:manufacturer part number', 'mpn', 'oem part number'])))
        || 'Generic';
    const placement = choosePlacement(rawTitle, categoryName);
    const material = chooseMaterial(rawTitle, descriptionText);
    const color = chooseColor(rawTitle, descriptionText);
    const description = descriptionText || 'Imported from workbook source.';

    // Build year range for title from compatibility
    let yearRange = '';
    if (compatibility.length > 0) {
        const years = compatibility.map(c => c.year).filter(y => y > 0).sort((a, b) => a - b);
        if (years.length > 0) {
            const minY = years[0];
            const maxY = years[years.length - 1];
            const fitMake = compatibility[0].make;
            const fitModel = compatibility[0].model;
            yearRange = minY === maxY
                ? `${minY} ${fitMake} ${fitModel}`
                : `${minY}-${maxY} ${fitMake} ${fitModel}`;
        }
    }

    // Smart title: build from details instead of copy-pasting from description
    const mpn = oemParts[0] || '';
    const partType = toText(pickField(row, ['c:type', 'part type', 'type']));
    const title = buildTitleFromDetails({
        rawTitle, brand, partType, placement, material,
        mpn, categoryName, yearRange,
        make: compatibility[0]?.make || titleCase(make),
        model: compatibility[0]?.model || titleCase(model),
        condition, descriptionText,
    });

    const photoPipe = toText(pickField(row, ['item photo url', 'picurl', 'image', 'image url', 'photo']));
    const imageCandidates = splitMulti(photoPipe).filter((candidate) => /^https?:\/\//i.test(candidate));
    const imageUrl = imageCandidates[0] || imageFallback;

    const popularityScoreRaw = parseNumber(pickField(row, ['popularity', 'sold', 'sales rank', 'views']), 75);
    const popularityScore = Math.min(100, Math.max(1, Math.round(popularityScoreRaw)));

    const existing = grouped.get(sku);

    if (!existing) {
        grouped.set(sku, {
            id: String(grouped.size + 1),
            sku,
            slug: toSlug(`${brand} ${title}`),
            title,
            description,
            brand,
            placement,
            material,
            color,
            condition,
            shippingType,
            availability,
            sellerRating,
            price,
            quantity,
            popularityScore,
            imageUrl,
            oemPartNumbers: oemParts,
            aftermarketPartNumbers: aftermarketParts,
            epids,
            kTypes,
            compatibility,
        });
        return;
    }

    existing.quantity = Math.max(existing.quantity, quantity);
    existing.price = existing.price || price;
    existing.popularityScore = Math.max(existing.popularityScore, popularityScore);
    existing.availability = normalizeAvailability(existing.quantity, existing.availability);

    existing.oemPartNumbers = Array.from(new Set([...existing.oemPartNumbers, ...oemParts]));
    existing.aftermarketPartNumbers = Array.from(new Set([...existing.aftermarketPartNumbers, ...aftermarketParts]));
    existing.epids = Array.from(new Set([...existing.epids, ...epids]));
    existing.kTypes = Array.from(new Set([...existing.kTypes, ...kTypes]));

    if (existing.description.length < description.length) {
        existing.description = description;
    }

    if (existing.imageUrl === imageFallback && imageUrl !== imageFallback) {
        existing.imageUrl = imageUrl;
    }

    const existingKeys = new Set(existing.compatibility.map((fit) => `${fit.year}|${fit.make}|${fit.model}|${fit.trim}`));
    compatibility.forEach((entry) => {
        const compatibilityKey = `${entry.year}|${entry.make}|${entry.model}|${entry.trim}`;
        if (!existingKeys.has(compatibilityKey)) {
            existingKeys.add(compatibilityKey);
            existing.compatibility.push(entry);
        }
    });
});

const normalizedItems = Array.from(grouped.values()).map((item, index) => ({
    ...item,
    id: String(index + 1),
}));

const outputPath = path.join(projectRoot, 'src', 'data', 'generatedInventory.ts');

const sourceRelativePath = path.relative(projectRoot, sourcePath).replaceAll('\\', '/');

const output = `import { CatalogItem } from '../types/catalog';

export const GENERATED_INVENTORY_DATA: CatalogItem[] = ${JSON.stringify(normalizedItems, null, 4)};

export const GENERATED_IMPORT_META = {
    sourceFile: ${JSON.stringify(sourceRelativePath)},
    sourceSheet: ${JSON.stringify(listingsSheetName)},
    headerRowIndex: ${headerRowIndex},
    importedAt: ${JSON.stringify(new Date().toISOString())},
    rowCount: ${rows.length},
    groupedSkuCount: ${normalizedItems.length},
};
`;

fs.writeFileSync(outputPath, output, 'utf8');

console.log(`Imported ${rows.length} rows from ${sourcePath}`);
console.log(`Parsed sheet ${listingsSheetName} at header row ${headerRowIndex}`);
console.log(`Generated ${normalizedItems.length} normalized SKU records at src/data/generatedInventory.ts`);
