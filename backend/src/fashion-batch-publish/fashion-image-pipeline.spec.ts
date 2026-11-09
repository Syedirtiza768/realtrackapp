import sharp from 'sharp';
import {
  dimensionFlags,
  ebayMasterUrls,
  FashionImagePipelineService,
  orientedSize,
  renderVariants,
} from './fashion-image-pipeline.service.js';
import type { PipelineImage } from './entities/fashion-publish.entities.js';

async function photo(width: number, height: number, orientation?: number) {
  let img = sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  }).jpeg();
  if (orientation)
    img = img.withMetadata({
      orientation,
      exif: { IFD0: { Copyright: 'seller' }, GPS: { GPSLatitudeRef: 'N' } } as never,
    });
  return img.toBuffer();
}

describe('fashion image pipeline', () => {
  it('flags small and low-quality images', () => {
    expect(dimensionFlags(400, 300)).toEqual(['below_min', 'low_quality']);
    expect(dimensionFlags(1200, 900)).toEqual(['low_quality']);
    expect(dimensionFlags(3000, 2000)).toEqual([]);
  });

  it('swaps width/height for rotated EXIF orientations', () => {
    expect(orientedSize({ width: 4000, height: 3000, orientation: 6 })).toEqual({
      width: 3000,
      height: 4000,
    });
    expect(orientedSize({ width: 4000, height: 3000, orientation: 1 })).toEqual({
      width: 4000,
      height: 3000,
    });
  });

  it('renders variants at the right sizes, never upscales, strips metadata', async () => {
    const big = await renderVariants(await photo(3000, 4000, 6));
    const master = await sharp(big.ebay_master).metadata();
    // Orientation 6 → displayed 4000x3000 → master capped at 2000 longest side.
    expect(master.format).toBe('jpeg');
    expect(Math.max(master.width!, master.height!)).toBe(2000);
    expect(master.width).toBeGreaterThan(master.height!);
    expect(master.exif).toBeUndefined();
    expect(master.orientation).toBeUndefined();
    const thumb = await sharp(big.thumb).metadata();
    expect(thumb.format).toBe('webp');
    expect(Math.max(thumb.width!, thumb.height!)).toBe(200);
    const large = await sharp(big.large).metadata();
    expect(Math.max(large.width!, large.height!)).toBe(1600);

    const small = await renderVariants(await photo(800, 600));
    const smallMaster = await sharp(small.ebay_master).metadata();
    expect(smallMaster.width).toBe(800);
    const smallLarge = await sharp(small.large).metadata();
    expect(smallLarge.width).toBe(800);
  });

  it('stores original + 4 variants under a content-hash key and reuses them on re-run', async () => {
    const bytes = await photo(1800, 1200);
    const stored = new Map<string, Buffer>();
    const storage = {
      keyFromUrl: (u: string) => (u.startsWith('https://bucket/') ? u.slice(15) : null),
      getObjectBuffer: jest.fn(async () => bytes),
      buildDurableKey: (k: string) => `mhn/${k}`,
      objectExists: jest.fn(async (k: string) => stored.has(k)),
      putObject: jest.fn(async (k: string, b: Buffer) => void stored.set(k, b)),
      getCdnUrl: (k: string) => `https://bucket/${k}`,
    };
    const svc = new FashionImagePipelineService(storage as never);
    const first = await svc.process('L1', [
      'https://bucket/a.jpg',
      'https://bucket/b.jpg',
      'not-a-url',
    ]);
    expect(first.images).toHaveLength(2);
    const [a, b] = first.images;
    expect(a.keys.original).toMatch(/^mhn\/catalog\/L1\/[0-9a-f]{64}\/original\.jpg$/);
    expect(a.keys.ebay_master).toMatch(/\/ebay_master\.jpg$/);
    expect(a.flags).toEqual([]);
    // Same bytes twice → stored once, second copy excluded as a duplicate.
    expect(b.excluded?.code).toBe('IMAGE_DUPLICATE');
    expect(first.masterUrls).toEqual([a.urls.ebay_master]);
    expect(stored.size).toBe(5);

    storage.putObject.mockClear();
    const second = await svc.process('L1', ['https://bucket/a.jpg'], first.images);
    expect(second.images[0].reused).toBe(true);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('keeps only usable masters in order', () => {
    const img = (i: number, extra: Partial<PipelineImage>): PipelineImage => ({
      index: i,
      sourceUrl: `s${i}`,
      hash: `h${i}`,
      width: 2000,
      height: 2000,
      bytes: 1,
      format: 'jpeg',
      keys: {},
      urls: { ebay_master: `m${i}` },
      flags: [],
      excluded: null,
      error: null,
      ...extra,
    });
    expect(
      ebayMasterUrls([
        img(0, { excluded: { code: 'IMAGE_WATERMARK', reason: '' } }),
        img(1, {}),
        img(2, { error: 'boom' }),
        img(3, {}),
      ]),
    ).toEqual(['m1', 'm3']);
  });
});
