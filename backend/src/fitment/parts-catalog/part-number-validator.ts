/**
 * Brand-Specific Part Number Validator
 *
 * Validates OEM part numbers against known brand formats.
 * Used to detect LLM-hallucinated part numbers in production.
 */

/** Brand → validation config */
interface BrandPartFormat {
  brand: string;
  /** Regex the OEM part number must match */
  format: RegExp;
  /** Human-readable description */
  description: string;
  /** Example valid part numbers */
  examples: string[];
  /** Aliases for brand matching */
  aliases: string[];
}

const BRAND_PART_FORMATS: BrandPartFormat[] = [
  {
    brand: 'Toyota',
    format: /^\d{5}[-]?\d{3,5}$/,
    description: 'Toyota/Lexus: 5 digits, dash, 3-5 digits (e.g., 04465-F4021)',
    examples: ['04465-F4021', '04466-F4010', '04152-YZZA1', '87139-F4010'],
    aliases: ['toyota', 'lexus', 'scion'],
  },
  {
    brand: 'BMW',
    format: /^(\d{2}\s?\d{2}\s?\d\s?\d{3}\s?\d{3}|\d{11})$/,
    description: 'BMW: XX XX X XXX XXX format or 11 continuous digits',
    examples: ['34 11 6 796 827', '34116796827'],
    aliases: ['bmw', 'mini'],
  },
  {
    brand: 'Mercedes-Benz',
    format: /^A?\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}$/,
    description: 'Mercedes-Benz: A XXX XXX XX XX format',
    examples: ['A 000 000 00 00', 'A0000000000'],
    aliases: ['mercedes', 'mercedes-benz', 'mercedes benz', 'mb'],
  },
  {
    brand: 'Ford',
    format: /^[A-Z0-9]{3,5}[-]?\d{4,5}[-]?[A-Z0-9]{0,3}$/,
    description: 'Ford: 3-5 alphanumeric, dash, 4-5 digits, optional suffix',
    examples: ['BR3Z-1006-A', 'BL3Z-13405-A', 'F1TZ-6731-A'],
    aliases: ['ford', 'lincoln', 'mercury'],
  },
  {
    brand: 'GM',
    format: /^\d{7,8}$/,
    description: 'GM/Chevrolet/GMC/Cadillac: 7-8 digit number',
    examples: ['84127658', '12663410', '13598505'],
    aliases: ['chevrolet', 'chevy', 'gmc', 'cadillac', 'buick', 'pontiac', 'oldsmobile', 'saturn', 'gm', 'general motors'],
  },
  {
    brand: 'Volkswagen',
    format: /^[A-Z0-9]{3}\s?\d{3}\s?\d{3}[A-Z]?$/,
    description: 'VW/Audi/Porsche: 3 alphanumeric, 3 digits, 3 digits, optional letter',
    examples: ['5Q0 698 151', '5Q0698151A'],
    aliases: ['volkswagen', 'vw', 'audi', 'porsche', 'bentley', 'lamborghini', 'bugatti'],
  },
  {
    brand: 'Honda',
    format: /^\d{5}[-]?\w{5}$/,
    description: 'Honda/Acura: 5 digits, dash, 5 alphanumeric (e.g., 06431-S9A-000)',
    examples: ['06431-S9A-000', '15400-PLM-A02'],
    aliases: ['honda', 'acura'],
  },
  {
    brand: 'Nissan',
    format: /^\d{5}[-]?[A-Z0-9]{5}$/,
    description: 'Nissan/Infiniti: 5 digits, dash, 5 alphanumeric',
    examples: ['44060-4BA0A', '21200-ED000'],
    aliases: ['nissan', 'infiniti', 'datsun'],
  },
  {
    brand: 'Hyundai',
    format: /^\d{3,5}[-]?\d{3,5}$/,
    description: 'Hyundai/Kia/Genesis: numeric groups with optional dash',
    examples: ['58110-C1000', '0K2NAA-PP000'],
    aliases: ['hyundai', 'kia', 'genesis'],
  },
  {
    brand: 'Subaru',
    format: /^\d{3}[-]?\d{3}[-]?\d{2}$/,
    description: 'Subaru: 3 digits, 3 digits, 2 digits',
    examples: ['26300-AA090', 'SOA868V9300'],
    aliases: ['subaru'],
  },
  {
    brand: 'Mazda',
    format: /^[A-Z]{2}[-]?\d{2}[-]?\d{3,5}$/,
    description: 'Mazda: 2 letters, 2 digits, 3-5 digits',
    examples: ['PYFD-33-280A', 'B4Y1-33-28XA'],
    aliases: ['mazda'],
  },
];

/**
 * Normalize a brand name to its canonical form.
 */
function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase();
}

/**
 * Find the brand format config for a given brand.
 */
function findBrandFormat(brand: string): BrandPartFormat | null {
  const normalized = normalizeBrand(brand);
  return BRAND_PART_FORMATS.find(
    f => f.aliases.includes(normalized) || f.brand.toLowerCase() === normalized
  ) || null;
}

export interface PartNumberValidationResult {
  valid: boolean;
  brand: string;
  formatDescription: string;
  confidence: number;
  /** Whether this matches any known brand format (not necessarily the right one) */
  matchesAnyBrand: boolean;
  /** If matchesAnyBrand is true, which brands it matches */
  matchedBrands: string[];
}

/**
 * Validate an OEM part number against brand-specific format rules.
 *
 * @param partNumber - The OEM part number to validate
 * @param brand - The brand to validate against
 * @returns Validation result with confidence score
 *
 * Confidence levels:
 *   0.9+  — Part number matches the brand's known format exactly
 *   0.5   — Brand not in registry, cannot validate
 *   0.1   — Part number does NOT match the brand's format (likely hallucinated)
 */
export function validatePartNumber(
  partNumber: string,
  brand: string,
): PartNumberValidationResult {
  if (!partNumber || !brand) {
    return {
      valid: false,
      brand,
      formatDescription: 'Missing part number or brand',
      confidence: 0,
      matchesAnyBrand: false,
      matchedBrands: [],
    };
  }

  const normalized = partNumber.replace(/\s+/g, '').toUpperCase();
  const brandFormat = findBrandFormat(brand);

  // Check which brands this part number matches
  const matchedBrands: string[] = [];
  for (const fmt of BRAND_PART_FORMATS) {
    if (fmt.format.test(normalized)) {
      matchedBrands.push(fmt.brand);
    }
  }

  if (!brandFormat) {
    // Brand not in registry — can't validate, return neutral
    return {
      valid: true,
      brand,
      formatDescription: `No format rules for "${brand}"`,
      confidence: 0.5,
      matchesAnyBrand: matchedBrands.length > 0,
      matchedBrands,
    };
  }

  const matchesTarget = brandFormat.format.test(normalized);

  return {
    valid: matchesTarget,
    brand: brandFormat.brand,
    formatDescription: brandFormat.description,
    confidence: matchesTarget ? 0.9 : 0.1,
    matchesAnyBrand: matchedBrands.length > 0,
    matchedBrands,
  };
}

/**
 * Detect hallucinated part numbers in a parts array.
 * Returns an array of warning strings for parts that don't match the expected brand format.
 */
export function detectHallucinatedPartNumbers(
  parts: Array<{ part_name?: string; oem_part_number?: string }>,
  brand: string,
): string[] {
  const warnings: string[] = [];

  for (const part of parts) {
    if (!part.oem_part_number) continue;

    // Skip [VERIFY] tagged parts — they're already flagged
    if (part.oem_part_number.includes('[VERIFY]')) continue;

    const result = validatePartNumber(part.oem_part_number, brand);

    if (!result.valid && result.confidence < 0.3) {
      const matchInfo = result.matchedBrands.length > 0
        ? ` (matches ${result.matchedBrands.join(', ')} format instead)`
        : '';
      warnings.push(
        `"${part.part_name || 'Unknown'}": OEM# "${part.oem_part_number}" does not match ${brand} format${matchInfo}`
      );
    }
  }

  return warnings;
}
