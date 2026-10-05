import {
  resolveSafePublishCategory,
  SAFE_PUBLISH_FALLBACK_CATEGORY_ID,
} from './ebay-publish-category.util.js';

describe('ebay-publish-category.util', () => {
  it('falls back from a generic engine category for a non-engine part', () => {
    expect(
      resolveSafePublishCategory({
        categoryId: '33615',
        categoryName: 'Engines',
        listingText: 'FEBI Chain Tensioner for camshaft',
      }),
    ).toEqual({ categoryId: SAFE_PUBLISH_FALLBACK_CATEGORY_ID, changed: true });
  });

  it('keeps a complete engine in the engine category', () => {
    expect(
      resolveSafePublishCategory({
        categoryId: '33615',
        categoryName: 'Engines',
        listingText: 'Complete Engine Assembly Audi 2.0 TDI',
      }),
    ).toEqual({ categoryId: '33615', changed: false });
  });

  it('handles a name-only generic engine category', () => {
    expect(
      resolveSafePublishCategory({
        categoryName: 'Engine',
        listingText: 'Transmission Oil Filter Audi',
      }).categoryId,
    ).toBe(SAFE_PUBLISH_FALLBACK_CATEGORY_ID);
  });

  it('falls back from a stale transmission-fluid category for a non-fluid part', () => {
    expect(
      resolveSafePublishCategory({
        categoryId: '179501',
        categoryName: 'Transmission Fluid',
        listingText: 'FEBI Propshaft Centre Support BMW 5 Series',
      }),
    ).toEqual({ categoryId: SAFE_PUBLISH_FALLBACK_CATEGORY_ID, changed: true });
  });

  it('keeps a genuine transmission fluid in the fluid category', () => {
    expect(
      resolveSafePublishCategory({
        categoryId: '179501',
        categoryName: 'Transmission Fluid',
        listingText: 'Automatic Transmission Fluid ATF 1L',
      }),
    ).toEqual({ categoryId: '179501', changed: false });
  });
});
