import type { EbayCompatibilityPayload } from '../channels/ebay/ebay-api.types.js';

export interface ParsedFitmentRow {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  submodel?: string;
  notes?: string;
}

/** Parse a fitment object from catalog JSON, pipeline export, or AI output. */
export function parseFitmentEntry(
  raw: Record<string, unknown>,
): ParsedFitmentRow | null {
  const make = String(raw['Make'] ?? raw['make'] ?? '').trim();
  const model = String(raw['Model'] ?? raw['model'] ?? '').trim();
  const year = String(raw['Year'] ?? raw['year'] ?? '').trim();
  if (!make || !model || !year) return null;

  const yearNum = Number(year);
  if (!Number.isFinite(yearNum) || yearNum < 1900) return null;

  const trim = String(raw['Trim'] ?? raw['trim'] ?? '').trim() || undefined;
  const engine = String(raw['Engine'] ?? raw['engine'] ?? '').trim() || undefined;
  const submodel =
    String(raw['Submodel'] ?? raw['submodel'] ?? raw['SubModel'] ?? '').trim() ||
    undefined;
  const notes = String(raw['Notes'] ?? raw['notes'] ?? '').trim() || undefined;

  return { year, make, model, trim, engine, submodel, notes };
}

/** Convert stored fitment rows to eBay Inventory API compatibility payload. */
export function fitmentDataToCompatibilityPayload(
  fitmentData: Record<string, unknown>[] | null | undefined,
  options?: { excludeRejected?: boolean },
): EbayCompatibilityPayload | undefined {
  if (!Array.isArray(fitmentData) || fitmentData.length === 0) return undefined;

  const compatibleProducts: EbayCompatibilityPayload['compatibleProducts'] = [];

  for (const raw of fitmentData) {
    if (options?.excludeRejected !== false) {
      const status = String(raw['MvlStatus'] ?? raw['mvlStatus'] ?? '').toLowerCase();
      if (status === 'rejected') continue;
    }

    const row = parseFitmentEntry(raw);
    if (!row) continue;

    const properties: Array<{ name: string; value: string }> = [
      { name: 'Make', value: row.make },
      { name: 'Model', value: row.model },
      { name: 'Year', value: row.year },
    ];
    if (row.trim) properties.push({ name: 'Trim', value: row.trim });
    if (row.engine) properties.push({ name: 'Engine', value: row.engine });
    if (row.submodel) properties.push({ name: 'Submodel', value: row.submodel });

    compatibleProducts.push({
      compatibilityProperties: properties,
      ...(row.notes ? { notes: row.notes } : {}),
    });
  }

  if (compatibleProducts.length === 0) return undefined;
  return { compatibleProducts };
}

/** Serialize validated rows back to catalog fitment_data JSON. */
export function serializeValidatedFitmentRow(
  row: ParsedFitmentRow,
  mvlStatus: 'valid' | 'needs_review' | 'rejected',
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    Year: row.year,
    Make: row.make,
    Model: row.model,
    ...(row.trim ? { Trim: row.trim } : {}),
    ...(row.engine ? { Engine: row.engine } : {}),
    ...(row.submodel ? { Submodel: row.submodel } : {}),
    ...(row.notes ? { Notes: row.notes } : {}),
    MvlStatus: mvlStatus,
    ...extra,
  };
}
