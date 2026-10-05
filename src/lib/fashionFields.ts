export const FASHION_FAMILIES = [
  { id: 'clothing', label: 'Clothing' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'accessories', label: 'Accessories' },
] as const;

export type FashionFamily = (typeof FASHION_FAMILIES)[number]['id'];

export type FashionField = {
  key: string;
  label: string;
  input: 'text' | 'textarea';
  families: FashionFamily[];
  help?: string;
};

export const FASHION_FIELD_GROUPS: Array<{ id: string; label: string; fields: FashionField[] }> = [
  {
    id: 'general',
    label: 'General',
    fields: [
      { key: 'itemType', label: 'Item type', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'productType', label: 'Product type', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'department', label: 'Department', input: 'text', families: ['clothing', 'footwear', 'accessories'], help: 'Intended audience from the label, such as Women, Men, or Unisex.' },
      { key: 'style', label: 'Style', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
    ],
  },
  {
    id: 'size',
    label: 'Size',
    fields: [
      { key: 'size', label: 'Label size', input: 'text', families: ['clothing', 'footwear'], help: 'Size as printed on the label. Keep this separate from measured dimensions.' },
      { key: 'sizeSystem', label: 'Sizing system', input: 'text', families: ['clothing', 'footwear'] },
      { key: 'sizeType', label: 'Size type', input: 'text', families: ['clothing'] },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    fields: [
      { key: 'color', label: 'Primary color', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'secondaryColor', label: 'Secondary color', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'pattern', label: 'Pattern', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
    ],
  },
  {
    id: 'fabric',
    label: 'Fabric',
    fields: [
      { key: 'material', label: 'Material', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'composition', label: 'Composition', input: 'text', families: ['clothing', 'footwear', 'accessories'], help: 'Prefer readable care-label composition.' },
      { key: 'fabricType', label: 'Fabric type', input: 'text', families: ['clothing'] },
    ],
  },
  {
    id: 'construction',
    label: 'Construction',
    fields: [
      { key: 'sleeveLength', label: 'Sleeve length', input: 'text', families: ['clothing'] },
      { key: 'neckline', label: 'Neckline', input: 'text', families: ['clothing'] },
      { key: 'closure', label: 'Closure', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'length', label: 'Garment length', input: 'text', families: ['clothing'] },
      { key: 'fit', label: 'Fit', input: 'text', families: ['clothing'] },
    ],
  },
  {
    id: 'measurements',
    label: 'Measurements',
    fields: [
      { key: 'chestMeasurement', label: 'Chest / bust', input: 'text', families: ['clothing'] },
      { key: 'waistMeasurement', label: 'Waist', input: 'text', families: ['clothing'] },
      { key: 'hipMeasurement', label: 'Hip', input: 'text', families: ['clothing'] },
      { key: 'lengthMeasurement', label: 'Length measurement', input: 'text', families: ['clothing'] },
      { key: 'inseamMeasurement', label: 'Inseam', input: 'text', families: ['clothing'] },
      { key: 'measurementsUnit', label: 'Measurement unit', input: 'text', families: ['clothing', 'footwear', 'accessories'], help: 'Required when a named measurement is set. Do not estimate from photos.' },
      { key: 'measurements', label: 'Original measurement notes', input: 'textarea', families: ['clothing', 'footwear', 'accessories'] },
    ],
  },
  {
    id: 'condition',
    label: 'Condition details',
    fields: [
      { key: 'wear', label: 'Wear', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'stains', label: 'Stains', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'holes', label: 'Holes', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'pilling', label: 'Pilling', input: 'text', families: ['clothing'] },
      { key: 'fading', label: 'Fading', input: 'text', families: ['clothing', 'footwear'] },
      { key: 'repairs', label: 'Repairs', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'missingComponents', label: 'Missing components', input: 'text', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'otherDefects', label: 'Other defects', input: 'textarea', families: ['clothing', 'footwear', 'accessories'] },
      { key: 'conditionDetails', label: 'Condition summary', input: 'textarea', families: ['clothing', 'footwear', 'accessories'] },
    ],
  },
  {
    id: 'footwear',
    label: 'Footwear',
    fields: [
      { key: 'shoeSize', label: 'Shoe size', input: 'text', families: ['footwear'] },
      { key: 'shoeSizeSystem', label: 'Shoe sizing system', input: 'text', families: ['footwear'] },
      { key: 'width', label: 'Width', input: 'text', families: ['footwear'] },
      { key: 'footwearType', label: 'Footwear type', input: 'text', families: ['footwear'] },
    ],
  },
  {
    id: 'accessories',
    label: 'Accessories',
    fields: [
      { key: 'accessoryType', label: 'Accessory type', input: 'text', families: ['accessories'] },
      { key: 'accessoryDimensions', label: 'Accessory dimensions', input: 'text', families: ['accessories'] },
      { key: 'accessoryMaterial', label: 'Accessory material', input: 'text', families: ['accessories'] },
    ],
  },
];

export function normalizeFashionFamily(value: unknown): FashionFamily {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'footwear' || raw === 'shoes' || raw === 'shoe') return 'footwear';
  if (raw === 'accessories' || raw === 'accessory' || raw === 'bag') return 'accessories';
  return 'clothing';
}

export function fashionFieldsForFamily(family: FashionFamily) {
  return FASHION_FIELD_GROUPS.flatMap((group) => group.fields.filter((field) => field.families.includes(family)));
}

export function isFashionMetaKey(key: string) {
  return key.startsWith('_');
}
