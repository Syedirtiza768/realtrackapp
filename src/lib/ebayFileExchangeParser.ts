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
  compatibility: { make: string; model: string; year: string }[];
}

export interface ParseResult {
  listings: EbayListing[];
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

export function parseEbayFileExchangeCsv(csvText: string): ParseResult {
  const lines = csvText.split(/\r?\n/);
  const errors: string[] = [];
  let compatibilityRows = 0;

  // Skip BOM if present
  if (lines[0]?.charCodeAt(0) === 0xfeff) {
    lines[0] = lines[0].slice(1);
  }

  // Line 1 is metadata (Info row), Line 2 is headers
  if (lines.length < 3) {
    return { listings: [], totalRows: 0, compatibilityRows: 0, errors: ['CSV has too few rows'] };
  }

  // We don't need to parse headers by name since the column positions are fixed
  // in the eBay File Exchange template
  const listings: EbayListing[] = [];
  let currentListing: EbayListing | null = null;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);

    const action = fields[0]?.trim() || '';
    const relationship = fields[4]?.trim() || '';

    if (relationship === 'Compatibility') {
      // This is a fitment/compatibility child row
      compatibilityRows++;
      if (currentListing && fields[5]) {
        currentListing.compatibility.push(parseCompatibility(fields[5]));
      }
      continue;
    }

    if (action && action !== '' && action.toLowerCase() !== 'info') {
      // This is a product row
      const condParsed = parseCondition(fields[9] || '');
      const imageStr = fields[8] || '';

      currentListing = {
        action,
        customLabel: fields[1] || '',
        category: fields[2] || '',
        title: fields[3] || '',
        price: fields[6] || '',
        quantity: fields[7] || '',
        imageUrls: imageStr ? imageStr.split('|').filter(Boolean) : [],
        conditionId: condParsed.id,
        conditionLabel: condParsed.label,
        description: fields[10] || '',
        format: fields[11] || '',
        duration: fields[12] || '',
        location: fields[13] || '',
        brand: fields[14] || '',
        type: fields[15] || '',
        placement: fields[16] || '',
        material: fields[17] || '',
        features: fields[18] || '',
        countryOfManufacture: fields[19] || '',
        mpn: fields[20] || '',
        oemPartNumber: fields[21] || '',
        shippingProfile: fields[22] || '',
        returnProfile: fields[23] || '',
        paymentProfile: fields[24] || '',
        compatibility: [],
      };
      listings.push(currentListing);
    }
  }

  return {
    listings,
    totalRows: lines.length - 2,
    compatibilityRows,
    errors,
  };
}
