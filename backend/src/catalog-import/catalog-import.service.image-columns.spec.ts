import { CatalogImportService } from './catalog-import.service.js';

describe('CatalogImportService.autoMapColumns image columns', () => {
  const service = Object.create(
    CatalogImportService.prototype,
  ) as CatalogImportService;

  it('maps the pipe-delimited all_image_urls column to imageUrls', () => {
    expect(
      service.autoMapColumns([
        'item_id',
        'image_url',
        'image_1',
        'all_image_urls',
        'description_html',
      ]),
    ).toEqual({ all_image_urls: 'imageUrls' });
  });
});
