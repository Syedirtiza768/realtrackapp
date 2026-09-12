import type {
  ProductVertical,
  VerticalAttributes,
  VerticalConfig,
  VerticalProfile,
} from './vertical.types.js';
import {
  DEFAULT_PRODUCT_VERTICAL,
  isProductVertical,
} from './vertical.types.js';

export const DEFAULT_VERTICAL_CONFIG: VerticalConfig = {
  enabledVerticals: [DEFAULT_PRODUCT_VERTICAL],
  defaultVertical: DEFAULT_PRODUCT_VERTICAL,
  workflows: {},
};

export const VERTICAL_PROFILES: Record<ProductVertical, VerticalProfile> = {
  automotive: {
    id: 'automotive',
    label: 'Automotive',
    attributeFields: [
      { key: 'fitment', label: 'Vehicle fitment', input: 'json' },
      { key: 'oemPartNumber', label: 'OE/OEM part number', input: 'text' },
    ],
    supportsFitment: true,
    supportsVariations: false,
  },
  business_industrial: {
    id: 'business_industrial',
    label: 'Business & Industrial',
    attributeFields: [
      { key: 'manufacturer', label: 'Manufacturer', input: 'text' },
      { key: 'model', label: 'Model', input: 'text' },
      { key: 'mpn', label: 'MPN', input: 'text' },
      { key: 'voltage', label: 'Voltage', input: 'text' },
      { key: 'power', label: 'Power', input: 'text' },
      { key: 'dimensions', label: 'Dimensions', input: 'text' },
      { key: 'capacity', label: 'Capacity', input: 'text' },
      { key: 'testingStatus', label: 'Testing status', input: 'text' },
      {
        key: 'includedAccessories',
        label: 'Included accessories',
        input: 'textarea',
      },
    ],
    supportsFitment: false,
    supportsVariations: true,
  },
  fashion: {
    id: 'fashion',
    label: 'Fashion',
    attributeFields: [
      { key: 'brand', label: 'Brand', input: 'text' },
      { key: 'department', label: 'Department', input: 'text' },
      { key: 'size', label: 'Size', input: 'text' },
      { key: 'sizeSystem', label: 'Size system', input: 'text' },
      { key: 'color', label: 'Color', input: 'text' },
      { key: 'material', label: 'Material', input: 'text' },
      { key: 'measurements', label: 'Measurements', input: 'text' },
      {
        key: 'conditionDetails',
        label: 'Condition details',
        input: 'textarea',
      },
    ],
    supportsFitment: false,
    supportsVariations: true,
  },
};

export function normalizeVerticalConfig(value: unknown): VerticalConfig {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const enabled = Array.isArray(raw.enabledVerticals)
    ? raw.enabledVerticals.filter(isProductVertical)
    : [];
  const enabledVerticals: ProductVertical[] =
    enabled.length > 0 ? [...new Set(enabled)] : [DEFAULT_PRODUCT_VERTICAL];
  const defaultVertical = isProductVertical(raw.defaultVertical)
    ? raw.defaultVertical
    : DEFAULT_PRODUCT_VERTICAL;

  return {
    enabledVerticals,
    defaultVertical: enabledVerticals.includes(defaultVertical)
      ? defaultVertical
      : DEFAULT_PRODUCT_VERTICAL,
    workflows:
      raw.workflows && typeof raw.workflows === 'object'
        ? (raw.workflows as Record<string, Record<string, unknown>>)
        : {},
  };
}

function normalizeAttributeKey(key: string): string {
  return key
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, ch: string) => ch.toUpperCase());
}

export function validateVerticalAttributes(
  vertical: ProductVertical,
  value: unknown,
): { attributes: VerticalAttributes; errors: string[] } {
  if (value == null) return { attributes: {}, errors: [] };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      attributes: {},
      errors: ['Vertical attributes must be an object'],
    };
  }

  const errors: string[] = [];
  const attributes: VerticalAttributes = {};
  for (const [rawKey, rawValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const key = normalizeAttributeKey(rawKey);
    if (!key) continue;
    if (
      typeof rawValue === 'string' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean'
    ) {
      attributes[key] = rawValue;
      continue;
    }
    if (
      Array.isArray(rawValue) &&
      rawValue.every((item) => typeof item === 'string')
    ) {
      attributes[key] = rawValue;
      continue;
    }
    errors.push(`${key} must be a string, number, boolean, or string array`);
  }

  if (
    vertical !== 'automotive' &&
    ('fitment' in attributes || 'vin' in attributes)
  ) {
    errors.push(
      `${vertical} products cannot contain automotive fitment or VIN attributes`,
    );
  }
  return { attributes, errors };
}

export function attributesFromImportRow(
  vertical: ProductVertical,
  data: Record<string, string>,
): VerticalAttributes {
  const keys =
    vertical === 'fashion'
      ? [
          'brand',
          'department',
          'size',
          'sizeSystem',
          'color',
          'material',
          'measurements',
          'conditionDetails',
        ]
      : vertical === 'business_industrial'
        ? [
            'manufacturer',
            'model',
            'mpn',
            'voltage',
            'power',
            'dimensions',
            'capacity',
            'testingStatus',
            'includedAccessories',
          ]
        : [];
  return Object.fromEntries(
    keys
      .map((key) => [key, data[key]])
      .filter(
        ([, value]) => typeof value === 'string' && value.trim().length > 0,
      ),
  );
}
