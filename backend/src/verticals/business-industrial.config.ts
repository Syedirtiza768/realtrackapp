import type { ProductAttributes } from './vertical.types.js';
import { validateVerticalAttributes } from './vertical.config.js';

export const BUSINESS_INDUSTRIAL_VERTICAL = 'business_industrial' as const;

export const BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES = [
  {
    id: 'industrial_automation',
    label: 'Industrial automation & controls',
    restricted: false,
  },
  {
    id: 'electrical_equipment',
    label: 'Electrical equipment & protection',
    restricted: false,
  },
  {
    id: 'machinery_tooling',
    label: 'Manufacturing machinery, tooling & spare parts',
    restricted: false,
  },
  {
    id: 'hydraulics_pneumatics',
    label: 'Hydraulics, pneumatics, pumps & valves',
    restricted: false,
  },
  {
    id: 'test_measurement',
    label: 'Test, measurement & inspection equipment',
    restricted: false,
  },
  {
    id: 'material_handling',
    label: 'Material handling & industrial storage',
    restricted: false,
  },
  {
    id: 'commercial_equipment',
    label: 'Commercial kitchen, office & retail equipment',
    restricted: false,
  },
  {
    id: 'construction_safety',
    label: 'Construction, industrial supplies & safety',
    restricted: false,
  },
  {
    id: 'medical_laboratory',
    label: 'Medical and laboratory equipment',
    restricted: true,
  },
  {
    id: 'hazmat_chemical',
    label: 'Hazardous materials and chemicals',
    restricted: true,
  },
] as const;

export type BusinessIndustrialCategoryFamily =
  (typeof BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES)[number]['id'];

const NUMERIC_UNIT_PAIRS: Array<[string, string, string[]]> = [
  ['voltage', 'voltageUnit', ['V', 'kV', 'mV']],
  ['frequency', 'frequencyUnit', ['Hz', 'kHz', 'MHz']],
  ['current', 'currentUnit', ['A', 'mA', 'kA']],
  ['power', 'powerUnit', ['W', 'kW', 'MW', 'VA', 'kVA', 'HP']],
  ['capacity', 'capacityUnit', ['L', 'mL', 'gal', 'kg', 't', 'A·h', 'Ah']],
  ['pressure', 'pressureUnit', ['Pa', 'kPa', 'MPa', 'bar', 'psi']],
  ['weight', 'weightUnit', ['g', 'kg', 'lb', 'oz', 't']],
  ['dimensionsLength', 'dimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
  ['dimensionsWidth', 'dimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
  ['dimensionsHeight', 'dimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
  ['packedLength', 'packedDimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
  ['packedWidth', 'packedDimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
  ['packedHeight', 'packedDimensionsUnit', ['mm', 'cm', 'm', 'in', 'ft']],
  ['packedWeight', 'packedWeightUnit', ['kg', 'lb', 'oz', 't']],
  ['palletWeight', 'palletWeightUnit', ['kg', 'lb', 'oz', 't']],
  ['crateWeight', 'crateWeightUnit', ['kg', 'lb', 'oz', 't']],
];

const NON_NEGATIVE_FIELDS = new Set([
  ...NUMERIC_UNIT_PAIRS.map(([value]) => value),
  'operatingHours',
  'sellableLots',
  'unitsPerLot',
  'totalPhysicalUnits',
]);

const VALID_INVENTORY_MODES = new Set([
  'single',
  'serialized',
  'multipack',
  'lot',
]);
const VALID_SHIPPING_MODES = new Set(['parcel', 'freight', 'local_pickup']);

export function isRestrictedBusinessIndustrialFamily(value: unknown): boolean {
  return BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES.some(
    (family) => family.id === value && family.restricted,
  );
}

function numberValue(
  value: ProductAttributes[string] | undefined,
): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Validates the deliberately flat B&I attribute contract. Flat values keep
 * spreadsheet imports deterministic while the selected eBay category remains
 * the authority for additional item specifics.
 */
export function validateBusinessIndustrialAttributes(value: unknown): {
  attributes: ProductAttributes;
  errors: string[];
  warnings: string[];
} {
  const base = validateVerticalAttributes('business_industrial', value);
  const errors = [...base.errors];
  const warnings: string[] = [];
  const attributes = base.attributes;

  const family = attributes.categoryFamily;
  if (
    family !== undefined &&
    (typeof family !== 'string' ||
      !BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES.some((item) => item.id === family))
  ) {
    errors.push(
      'categoryFamily must be one of the deliberate Business & Industrial category selections',
    );
  }

  for (const [valueKey, unitKey, units] of NUMERIC_UNIT_PAIRS) {
    const rawValue = attributes[valueKey];
    const rawUnit = attributes[unitKey];
    const hasValue = rawValue !== undefined && rawValue !== '';
    const hasUnit = rawUnit !== undefined && rawUnit !== '';
    if (hasValue !== hasUnit) {
      errors.push(
        `${valueKey} and ${unitKey} must be supplied together with an explicit unit`,
      );
      continue;
    }
    if (hasValue) {
      const parsed = numberValue(rawValue);
      if (parsed === null || parsed < 0)
        errors.push(`${valueKey} must be a non-negative number`);
      if (typeof rawUnit !== 'string' || !units.includes(rawUnit)) {
        errors.push(`${unitKey} must be one of: ${units.join(', ')}`);
      }
    }
  }

  for (const field of NON_NEGATIVE_FIELDS) {
    if (!(field in attributes)) continue;
    const parsed = numberValue(attributes[field]);
    if (parsed === null || parsed < 0)
      errors.push(`${field} must be a non-negative number`);
  }

  const inventoryMode = attributes.inventoryMode;
  if (
    inventoryMode !== undefined &&
    (typeof inventoryMode !== 'string' ||
      !VALID_INVENTORY_MODES.has(inventoryMode))
  ) {
    errors.push('inventoryMode must be single, serialized, multipack, or lot');
  }

  const shippingMode = attributes.shippingMode;
  if (
    shippingMode !== undefined &&
    (typeof shippingMode !== 'string' ||
      !VALID_SHIPPING_MODES.has(shippingMode))
  ) {
    errors.push('shippingMode must be parcel, freight, or local_pickup');
  }

  const lots = numberValue(attributes.sellableLots);
  const unitsPerLot = numberValue(attributes.unitsPerLot);
  const physicalUnits = numberValue(attributes.totalPhysicalUnits);
  if (lots !== null && (!Number.isInteger(lots) || lots < 1))
    errors.push('sellableLots must be a positive integer');
  if (
    unitsPerLot !== null &&
    (!Number.isInteger(unitsPerLot) || unitsPerLot < 1)
  )
    errors.push('unitsPerLot must be a positive integer');
  if (
    physicalUnits !== null &&
    (!Number.isInteger(physicalUnits) || physicalUnits < 1)
  )
    errors.push('totalPhysicalUnits must be a positive integer');
  if (
    lots !== null &&
    unitsPerLot !== null &&
    physicalUnits !== null &&
    physicalUnits !== lots * unitsPerLot
  ) {
    errors.push('totalPhysicalUnits must equal sellableLots × unitsPerLot');
  }

  if (inventoryMode === 'serialized' && !attributes.serializedUnitCount) {
    warnings.push(
      'Serialized inventory should include one serial record per physical unit before publishing',
    );
  }
  if (isRestrictedBusinessIndustrialFamily(family)) {
    warnings.push(
      'This category is restricted; manual compliance and shipping review is required before publishing',
    );
  }
  if (
    attributes.compatibleEquipment &&
    typeof attributes.compatibleEquipment === 'string'
  ) {
    warnings.push(
      'Compatibility claims require evidence; do not infer them from a model number or photograph',
    );
  }

  return { attributes, errors, warnings };
}

export function businessIndustrialImportAttributeKeys(): string[] {
  return [
    'categoryFamily',
    'manufacturer',
    'model',
    'mpn',
    'voltage',
    'voltageUnit',
    'phase',
    'frequency',
    'frequencyUnit',
    'current',
    'currentUnit',
    'power',
    'powerUnit',
    'capacity',
    'capacityUnit',
    'dimensionsLength',
    'dimensionsWidth',
    'dimensionsHeight',
    'dimensionsUnit',
    'weight',
    'weightUnit',
    'material',
    'pressure',
    'pressureUnit',
    'connectionSize',
    'tolerance',
    'compatibleEquipment',
    'includedComponents',
    'accessories',
    'manuals',
    'missingParts',
    'warrantyTerms',
    'serviceHistory',
    'operatingHours',
    'calibrationStatus',
    'calibrationDate',
    'testResults',
    'testingScope',
    'inspectionDate',
    'certificationType',
    'certificationEvidence',
    'cosmeticCondition',
    'functionalStatus',
    'inventoryMode',
    'sellableLots',
    'unitsPerLot',
    'totalPhysicalUnits',
    'shippingMode',
    'packedLength',
    'packedWidth',
    'packedHeight',
    'packedDimensionsUnit',
    'packedWeight',
    'packedWeightUnit',
    'palletWeight',
    'palletWeightUnit',
    'crateWeight',
    'crateWeightUnit',
    'handlingTime',
    'dispatchLocation',
    'shippingCoverage',
    'freightLoadingFacilities',
    'liftgate',
    'residentialDelivery',
  ];
}
