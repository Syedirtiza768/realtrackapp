import type { ProductAttributes } from './vertical.types.js';
import { validateVerticalAttributes } from './vertical.config.js';

export const FASHION_VERTICAL = 'fashion' as const;

export const FASHION_CATEGORY_FAMILIES = [
  { id: 'clothing', label: 'Clothing' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'accessories', label: 'Accessories' },
] as const;

export type FashionCategoryFamily =
  (typeof FASHION_CATEGORY_FAMILIES)[number]['id'];

export const FASHION_META_KEYS = [
  '_suggestedKeys',
  '_confirmedKeys',
  '_conflictKeys',
  '_conflictNotes',
  '_warnings',
  '_multipleItems',
  '_lastAnalyzedAt',
  '_analysisStatus',
  '_titleConfirmed',
  '_descriptionConfirmed',
] as const;

const AUTOMOTIVE_KEYS = new Set([
  'fitment',
  'vin',
  'oemPartNumber',
  'vehicleMake',
  'vehicleModel',
  'vehicleYear',
  'engine',
  'compatibility',
  'ymm',
  'ymmt',
  'make',
  'modelYear',
  'placement',
]);

const INDUSTRIAL_KEYS = new Set([
  'voltage',
  'power',
  'capacity',
  'testingStatus',
  'includedAccessories',
  'mpn',
  'manufacturer',
  'inputVoltage',
  'ratedVoltage',
  'enclosureRating',
]);

export type FashionFieldDef = {
  key: string;
  label: string;
  input: 'text' | 'textarea';
  families: FashionCategoryFamily[];
  help?: string;
};

export const FASHION_FIELD_GROUPS: Array<{
  id: string;
  label: string;
  fields: FashionFieldDef[];
}> = [
  {
    id: 'general',
    label: 'General',
    fields: [
      {
        key: 'categoryFamily',
        label: 'Fashion category',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'itemType',
        label: 'Item type',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'productType',
        label: 'Product type',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'department',
        label: 'Department',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
        help: 'Intended audience printed or clearly labeled, such as Women, Men, or Unisex.',
      },
      {
        key: 'style',
        label: 'Style',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
    ],
  },
  {
    id: 'size',
    label: 'Size',
    fields: [
      {
        key: 'size',
        label: 'Label size',
        input: 'text',
        families: ['clothing', 'footwear'],
        help: 'Size as printed on the label. Keep this separate from measured dimensions.',
      },
      {
        key: 'sizeSystem',
        label: 'Sizing system',
        input: 'text',
        families: ['clothing', 'footwear'],
      },
      {
        key: 'sizeType',
        label: 'Size type',
        input: 'text',
        families: ['clothing'],
      },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    fields: [
      {
        key: 'color',
        label: 'Primary color',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'secondaryColor',
        label: 'Secondary color',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'pattern',
        label: 'Pattern',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
    ],
  },
  {
    id: 'fabric',
    label: 'Fabric',
    fields: [
      {
        key: 'material',
        label: 'Material',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'composition',
        label: 'Composition',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
        help: 'Prefer readable care-label composition. Do not guess percentages.',
      },
      {
        key: 'fabricType',
        label: 'Fabric type',
        input: 'text',
        families: ['clothing'],
      },
    ],
  },
  {
    id: 'construction',
    label: 'Construction',
    fields: [
      {
        key: 'sleeveLength',
        label: 'Sleeve length',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'neckline',
        label: 'Neckline',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'closure',
        label: 'Closure',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'length',
        label: 'Garment length',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'fit',
        label: 'Fit',
        input: 'text',
        families: ['clothing'],
      },
    ],
  },
  {
    id: 'measurements',
    label: 'Measurements',
    fields: [
      {
        key: 'chestMeasurement',
        label: 'Chest / bust',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'waistMeasurement',
        label: 'Waist',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'hipMeasurement',
        label: 'Hip',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'lengthMeasurement',
        label: 'Length measurement',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'inseamMeasurement',
        label: 'Inseam',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'measurementsUnit',
        label: 'Measurement unit',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
        help: 'Required when any named measurement is set. Do not infer measurements from ordinary photos.',
      },
      {
        key: 'measurements',
        label: 'Original measurement notes',
        input: 'textarea',
        families: ['clothing', 'footwear', 'accessories'],
        help: 'Preserve original label or tape-measure wording.',
      },
    ],
  },
  {
    id: 'condition',
    label: 'Condition details',
    fields: [
      {
        key: 'wear',
        label: 'Wear',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'stains',
        label: 'Stains',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'holes',
        label: 'Holes',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'pilling',
        label: 'Pilling',
        input: 'text',
        families: ['clothing'],
      },
      {
        key: 'fading',
        label: 'Fading',
        input: 'text',
        families: ['clothing', 'footwear'],
      },
      {
        key: 'repairs',
        label: 'Repairs',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'missingComponents',
        label: 'Missing components',
        input: 'text',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'otherDefects',
        label: 'Other defects',
        input: 'textarea',
        families: ['clothing', 'footwear', 'accessories'],
      },
      {
        key: 'conditionDetails',
        label: 'Condition summary',
        input: 'textarea',
        families: ['clothing', 'footwear', 'accessories'],
      },
    ],
  },
  {
    id: 'footwear',
    label: 'Footwear',
    fields: [
      {
        key: 'shoeSize',
        label: 'Shoe size',
        input: 'text',
        families: ['footwear'],
      },
      {
        key: 'shoeSizeSystem',
        label: 'Shoe sizing system',
        input: 'text',
        families: ['footwear'],
      },
      {
        key: 'width',
        label: 'Width',
        input: 'text',
        families: ['footwear'],
      },
      {
        key: 'footwearType',
        label: 'Footwear type',
        input: 'text',
        families: ['footwear'],
      },
    ],
  },
  {
    id: 'accessories',
    label: 'Accessories',
    fields: [
      {
        key: 'accessoryType',
        label: 'Accessory type',
        input: 'text',
        families: ['accessories'],
      },
      {
        key: 'accessoryDimensions',
        label: 'Accessory dimensions',
        input: 'text',
        families: ['accessories'],
      },
      {
        key: 'accessoryMaterial',
        label: 'Accessory material',
        input: 'text',
        families: ['accessories'],
      },
    ],
  },
];

export const FASHION_ATTRIBUTE_FIELDS = FASHION_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

const MEASUREMENT_VALUE_KEYS = [
  'chestMeasurement',
  'waistMeasurement',
  'hipMeasurement',
  'lengthMeasurement',
  'inseamMeasurement',
] as const;

const MEASUREMENT_UNITS = new Set(['cm', 'in', 'mm', 'inch', 'inches']);

export function isFashionCategoryFamily(
  value: unknown,
): value is FashionCategoryFamily {
  return FASHION_CATEGORY_FAMILIES.some((family) => family.id === value);
}

export function normalizeFashionCategoryFamily(
  value: unknown,
): FashionCategoryFamily {
  if (typeof value !== 'string') return 'clothing';
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'shoes' || normalized === 'shoe' || normalized === 'footwear')
    return 'footwear';
  if (
    normalized === 'accessory' ||
    normalized === 'accessories' ||
    normalized === 'bag' ||
    normalized === 'jewelry'
  )
    return 'accessories';
  if (isFashionCategoryFamily(normalized)) return normalized;
  return 'clothing';
}

export function fashionFieldsForFamily(family: FashionCategoryFamily) {
  return FASHION_ATTRIBUTE_FIELDS.filter((field) =>
    field.families.includes(family),
  );
}

export function isFashionMetaKey(key: string): boolean {
  return key.startsWith('_');
}

function textValue(value: ProductAttributes[string] | undefined): string {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean).join(' | ');
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function hasValue(value: ProductAttributes[string] | undefined): boolean {
  return textValue(value).length > 0;
}

export function compatibleFashionAttributes(
  family: FashionCategoryFamily,
  attributes: ProductAttributes,
): ProductAttributes {
  const allowed = new Set(fashionFieldsForFamily(family).map((field) => field.key));
  const next: ProductAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isFashionMetaKey(key) || allowed.has(key) || key === 'brand') {
      next[key] = value;
    }
  }
  next.categoryFamily = family;
  return next;
}

export function validateFashionAttributes(value: unknown): {
  attributes: ProductAttributes;
  errors: string[];
  warnings: string[];
} {
  const base = validateVerticalAttributes('fashion', value);
  const errors = [...base.errors];
  const warnings: string[] = [];
  const attributes = { ...base.attributes };

  for (const key of Object.keys(attributes)) {
    if (AUTOMOTIVE_KEYS.has(key) || INDUSTRIAL_KEYS.has(key)) {
      errors.push(
        `${key} is not a Fashion attribute. Use garment, footwear, or accessory details instead of automotive or industrial specifications.`,
      );
      delete attributes[key];
    }
  }

  const family = normalizeFashionCategoryFamily(attributes.categoryFamily);
  attributes.categoryFamily = family;
  const compatible = compatibleFashionAttributes(family, attributes);
  for (const key of Object.keys(attributes)) {
    if (!(key in compatible) && !isFashionMetaKey(key)) {
      warnings.push(
        `${key} does not apply to the ${family} category and was not stored as a valid Fashion attribute`,
      );
    }
  }

  const cleaned = compatible;
  const unit = textValue(cleaned.measurementsUnit).toLowerCase();
  const hasMeasurement = MEASUREMENT_VALUE_KEYS.some((key) => hasValue(cleaned[key]));
  if (hasMeasurement && !unit) {
    warnings.push(
      'measurementsUnit is required when a named measurement is present. Named measurements were kept for review and are not treated as complete.',
    );
  }
  if (unit && !MEASUREMENT_UNITS.has(unit) && hasMeasurement) {
    warnings.push(
      'Use an explicit measurement unit such as cm or in. The original notes field preserves un-normalized wording.',
    );
  }
  if (hasValue(cleaned.size) && hasMeasurement) {
    warnings.push(
      'Label size and measured dimensions are stored separately. Do not treat a tape measurement as the size label.',
    );
  }

  return { attributes: cleaned, errors, warnings };
}

export function fashionImportAttributeKeys(): string[] {
  return [
    'brand',
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
    'chestMeasurement',
    'waistMeasurement',
    'hipMeasurement',
    'lengthMeasurement',
    'inseamMeasurement',
    'measurementsUnit',
    'measurements',
    'wear',
    'stains',
    'holes',
    'pilling',
    'fading',
    'repairs',
    'missingComponents',
    'otherDefects',
    'conditionDetails',
    'shoeSize',
    'shoeSizeSystem',
    'width',
    'footwearType',
    'accessoryType',
    'accessoryDimensions',
    'accessoryMaterial',
  ];
}

export type FashionSuggestionConflict = {
  key: string;
  current: string;
  suggested: string;
};

export function mergeFashionSuggestions(params: {
  current: ProductAttributes;
  suggested: ProductAttributes;
  confirmedKeys?: string[];
}): {
  attributes: ProductAttributes;
  suggestedKeys: string[];
  conflicts: FashionSuggestionConflict[];
} {
  const confirmed = new Set(
    (params.confirmedKeys ?? []).map((key) => key.trim()).filter(Boolean),
  );
  const attributes: ProductAttributes = { ...params.current };
  const suggestedKeys: string[] = [];
  const conflicts: FashionSuggestionConflict[] = [];

  for (const [key, rawSuggested] of Object.entries(params.suggested)) {
    if (isFashionMetaKey(key) || AUTOMOTIVE_KEYS.has(key) || INDUSTRIAL_KEYS.has(key))
      continue;
    const suggestedText = textValue(rawSuggested);
    if (!suggestedText) continue;
    const currentText = textValue(attributes[key]);
    if (confirmed.has(key) && currentText) {
      if (currentText !== suggestedText) {
        conflicts.push({ key, current: currentText, suggested: suggestedText });
      }
      continue;
    }
    if (!currentText) {
      attributes[key] = rawSuggested;
      suggestedKeys.push(key);
      continue;
    }
    if (currentText !== suggestedText) {
      conflicts.push({ key, current: currentText, suggested: suggestedText });
      continue;
    }
  }

  return { attributes, suggestedKeys, conflicts };
}

function joinFacts(parts: Array<string | undefined | null>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ');
}

export function buildFashionListingContent(params: {
  brand?: string | null;
  title?: string | null;
  attributes: ProductAttributes;
  conditionLabel?: string | null;
}): { title: string; description: string } {
  const attrs = params.attributes;
  const brand = (params.brand ?? textValue(attrs.brand)).trim();
  const itemType = textValue(attrs.itemType) || textValue(attrs.productType);
  const department = textValue(attrs.department);
  const color = textValue(attrs.color);
  const size = textValue(attrs.size) || textValue(attrs.shoeSize);
  const material = textValue(attrs.material) || textValue(attrs.accessoryMaterial);
  const style = textValue(attrs.style);

  const generatedTitle = joinFacts([
    brand,
    department,
    color,
    itemType,
    style,
    size ? `Size ${size}` : '',
    material,
  ]).slice(0, 80);

  const facts: string[] = [];
  const pushFact = (label: string, value: string) => {
    if (value) facts.push(`${label}: ${value}`);
  };
  pushFact('Item type', itemType);
  pushFact('Brand', brand);
  pushFact('Department', department);
  pushFact('Label size', textValue(attrs.size));
  pushFact('Sizing system', textValue(attrs.sizeSystem));
  pushFact('Primary color', color);
  pushFact('Secondary color', textValue(attrs.secondaryColor));
  pushFact('Pattern', textValue(attrs.pattern));
  pushFact('Material', material);
  pushFact('Composition', textValue(attrs.composition));
  pushFact('Style', style);
  pushFact('Sleeve length', textValue(attrs.sleeveLength));
  pushFact('Neckline', textValue(attrs.neckline));
  pushFact('Closure', textValue(attrs.closure));
  pushFact('Fit', textValue(attrs.fit));
  pushFact('Shoe size', textValue(attrs.shoeSize));
  pushFact('Footwear type', textValue(attrs.footwearType));
  pushFact('Accessory type', textValue(attrs.accessoryType));
  if (textValue(attrs.measurements))
    pushFact('Measurement notes', textValue(attrs.measurements));

  const defects = [
    textValue(attrs.wear) && `Wear: ${textValue(attrs.wear)}`,
    textValue(attrs.stains) && `Stains: ${textValue(attrs.stains)}`,
    textValue(attrs.holes) && `Holes: ${textValue(attrs.holes)}`,
    textValue(attrs.pilling) && `Pilling: ${textValue(attrs.pilling)}`,
    textValue(attrs.fading) && `Fading: ${textValue(attrs.fading)}`,
    textValue(attrs.repairs) && `Repairs: ${textValue(attrs.repairs)}`,
    textValue(attrs.missingComponents) &&
      `Missing components: ${textValue(attrs.missingComponents)}`,
    textValue(attrs.otherDefects),
    textValue(attrs.conditionDetails),
  ].filter(Boolean);

  const descriptionParts = [
    facts.length ? facts.join('\n') : '',
    params.conditionLabel ? `Condition: ${params.conditionLabel}` : '',
    defects.length
      ? `Reported defects and wear:\n${defects.join('\n')}`
      : '',
    'Details not listed were not confirmed from the photos or seller notes and are omitted.',
  ].filter(Boolean);

  const title = (params.title?.trim() || generatedTitle || 'Fashion item').slice(
    0,
    200,
  );
  return { title, description: descriptionParts.join('\n\n') };
}

export function suggestFashionSku(itemType?: string | null): string {
  const slug = (itemType || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'item';
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FSH-${slug}-${stamp}-${suffix}`.slice(0, 160);
}

export function fashionAspectsFromAttributes(
  attributes: ProductAttributes,
  brand?: string | null,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const mapped: Array<[string, string]> = [
    ['Brand', (brand ?? textValue(attributes.brand)).trim()],
    ['Department', textValue(attributes.department)],
    ['Type', textValue(attributes.itemType) || textValue(attributes.productType)],
    ['Size', textValue(attributes.size) || textValue(attributes.shoeSize)],
    ['Size Type', textValue(attributes.sizeType)],
    ['Color', textValue(attributes.color)],
    ['Style', textValue(attributes.style)],
    ['Pattern', textValue(attributes.pattern)],
    ['Material', textValue(attributes.material) || textValue(attributes.accessoryMaterial)],
    ['Sleeve Length', textValue(attributes.sleeveLength)],
    ['Neckline', textValue(attributes.neckline)],
    ['Closure', textValue(attributes.closure)],
  ];
  for (const [name, value] of mapped) {
    if (value) result[name] = [value];
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (isFashionMetaKey(key) || AUTOMOTIVE_KEYS.has(key) || INDUSTRIAL_KEYS.has(key))
      continue;
    const text = textValue(value);
    if (!text || result[key]) continue;
    result[key] = Array.isArray(value)
      ? value.map((item) => item.trim()).filter(Boolean)
      : [text];
  }
  return result;
}

export function applyFashionAnalysisMeta(
  attributes: ProductAttributes,
  meta: {
    suggestedKeys: string[];
    confirmedKeys?: string[];
    conflicts: FashionSuggestionConflict[];
    warnings: string[];
    multipleItems: boolean;
    analysisStatus: 'suggested' | 'failed' | 'skipped';
  },
): ProductAttributes {
  return {
    ...attributes,
    _suggestedKeys: [...new Set(meta.suggestedKeys)],
    _confirmedKeys: [...new Set(meta.confirmedKeys ?? stringArray(attributes._confirmedKeys))],
    _conflictKeys: meta.conflicts.map((item) => item.key),
    _conflictNotes: meta.conflicts
      .map((item) => `${item.key}: current "${item.current}" vs suggested "${item.suggested}"`)
      .join('; '),
    _warnings: [...new Set(meta.warnings)],
    _multipleItems: meta.multipleItems,
    _lastAnalyzedAt: new Date().toISOString(),
    _analysisStatus: meta.analysisStatus,
  };
}

function stringArray(value: ProductAttributes[string] | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  const text = textValue(value);
  return text ? [text] : [];
}
