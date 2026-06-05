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
  const c = condition.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return c.startsWith('USED_') || c === 'FOR_PARTS_OR_NOT_WORKING';
}
