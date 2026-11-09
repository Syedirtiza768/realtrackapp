import type { PipelineImage } from './entities/fashion-publish.entities.js';
import { decide } from './fashion-compliance.rules.js';
import { ebayMasterAttributes, fashionEbayMasterImages } from './fashion-ebay-images.util.js';
import { validateFashionAttributes } from '../verticals/fashion.config.js';
import {
  parseVisionVerdict,
  visionIssues,
  type VisionVerdict,
} from './fashion-vision-check.service.js';

const img = (index: number): PipelineImage => ({
  index,
  sourceUrl: `s${index}`,
  hash: `h${index}`,
  width: 2000,
  height: 2000,
  bytes: 1,
  format: 'jpeg',
  keys: {},
  urls: { ebay_master: `m${index}` },
  flags: [],
  excluded: null,
  error: null,
});

const verdict = (patch: Partial<VisionVerdict>): VisionVerdict => ({
  visibleBrands: [],
  logoMatchesDeclaredBrand: true,
  logoConcerns: [],
  images: [],
  suggestedFix: null,
  ...patch,
});

describe('parseVisionVerdict', () => {
  it('maps photo numbers back to listing image indexes and drops junk', () => {
    const sent = [{ index: 2 }, { index: 5 }];
    const v = parseVisionVerdict(
      '```json\n' +
        JSON.stringify({
          visibleBrands: [{ imageIndex: 1, brand: 'Gucci' }, { imageIndex: 9, brand: 'x' }],
          logoMatchesDeclaredBrand: 'maybe',
          logoConcerns: [{ imageIndex: 0, type: 'Misspelled', detail: 'GUCCl' }, { imageIndex: 0, type: 'weird' }],
          images: [{ index: 1, watermarkOrOtherSellerBranding: 'true' }],
          suggestedFix: { title: 'x'.repeat(120), rationale: 'r' },
        }) +
        '\n```',
      sent,
    );
    expect(v.visibleBrands).toEqual([{ imageIndex: 5, brand: 'Gucci', where: undefined }]);
    expect(v.logoMatchesDeclaredBrand).toBeNull();
    expect(v.logoConcerns).toEqual([{ imageIndex: 2, type: 'misspelled', detail: 'GUCCl' }]);
    expect(v.images[0]).toMatchObject({ index: 5, watermarkOrOtherSellerBranding: true });
    expect(v.suggestedFix?.title).toHaveLength(80);
  });

  it('rejects an empty reply', () => {
    expect(() => parseVisionVerdict('not json', [{ index: 0 }])).toThrow();
  });
});

describe('visionIssues', () => {
  it('blocks a logo that does not match the brand', () => {
    const { issues } = visionIssues(
      verdict({ logoMatchesDeclaredBrand: false, visibleBrands: [{ imageIndex: 0, brand: 'Nike' }] }),
      [img(0)],
    );
    expect(issues[0].code).toBe('LOGO_BRAND_MISMATCH');
    expect(decide(issues)).toBe('BLOCKED');
  });

  it('sends distorted logos and stock photos to review', () => {
    const { issues } = visionIssues(
      verdict({
        logoConcerns: [{ imageIndex: 0, type: 'distorted' }],
        images: [{ index: 1, stockOrCatalogPhoto: true }],
      }),
      [img(0), img(1)],
    );
    expect(issues.map((i) => i.code)).toEqual(['LOGO_DISTORTED', 'IMAGE_STOCK_PHOTO']);
    expect(decide(issues)).toBe('NEEDS_REVIEW');
  });

  it('auto-drops watermarked / off-product photos when others remain', () => {
    const { issues, dropIndexes } = visionIssues(
      verdict({
        images: [
          { index: 0, watermarkOrOtherSellerBranding: true },
          { index: 2, showsDifferentProduct: true },
        ],
      }),
      [img(0), img(1), img(2)],
    );
    expect([...dropIndexes.keys()]).toEqual([0, 2]);
    expect(issues.every((i) => i.autoFixed)).toBe(true);
    expect(decide(issues)).toBe('AUTO_FIXED');
  });

  it('does not drop every photo; asks a human instead', () => {
    const { issues, dropIndexes } = visionIssues(
      verdict({ images: [{ index: 0, heavyTextOverlay: true }] }),
      [img(0)],
    );
    expect(dropIndexes.size).toBe(0);
    expect(decide(issues)).toBe('NEEDS_REVIEW');
  });
});

describe('fashionEbayMasterImages', () => {
  const product = {
    vertical: 'fashion',
    imageUrls: ['a', 'b'],
    verticalAttributes: {
      _ebayMasterUrls: ['m1'],
      _ebayMasterSourceUrls: ['a', 'b'],
    },
  };
  it('uses masters while the catalog photos are unchanged', () => {
    expect(fashionEbayMasterImages(product)).toEqual(['m1']);
  });
  it('stores masters as flat string arrays the Fashion validator accepts', () => {
    const result = validateFashionAttributes({
      brand: 'Lacoste',
      ...ebayMasterAttributes(['m1', 'm2'], ['a', 'b']),
    });
    expect(result.errors).toEqual([]);
    expect(result.attributes._ebayMasterUrls).toEqual(['m1', 'm2']);
    expect(result.attributes._ebayMasterSourceUrls).toEqual(['a', 'b']);
  });

  it('falls back when photos changed or for other verticals', () => {
    expect(fashionEbayMasterImages({ ...product, imageUrls: ['a', 'c'] })).toBeNull();
    expect(fashionEbayMasterImages({ ...product, vertical: 'automotive' })).toBeNull();
    expect(fashionEbayMasterImages({ ...product, verticalAttributes: {} })).toBeNull();
  });
});
