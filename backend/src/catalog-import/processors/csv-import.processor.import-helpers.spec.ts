import {
  imageUrlsFromNumberedColumns,
  importUpdateWithoutBlankOverwrites,
} from './csv-import.processor.js';

describe('imageUrlsFromNumberedColumns', () => {
  it('collects image_url and image_N columns in column order without duplicates', () => {
    const headers = [
      'item_id',
      'image_url',
      'images_count',
      'image_1',
      'image_2',
      'all_image_urls',
      'image_10',
    ];
    const cells = [
      '206657753783',
      'https://i.ebayimg.com/a.JPG',
      '8',
      'https://i.ebayimg.com/a.JPG',
      'https://i.ebayimg.com/b.JPG',
      'https://i.ebayimg.com/a.JPG|https://i.ebayimg.com/b.JPG',
      ' https://i.ebayimg.com/c.JPG ',
    ];

    expect(imageUrlsFromNumberedColumns(headers, cells)).toBe(
      'https://i.ebayimg.com/a.JPG|https://i.ebayimg.com/b.JPG|https://i.ebayimg.com/c.JPG',
    );
  });

  it('ignores blank and non-http cells, returning an empty string when none qualify', () => {
    expect(
      imageUrlsFromNumberedColumns(
        ['image_url', 'image_1'],
        ['', 'not-a-url'],
      ),
    ).toBe('');
  });
});

describe('importUpdateWithoutBlankOverwrites', () => {
  it('keeps existing values when a thinner re-import carries blank columns', () => {
    const update = importUpdateWithoutBlankOverwrites(
      {
        sku: 'FA26-5770',
        title: 'KENZO Boys Black Tiger Sweatshirt',
        brand: null,
        description: '',
        imageUrls: [] as string[],
        categoryId: null,
        price: 55.99,
        verticalAttributes: { categoryFamily: 'clothing', size: '' },
      },
      {
        _sourceFormat: 'artisticserver-fashion-export',
        _imageMirrorStatus: 'complete',
        size: 'S',
        color: 'Black',
      },
    );

    expect(update).toEqual({
      sku: 'FA26-5770',
      title: 'KENZO Boys Black Tiger Sweatshirt',
      price: 55.99,
      verticalAttributes: {
        _sourceFormat: 'artisticserver-fashion-export',
        _imageMirrorStatus: 'complete',
        size: 'S',
        color: 'Black',
        categoryFamily: 'clothing',
      },
    });
  });

  it('lets non-empty imported values replace existing ones', () => {
    expect(
      importUpdateWithoutBlankOverwrites(
        {
          brand: 'FILA',
          imageUrls: ['https://cdn.example/a.webp'],
          verticalAttributes: { _imageMirrorStatus: 'pending', size: 'XL' },
        },
        { _imageMirrorStatus: 'complete', size: 'L' },
      ),
    ).toEqual({
      brand: 'FILA',
      imageUrls: ['https://cdn.example/a.webp'],
      verticalAttributes: { _imageMirrorStatus: 'pending', size: 'XL' },
    });
  });
});
