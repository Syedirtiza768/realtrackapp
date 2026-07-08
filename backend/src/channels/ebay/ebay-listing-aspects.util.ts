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
  if (marketplaceId?.toUpperCase() !== 'EBAY_DE') {
    return aspects;
  }
  const out: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(aspects)) {
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

  return aspects;
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
