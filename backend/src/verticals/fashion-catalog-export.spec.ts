import {
  customAspectPairs,
  fashionCatalogExportAttributes,
} from './fashion-catalog-export.js';
import { fashionAspectsFromAttributes } from './fashion.config.js';

describe('Fashion catalogue export import adapter', () => {
  it('maps source specifics, retains unknown editable specifics and source metadata', () => {
    const attributes = fashionCatalogExportAttributes({
      title: 'Adidas track jacket',
      categoryName: 'Track Jackets',
      brand: '',
      itemSpecifics:
        'Brand: Adidas; Department: Men; Color: Black; Accents: Logo; Closure: Zip; Season: Fall, Spring, Summer',
      measurements:
        '[{"Name":"Shoulder Width","Label":"A","Value":"19"},{"Name":"Chest/Bust","Label":"B","Value":"22"}]',
      imageUrls: 'https://images.example/a.jpg|https://images.example/b.png',
      sourceChannelStatus: 'failed',
      sourceChannelId: 'To Be Listed',
      sourceMarketplaceId: '7',
      sourceMarketplaceName: 'ebay.com',
      sourceMarketplaceSiteId: 'EBAY_US',
      sourceMarketplaceItemId: '123456789',
      sourceAccountName: 'Artistic Haul DE',
      sourcePriceCurrency: 'USD',
      sourceCondition: 'Pre-owned',
      sourceListingUrl: 'https://www.ebay.com/itm/123456789',
    });

    expect(attributes).toMatchObject({
      categoryFamily: 'clothing',
      brand: 'Adidas',
      department: 'Men',
      color: 'Black',
      closure: 'Zip',
      season: ['Fall', 'Spring', 'Summer'],
      measurements: 'A. Shoulder Width: 19\nB. Chest/Bust: 22',
      _measurementUnitReviewRequired: true,
      _imageMirrorExpected: '2',
      _imageMirrorStatus: 'pending',
      _sourceChannelStatus: 'failed',
      _sourceMarketplaceItemId: '123456789',
      _sourceMarketplaceName: 'ebay.com',
      _sourcePriceCurrency: 'USD',
    });
    expect(customAspectPairs(attributes)).toEqual([['Accents', 'Logo']]);
    expect(fashionAspectsFromAttributes(attributes, 'Adidas')).toMatchObject({
      Brand: ['Adidas'],
      Department: ['Men'],
      Color: ['Black'],
      Closure: ['Zip'],
      Season: ['Fall', 'Spring', 'Summer'],
      Accents: ['Logo'],
    });
    expect(fashionAspectsFromAttributes(attributes)).not.toHaveProperty(
      '_sourceMarketplaceItemId',
    );
  });

  it('keeps malformed measurements editable and marks an empty source gallery for review', () => {
    const attributes = fashionCatalogExportAttributes({
      title: 'Vintage blouse',
      measurements: 'A: Shoulder 18 cm',
      imageUrls: '',
      sourceMarketplaceItemId: '987654321',
      sourceMarketplaceId: '7',
      sourceChannelId: 'To Be Listed',
      sourceAccountName: 'Artistic Haul DE',
    });

    expect(attributes.measurements).toBe('A: Shoulder 18 cm');
    expect(attributes._measurementUnitReviewRequired).toBe(true);
    expect(attributes._imageMirrorStatus).toBe('failed');
    expect(attributes._imageMirrorExpected).toBe('0');
  });
});
