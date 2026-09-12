import type { CatalogConfig, ProductVertical } from './catalogTypes';

export const CATALOG_CONFIGS: Record<ProductVertical, CatalogConfig> = {
  automotive: {
    vertical: 'automotive', label: 'Auto Parts', accent: 'blue', route: '/auto-parts/catalog', editorUrl: (id) => id ? `/auto-parts/catalog/products/${id}` : '/auto-parts/listings/new', attributes: [{ key: 'make', label: 'Make' }, { key: 'model', label: 'Model' }, { key: 'partType', label: 'Part type' }, { key: 'placement', label: 'Placement' }], quickAttributes: ['make', 'model', 'partType', 'placement'], protectedStatuses: ['quarantined'],
  },
  business_industrial: {
    vertical: 'business_industrial', label: 'Business & Industrial', accent: 'cyan', route: '/business-industrial/catalog', editorUrl: (id) => id ? `/business-industrial/listings/editor?edit=${encodeURIComponent(id)}` : '/business-industrial/listings/editor', attributes: [{ key: 'categoryFamily', label: 'Category family' }, { key: 'manufacturer', label: 'Manufacturer' }, { key: 'model', label: 'Model' }, { key: 'mpn', label: 'MPN' }, { key: 'testingStatus', label: 'Testing status' }, { key: 'functionalStatus', label: 'Functional status' }, { key: 'inventoryMode', label: 'Inventory mode' }, { key: 'includedComponents', label: 'Included components' }, { key: 'missingParts', label: 'Missing components' }], quickAttributes: ['categoryFamily', 'manufacturer', 'model', 'mpn', 'testingStatus', 'inventoryMode'], protectedStatuses: ['quarantined'],
  },
  fashion: {
    vertical: 'fashion', label: 'Fashion', accent: 'pink', route: '/fashion/catalog', editorUrl: (id) => id ? `/fashion/listings/${encodeURIComponent(id)}/edit` : '/fashion/listings/new', attributes: [{ key: 'brand', label: 'Brand' }, { key: 'department', label: 'Department' }, { key: 'productType', label: 'Product type' }, { key: 'size', label: 'Size' }, { key: 'color', label: 'Color' }, { key: 'material', label: 'Material' }, { key: 'style', label: 'Style' }, { key: 'authenticityStatus', label: 'Authenticity' }, { key: 'variantAvailability', label: 'Variant availability' }], quickAttributes: ['brand', 'department', 'productType', 'size', 'color', 'material'], protectedStatuses: ['quarantined'],
  },
};
