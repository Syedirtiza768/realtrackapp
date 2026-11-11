import { CatalogImportService } from './catalog-import.service.js';

describe('CatalogImportService.autoMapColumns', () => {
  const service = Object.create(
    CatalogImportService.prototype,
  ) as CatalogImportService;

  it('keeps the source export category ID and category name in their proper fields', () => {
    const mapping = service.autoMapColumns([
      'Channel Id',
      'Marketplace Id',
      'Item Specifics',
      'Measurements',
      'Category Id',
      'Category',
      'Site Id',
      'Marketplace',
      'Images',
      'Currency',
    ]);

    expect(mapping).toMatchObject({
      'Channel Id': 'sourceChannelId',
      'Marketplace Id': 'sourceMarketplaceId',
      'Item Specifics': 'itemSpecifics',
      Measurements: 'measurements',
      'Category Id': 'categoryId',
      Category: 'categoryName',
      'Site Id': 'sourceMarketplaceSiteId',
      Marketplace: 'sourceMarketplaceName',
      Images: 'imageUrls',
      Currency: 'sourcePriceCurrency',
    });
  });

  it('preserves generic eBay File Exchange category mapping', () => {
    expect(service.autoMapColumns(['Category'])).toEqual({
      Category: 'categoryId',
    });
  });
});
