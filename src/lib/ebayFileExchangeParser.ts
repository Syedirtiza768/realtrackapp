/**
 * Parser for eBay File Exchange CSV format (pipeline output).
 * Extracts product listings with their compatibility/fitment rows.
 */

export interface EbayListing {
  action: string;
  customLabel: string;
  category: string;
  title: string;
  price: string;
  quantity: string;
  imageUrls: string[];
  conditionId: string;
  conditionLabel: string;
  description: string;
  format: string;
  duration: string;
  location: string;
  brand: string;
  type: string;
  placement: string;
  material: string;
  features: string;
  countryOfManufacture: string;
  mpn: string;
  oemPartNumber: string;
  shippingProfile: string;
  returnProfile: string;
  paymentProfile: string;
  itemSpecifics: { label: string; value: string }[];
  compatibility: { make: string; model: string; year: string }[];
}

export interface ListingWarning {
  rowIndex: number;
  customLabel: string;
  issues: string[];
}

export interface ParseResult {
  listings: EbayListing[];
  skippedListings: EbayListing[];
  warnings: ListingWarning[];
  totalRows: number;
  compatibilityRows: number;
  errors: string[];
}

/** Simple CSV line parser that handles quoted fields with commas and escaped quotes */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let currentField = '';
  let currentRecord: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      currentRecord.push(currentField);
      currentField = '';
      continue;
    }

    if (ch === '\r') {
      if (next === '\n') {
        i++;
      }
      currentRecord.push(currentField);
      records.push(currentRecord);
      currentField = '';
      currentRecord = [];
      continue;
    }

    if (ch === '\n') {
      currentRecord.push(currentField);
      records.push(currentRecord);
      currentField = '';
      currentRecord = [];
      continue;
    }

    currentField += ch;
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  return records.filter((record) => record.some((field) => field.trim() !== ''));
}

function cleanHeader(header: string): string {
  return header
    .replace(/^\*/, '')
    .replace(/^C:/i, '')
    .trim();
}

function buildItemSpecifics(headers: string[], fields: string[]): { label: string; value: string }[] {
  const specifics: { label: string; value: string }[] = [];

  headers.forEach((header, index) => {
    const rawValue = fields[index]?.trim();
    if (!rawValue) {
      return;
    }

    const normalizedHeader = cleanHeader(header);
    if (!normalizedHeader || !header.startsWith('C:')) {
      return;
    }

    specifics.push({ label: normalizedHeader, value: rawValue });
  });

  return specifics;
}

function parseCondition(raw: string): { id: string; label: string } {
  if (!raw) return { id: '', label: '' };
  const match = raw.match(/^(\d+)-?(.*)$/);
  if (match) {
    return { id: match[1], label: match[2] || conditionMap[match[1]] || 'Unknown' };
  }
  return { id: raw, label: raw };
}

const conditionMap: Record<string, string> = {
  '1000': 'New',
  '1500': 'New Other',
  '2000': 'Certified Refurbished',
  '2500': 'Seller Refurbished',
  '3000': 'Used',
  '4000': 'Very Good',
  '5000': 'Good',
  '6000': 'Acceptable',
  '7000': 'For Parts or Not Working',
};

function parseCompatibility(details: string): { make: string; model: string; year: string } {
  const parts: Record<string, string> = {};
  details.split('|').forEach((pair) => {
    const [key, ...rest] = pair.split('=');
    if (key && rest.length) parts[key.trim()] = rest.join('=').trim();
  });
  return {
    make: parts['Make'] || '',
    model: parts['Model'] || '',
    year: parts['Year'] || '',
  };
}

/** Normalise a header string for lookup matching.
 *  Strips leading *, trailing spaces, parenthesised metadata (e.g. "(SiteID=…)"),
 *  and treats "C:Foo" as "foo" and "*Action(…)" as "action".
 */
function normalizeHeaderKey(h: string): string {
  return h
    .replace(/\(.*?\)/g, '')  // strip (SiteID=…) etc.
    .replace(/^\*/, '')        // strip leading *
    .replace(/^C:/i, '')       // strip C: prefix
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');      // collapse spaces: "Start Price" → "startprice"
}

/** Build a header→index lookup from the header row. */
function buildColMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const key = normalizeHeaderKey(h);
    if (key) map[key] = i;
  });
  return map;
}

/** Get a value from fields by header name, with silent fallback. */
function col(fields: string[], map: Record<string, number>, ...names: string[]): string {
  for (const name of names) {
    const idx = map[name.toLowerCase().replace(/\s+/g, '')];
    if (idx !== undefined && fields[idx] !== undefined) return fields[idx].trim();
  }
  return '';
}

export function parseEbayFileExchangeCsv(csvText: string): ParseResult {
  console.log('[Parser] Input length:', csvText.length, 'chars, first 120:', JSON.stringify(csvText.slice(0, 120)));
  const records = parseCsvRecords(csvText);
  const errors: string[] = [];
  const warnings: ListingWarning[] = [];
  let compatibilityRows = 0;

  console.log('[Parser] Records:', records.length, 'first record cells:', records[0]?.length, 'first cell:', JSON.stringify(records[0]?.[0]?.slice(0, 40)));

  // Strip BOM if present
  if (records[0]?.[0]?.charCodeAt(0) === 0xfeff) {
    records[0][0] = records[0][0].slice(1);
  }

  if (records.length < 2) {
    return { listings: [], skippedListings: [], warnings: [], totalRows: 0, compatibilityRows: 0, errors: ['File has too few rows'] };
  }

  // Auto-detect header row by scanning for the first row that contains
  // known eBay column names (Action, Title, StartPrice, etc.).
  // Metadata/info rows (Info, #INFO, etc.) are skipped automatically.
  const KNOWN_HEADERS = ['action', 'title', 'startprice', 'customlabel', 'category', 'picurl', 'itemphotourl', 'conditionid', 'description', 'format'];

  function isHeaderRow(row: string[]): boolean {
    const normalised = row.map(h => normalizeHeaderKey(h));
    const matches = KNOWN_HEADERS.filter(k => normalised.includes(k));
    return matches.length >= 3; // at least 3 known columns
  }

  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(records.length, 10); r++) {
    if (isHeaderRow(records[r])) {
      headerRowIndex = r;
      break;
    }
  }

  // Fallback: if no header row found, use legacy heuristic
  if (headerRowIndex === -1) {
    const firstCell = records[0][0]?.trim().toLowerCase().replace(/^#/, '') ?? '';
    const hasInfoRow = firstCell === 'info' || firstCell.startsWith('info,');
    headerRowIndex = hasInfoRow ? 1 : 0;
  }

  const dataStartIndex = headerRowIndex + 1;

  console.log('[Parser] headerRowIndex:', headerRowIndex, 'dataStartIndex:', dataStartIndex);

  if (records.length <= dataStartIndex) {
    return { listings: [], skippedListings: [], warnings: [], totalRows: 0, compatibilityRows: 0, errors: ['File has no data rows'] };
  }

  const rawHeaders = records[headerRowIndex].map((h) => h.trim());
  const colMap = buildColMap(rawHeaders);
  console.log('[Parser] Headers:', rawHeaders.length, 'colMap keys:', Object.keys(colMap).join(', '));
  console.log('[Parser] action idx:', colMap['action'], 'title idx:', colMap['title'], 'startprice idx:', colMap['startprice']);
  const listings: EbayListing[] = [];
  const skippedListings: EbayListing[] = [];
  let currentListing: EbayListing | null = null;

  for (let i = dataStartIndex; i < records.length; i++) {
    const fields = records[i];
    if (!fields.length) continue;

    const action      = col(fields, colMap, 'action').toLowerCase();
    const relationship = col(fields, colMap, 'relationship');

    if (relationship === 'Compatibility') {
      compatibilityRows++;
      if (currentListing) {
        const details = col(fields, colMap, 'relationshipdetails');
        if (details) currentListing.compatibility.push(parseCompatibility(details));
      }
      continue;
    }

    if (action && action !== 'info') {
      // Resolve common header aliases for price and images
      const priceRaw  = col(fields, colMap, 'startprice', 'price', 'buynow price', 'buy it now price', 'buyitnowprice');
      const imageRaw  = col(fields, colMap, 'picurl', 'pictureurl', 'picture url', 'imageurl', 'image url', 'images', 'itemphotourl', 'item photo url', 'photourl', 'photo url');
      const condRaw   = col(fields, colMap, 'conditionid', 'condition id', 'condition');
      const condParsed = parseCondition(condRaw);

      currentListing = {
        action: col(fields, colMap, 'action'),
        customLabel:         col(fields, colMap, 'customlabel', 'custom label', 'sku', 'item sku'),
        category:            col(fields, colMap, 'category', 'categoryid', 'category id'),
        title:               col(fields, colMap, 'title'),
        price:               priceRaw,
        quantity:            col(fields, colMap, 'quantity'),
        imageUrls:           imageRaw ? imageRaw.split('|').filter(Boolean) : [],
        conditionId:         condParsed.id,
        conditionLabel:      condParsed.label,
        description:         col(fields, colMap, 'description'),
        format:              col(fields, colMap, 'format'),
        duration:            col(fields, colMap, 'duration'),
        location:            col(fields, colMap, 'location'),
        brand:               col(fields, colMap, 'brand'),
        type:                col(fields, colMap, 'type'),
        placement:           col(fields, colMap, 'placement on vehicle', 'placementonvehicle', 'placement'),
        material:            col(fields, colMap, 'material'),
        features:            col(fields, colMap, 'features'),
        countryOfManufacture: col(fields, colMap, 'country/region of manufacture', 'country of manufacture', 'countryofmanufacture'),
        mpn:                 col(fields, colMap, 'manufacturer part number', 'manufacturerpartnumber', 'mpn'),
        oemPartNumber:       col(fields, colMap, 'oe/oem part number', 'oem part number', 'oempartnumber'),
        shippingProfile:     col(fields, colMap, 'shippingprofilename', 'shipping profile'),
        returnProfile:       col(fields, colMap, 'returnprofilename', 'return profile'),
        paymentProfile:      col(fields, colMap, 'paymentprofilename', 'payment profile'),
        itemSpecifics:       buildItemSpecifics(rawHeaders, fields),
        compatibility:       [],
      };

      // Validate required fields
      const issues: string[] = [];
      if (!currentListing.title.trim()) issues.push('Missing title');
      if (!currentListing.price.trim()) issues.push('Missing price');
      if (!currentListing.category.trim()) issues.push('Missing category');
      if (!currentListing.imageUrls.length) issues.push('No images');
      if (!currentListing.description.trim()) issues.push('Missing description');

      if (issues.includes('Missing title') || issues.includes('Missing price')) {
        skippedListings.push(currentListing);
        warnings.push({ rowIndex: i, customLabel: currentListing.customLabel, issues });
      } else {
        if (issues.length > 0) {
          warnings.push({ rowIndex: i, customLabel: currentListing.customLabel, issues });
        }
        listings.push(currentListing);
      }
    }
  }

  console.log('[Parser] Result: listings:', listings.length, 'skipped:', skippedListings.length, 'compat:', compatibilityRows, 'totalRows:', records.length - dataStartIndex, 'errors:', errors);

  return {
    listings,
    skippedListings,
    warnings,
    totalRows: records.length - dataStartIndex,
    compatibilityRows,
    errors,
  };
}

