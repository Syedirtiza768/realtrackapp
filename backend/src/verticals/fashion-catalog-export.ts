import type { ProductAttributes } from './vertical.types.js';
import { fashionAttributeKeyForAspect } from './fashion.config.js';

const SOURCE_FORMAT = 'artisticserver-fashion-export';
const DIRECT_FASHION_KEYS = [
  'department',
  'itemType',
  'productType',
  'categoryFamily',
  'size',
  'sizeSystem',
  'sizeType',
  'color',
  'secondaryColor',
  'pattern',
  'style',
  'material',
  'composition',
  'fabricType',
  'sleeveLength',
  'neckline',
  'closure',
  'length',
  'fit',
  'features',
  'countryOfManufacture',
  'season',
  'occasion',
  'theme',
  'vintage',
  'garmentCare',
] as const;

export type FashionExportSource = Record<string, string | undefined>;

function stringArray(value: ProductAttributes[string] | undefined): string[] {
  if (Array.isArray(value))
    return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeAspectName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseSpecificPairs(raw: string): Array<[string, string]> {
  const text = raw.trim();
  if (!text) return [];

  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.flatMap((entry): Array<[string, string]> => {
        if (!entry || typeof entry !== 'object') return [];
        const record = entry as Record<string, unknown>;
        const name = String(record.name ?? record.Name ?? '').trim();
        const value = String(record.value ?? record.Value ?? '').trim();
        return name && value ? [[name, value]] : [];
      });
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed as Record<string, unknown>)
        .map(
          ([name, value]) =>
            [name.trim(), String(value ?? '').trim()] as [string, string],
        )
        .filter(([name, value]) => name && value);
    }
  } catch {
    // The source exporter normally writes `Name: Value; Name: Value`.
  }

  return text
    .split(/;(?=\s*[^;:\r\n]+\s*:)|\r?\n(?=\s*[^;:\r\n]+\s*:)/)
    .flatMap((part): Array<[string, string]> => {
      const colon = part.indexOf(':');
      return colon > 0
        ? [[part.slice(0, colon).trim(), part.slice(colon + 1).trim()]]
        : [];
    })
    .filter(([name, value]) => Boolean(name && value));
}

function measurementNotes(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const notes = parsed.flatMap((entry): string[] => {
        if (!entry || typeof entry !== 'object') return [];
        const record = entry as Record<string, unknown>;
        const name = String(record.name ?? record.Name ?? '').trim();
        const label = String(record.label ?? record.Label ?? '').trim();
        const value = String(record.value ?? record.Value ?? '').trim();
        if (!label && !value) return [];
        const labelIsLetter = /^[A-E]$/i.test(label);
        const letter = labelIsLetter
          ? label.toUpperCase()
          : /^[A-E]$/i.test(name)
            ? name.toUpperCase()
            : '';
        const measurementLabel = labelIsLetter ? name : label || name;
        const prefix = letter ? `${letter}. ` : '';
        return [
          `${prefix}${measurementLabel || 'Measurement'}: ${value || '(blank)'}`,
        ];
      });
      if (notes.length) return notes.join('\n');
    }
  } catch {
    // Keep malformed source values editable as original notes.
  }
  return text;
}

function inferredFamily(data: FashionExportSource): string {
  const text = `${data.categoryName ?? ''} ${data.title ?? ''}`.toLowerCase();
  if (/\b(shoes?|boots?|sneakers?|sandals?|loafers?|heels?)\b/.test(text))
    return 'footwear';
  if (
    /\b(bags?|handbags?|belts?|wallets?|hats?|caps?|scarves?|ties?)\b/.test(
      text,
    )
  )
    return 'accessories';
  return 'clothing';
}

/**
 * Adds editable Fashion fields and source provenance for the Artistic Server
 * catalogue export. Existing explicit columns win over parsed item specifics.
 */
export function fashionCatalogExportAttributes(
  data: FashionExportSource,
  base: ProductAttributes = {},
): ProductAttributes {
  const attributes: ProductAttributes = {
    ...base,
    categoryFamily: base.categoryFamily ?? inferredFamily(data),
  };
  for (const key of DIRECT_FASHION_KEYS) {
    const value = data[key]?.trim();
    if (value && !attributes[key]) attributes[key] = value;
  }
  const customNames = stringArray(attributes.customAspectNames);
  const customValues = stringArray(attributes.customAspectValues);
  for (const [name, value] of parseSpecificPairs(data.itemSpecifics ?? '')) {
    const key = fashionAttributeKeyForAspect(name);
    if (key) {
      const mappedValue =
        key === 'features' || key === 'season'
          ? value.split(/\s*[,|]\s*/).filter(Boolean)
          : value;
      if (!attributes[key] || !String(attributes[key]).trim())
        attributes[key] = mappedValue;
      continue;
    }
    const normalized = normalizeAspectName(name);
    const index = customNames.findIndex(
      (candidate) => normalizeAspectName(candidate) === normalized,
    );
    if (index >= 0) {
      if (!customValues[index]) customValues[index] = value;
      continue;
    }
    customNames.push(name);
    customValues.push(value);
  }

  if (data.brand && !attributes.brand) attributes.brand = data.brand;
  if (customNames.length || customValues.length) {
    attributes.customAspectNames = customNames;
    attributes.customAspectValues = customValues;
  }

  const rawMeasurements = (data.measurements ?? '').trim();
  const notes = measurementNotes(rawMeasurements);
  if (notes) attributes.measurements = notes;
  if (rawMeasurements) {
    attributes._sourceMeasurements = rawMeasurements;
    // The export contains values but no unit. Do not imply cm or inches.
    attributes._measurementUnitReviewRequired = !String(
      attributes.measurementsUnit ?? data.measurementsUnit ?? '',
    ).trim();
  }

  const isSourceExport = Boolean(
    data.sourceMarketplaceItemId?.trim() &&
    data.sourceMarketplaceId?.trim() &&
    data.sourceChannelId?.trim() &&
    data.sourceAccountName?.trim(),
  );
  if (isSourceExport) {
    const sourceImageUrls = (data.imageUrls ?? '')
      .split('|')
      .map((url) => url.trim())
      .filter(
        (url, index, all) =>
          /^https?:\/\//i.test(url) && all.indexOf(url) === index,
      );
    attributes._sourceFormat = SOURCE_FORMAT;
    attributes._sourceItemSpecifics = data.itemSpecifics ?? '';
    attributes._sourceImageUrls = sourceImageUrls;
    attributes._imageMirrorExpected = String(sourceImageUrls.length);
    attributes._imageMirrorStored = '0';
    attributes._imageMirrorFailed = String(sourceImageUrls.length);
    attributes._imageMirrorStatus = sourceImageUrls.length
      ? 'pending'
      : 'failed';
    attributes._sourceChannelStatus = data.sourceChannelStatus ?? '';
    attributes._sourceChannelId = data.sourceChannelId ?? '';
    attributes._sourceMarketplaceId = data.sourceMarketplaceId ?? '';
    attributes._sourceMarketplaceName = data.sourceMarketplaceName ?? '';
    attributes._sourceMarketplaceSiteId = data.sourceMarketplaceSiteId ?? '';
    attributes._sourceMarketplaceItemId = data.sourceMarketplaceItemId ?? '';
    attributes._sourceAccountName = data.sourceAccountName ?? '';
    attributes._sourcePriceCurrency = data.sourcePriceCurrency ?? '';
    attributes._sourceCondition = data.sourceCondition ?? '';
    attributes._sourceListingUrl = data.sourceListingUrl ?? '';
  }

  return attributes;
}

export function customAspectPairs(
  attributes: ProductAttributes,
): Array<[string, string]> {
  const names = stringArray(attributes.customAspectNames);
  const values = stringArray(attributes.customAspectValues);
  return names
    .map(
      (name, index) =>
        [name.trim(), values[index]?.trim() ?? ''] as [string, string],
    )
    .filter(([name, value]) => Boolean(name && value));
}
