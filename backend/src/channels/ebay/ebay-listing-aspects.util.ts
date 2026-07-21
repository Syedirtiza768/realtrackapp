/** eBay Inventory item-specific values are capped at 65 characters (Motors Type, etc.). */
export const EBAY_ASPECT_VALUE_MAX_LENGTH = 65;

const EBAY_DE_ASPECT_NAME_MAP: Record<string, string> = {
  Brand: 'Hersteller',
  MPN: 'Herstellernummer',
  'Manufacturer Part Number': 'Herstellernummer',
  Type: 'Produktart',
  'Placement on Vehicle': 'Einbauposition',
  'OE/OEM Part Number': 'OE/OEM Referenznummer(n)',
  'Interchange Part Number': 'Vergleichsnummer',
  Material: 'Material',
  Color: 'Farbe',
  Features: 'Besonderheiten',
  Condition: 'Zustand',
  'Country/Region of Manufacture': 'Herstellungsland und -region',
  'Universal Fitment': 'Universelle Kompatibilität',
};

/** Truncate a single aspect value to eBay's 65-char limit, preferring a word boundary. */
export function truncateEbayAspectValue(
  value: string,
  maxLength: number = EBAY_ASPECT_VALUE_MAX_LENGTH,
): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.6) return cut.slice(0, lastSpace).trim();
  return cut.trim();
}

/** Enforce eBay aspect value length limits on every value in an aspects map. */
export function sanitizeListingAspects(
  aspects: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(aspects)) {
    const cleaned = (values ?? [])
      .map((v) => truncateEbayAspectValue(String(v ?? '')))
      .filter(Boolean);
    if (cleaned.length) out[name] = cleaned;
  }
  return out;
}

/** Map English inventory aspect keys to marketplace-local names (e.g. Brand → Hersteller on EBAY_DE). */
export function localizeAspectName(
  name: string,
  marketplaceId: string,
): string {
  if (marketplaceId?.toUpperCase() === 'EBAY_DE') {
    return EBAY_DE_ASPECT_NAME_MAP[name] ?? name;
  }
  return name;
}

/** Localize all aspect keys for a marketplace (used by direct Inventory API publish). */
export function localizeAspectsForMarketplace(
  aspects: Record<string, string[]>,
  marketplaceId: string,
): Record<string, string[]> {
  const sanitized = sanitizeListingAspects(aspects);
  if (marketplaceId?.toUpperCase() !== 'EBAY_DE') {
    return sanitized;
  }
  const out: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(sanitized)) {
    out[localizeAspectName(name, marketplaceId)] = values;
  }
  return out;
}

/** Build eBay inventory item specifics from catalog / listing fields. */
export function buildListingAspects(input: {
  brand?: string | null;
  mpn?: string | null;
  partType?: string | null;
  upc?: string | null;
  oeOemPartNumber?: string | null;
  existing?: Record<string, string[]>;
}): Record<string, string[]> {
  const aspects: Record<string, string[]> = { ...(input.existing ?? {}) };

  const setAspect = (name: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (!v) return;
    if (!aspects[name]?.length) {
      aspects[name] = [v];
    }
  };

  setAspect('Brand', input.brand);
  setAspect('MPN', input.mpn);
  setAspect('Type', input.partType);
  setAspect('UPC', input.upc);
  setAspect('OE/OEM Part Number', input.oeOemPartNumber);

  // Always sanitize — existing/req aspects may carry raw OEM descriptions > 65 chars
  // (eBay rejects Type with error 25002 / "value … is too long").
  return sanitizeListingAspects(aspects);
}

export function isUsedEbayCondition(
  condition: string | null | undefined,
): boolean {
  if (!condition?.trim()) return false;
  const c = condition
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return c.startsWith('USED_') || c === 'FOR_PARTS_OR_NOT_WORKING';
}
