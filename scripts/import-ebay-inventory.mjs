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

const deriveBrandFromTitle = (title) => {
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

const grouped = new Map();

rows.forEach((row, index) => {
    const sku = toText(pickField(row, ['custom label (sku)', 'custom label', 'sku', 'part sku', 'stock keeping unit', 'item number', 'item id'])) || `SKU-${index + 1}`;
    const title = toText(pickField(row, ['title', 'name', 'product name', 'listing title'])) || `Catalog Item ${index + 1}`;

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

    const extractedPartNumbers = parsePartNumbers(title, descriptionText, sku);
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
    const parsedCompatibilityFromTitle = parseCompatibilityFromTitle(title);

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
    const brand = titleCase(pickField(row, ['brand', 'manufacturer', 'c:brand', 'column c:brand', 'column c brand', 'c brand', 'cbrand', 'columncbrand', 'explicit_column_c_brand']))
        || titleCase(inferredBrandFromCompatibility)
        || deriveBrandFromTitle(title)
        || 'Generic';
    const placement = choosePlacement(title, categoryName);
    const material = chooseMaterial(title, descriptionText);
    const color = chooseColor(title, descriptionText);
    const description = descriptionText || 'Imported from workbook source.';

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
