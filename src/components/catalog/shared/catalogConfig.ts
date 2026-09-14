import type { CatalogConfig, ProductVertical } from './catalogTypes';

export const CATALOG_CONFIGS: Record<ProductVertical, CatalogConfig> = {
  automotive: {
    vertical: 'automotive', label: 'Auto Parts', accent: 'blue', route: '/auto-parts/catalog', editorUrl: (id) => id ? `/auto-parts/catalog/products/${id}` : '/auto-parts/listings/new', attributes: [{ key: 'make', label: 'Make' }, { key: 'model', label: 'Model' }, { key: 'partType', label: 'Part type' }, { key: 'placement', label: 'Placement' }], quickAttributes: ['make', 'model', 'partType', 'placement'], protectedStatuses: ['quarantined'],
  },
  business_industrial: {
    vertical: 'business_industrial', label: 'Business & Industrial', accent: 'cyan', route: '/business-industrial/catalog', editorUrl: (id) => id ? `/business-industrial/listings/editor?edit=${encodeURIComponent(id)}` : '/business-industrial/listings/editor', attributes: [
      {
        key: 'categoryFamily',
        label: 'Category family',
        valueLabels: {
          industrial_automation: 'Industrial automation & controls',
          electrical_equipment: 'Electrical equipment & protection',
          machinery_tooling: 'Manufacturing machinery, tooling & spare parts',
          hydraulics_pneumatics: 'Hydraulics, pneumatics, pumps & valves',
          test_measurement: 'Test, measurement & inspection equipment',
          material_handling: 'Material handling & industrial storage',
          commercial_equipment: 'Commercial kitchen, office & retail equipment',
          construction_safety: 'Construction, industrial supplies & safety',
          medical_laboratory: 'Medical and laboratory equipment',
          hazmat_chemical: 'Hazardous materials and chemicals',
        },
      },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'model', label: 'Model' },
      { key: 'mpn', label: 'MPN' },
      { key: 'inventoryMode', label: 'Inventory mode' },
      { key: 'shippingMode', label: 'Shipping mode' },
      { key: 'inputVoltage', label: 'Input voltage' },
      { key: 'inputFrequency', label: 'Input frequency' },
      { key: 'mounting', label: 'Mounting' },
      { key: 'countryOfOrigin', label: 'Country of origin' },
      { key: 'ratedVoltage', label: 'Rated voltage' },
      { key: 'ratedCurrent', label: 'Rated current' },
      { key: 'series', label: 'Series' },
      { key: 'enclosureRating', label: 'Enclosure rating' },
    ], quickAttributes: ['categoryFamily', 'manufacturer', 'model', 'mpn', 'inventoryMode', 'shippingMode'], protectedStatuses: ['quarantined'], filterLabels: { brands: 'Manufacturer' },
  },
  fashion: {
    vertical: 'fashion', label: 'Fashion', accent: 'pink', route: '/fashion/catalog', editorUrl: (id) => id ? `/fashion/listings/${encodeURIComponent(id)}/edit` : '/fashion/listings/new', addLabel: 'Add Item', searchPlaceholder: 'Search SKU, title, brand, category, attributes…', attributes: [
      { key: 'brand', label: 'Brand' },
      { key: 'department', label: 'Department' },
      { key: 'itemType', label: 'Item type' },
      { key: 'productType', label: 'Product type' },
      { key: 'categoryFamily', label: 'Fashion category', valueLabels: { clothing: 'Clothing', footwear: 'Footwear', accessories: 'Accessories' } },
      { key: 'size', label: 'Label size' },
      { key: 'color', label: 'Primary color' },
      { key: 'material', label: 'Material' },
      { key: 'style', label: 'Style' },
      { key: 'pattern', label: 'Pattern' },
      { key: 'authenticityStatus', label: 'Authenticity' },
      { key: 'variantAvailability', label: 'Variant availability' },
    ], quickAttributes: ['brand', 'department', 'itemType', 'size', 'color', 'material'], protectedStatuses: ['quarantined'],
  },
};
