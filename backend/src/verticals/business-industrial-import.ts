import { businessIndustrialImportAttributeKeys } from './business-industrial.config.js';

/** Map normalized import columns into the B&I attribute JSON without carrying arbitrary columns. */
export function businessIndustrialAttributesFromImportRow(
  data: Record<string, string>,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const key of businessIndustrialImportAttributeKeys()) {
    const value = data[key];
    if (value !== undefined && value.trim() !== '')
      attributes[key] = value.trim();
  }
  return attributes;
}
