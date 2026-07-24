/**
 * Derive a listing-ready part descriptor from an eBay Motors–style title by
 * stripping the part number, brand tokens, year ranges, and condition
 * boilerplate — leaving roughly "[Model/Chassis] [Part Name]".
 *
 * Used wherever a descriptive part name is needed but the source record's
 * dedicated part-type field can't be trusted to hold one — e.g.
 * catalog_products.part_type holds "OEM"/"Aftermarket"/"Salvage" (the
 * intake form's condition/source dropdown) for warehouse-intake parts,
 * rather than a real part descriptor like pipeline-imported rows have.
 */

const STOP_WORDS = new Set([
  'oem',
  'genuine',
  'used',
  'new',
  'original',
  'factory',
  'oe',
  'fits',
]);

function stripSpecialChars(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function derivePartNameFromTitle(
  title: string | null | undefined,
  partNumber?: string | null,
  brand?: string | null,
): string | undefined {
  if (!title?.trim()) return undefined;

  const brandTokens = new Set(
    (brand ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  );
  const normalize = (v: string) => v.toLowerCase().replace(/[\s\-]/g, '');
  const targetPn = normalize(partNumber ?? '');

  const words = stripSpecialChars(title)
    .split(/\s+/)
    .filter((w) => {
      const lower = w.toLowerCase();
      if (STOP_WORDS.has(lower)) return false;
      if (brandTokens.has(lower)) return false;
      // Drop the part number itself (with or without dashes/spaces)
      if (targetPn && normalize(w) === targetPn) return false;
      // Drop long alphanumeric codes that look like part numbers
      if (/^[a-z0-9\-]{8,}$/i.test(w) && /\d/.test(w)) return false;
      // Drop years / year ranges
      if (/^(19|20)\d{2}([-/](19|20)?\d{2})?$/.test(w)) return false;
      return true;
    });

  const name = words.join(' ').replace(/\s+/g, ' ').trim();
  return name.length >= 3 ? name.slice(0, 65) : undefined;
}
