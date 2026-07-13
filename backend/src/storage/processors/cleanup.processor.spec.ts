import { CleanupProcessor } from './cleanup.processor.js';
import type { ImageAsset } from '../entities/image-asset.entity.js';

/**
 * Regression coverage for the 2026-07 dead-temp-URL incidents (see
 * CHANGELOG.md): the daily orphan-temp cleanup must never hard-delete a
 * temp/ upload that a listing_records/catalog_products row still points at
 * — it must mirror the object to durable storage and repoint those rows
 * first ("heal"), only deleting the original once nothing references it.
 */
describe('CleanupProcessor', () => {
  const BUCKET_URL = 'https://test-bucket.s3.amazonaws.com';

  function makeQueryBuilder(matches: unknown[]) {
    const execute = jest.fn(async () => ({ affected: matches.length }));
    const qb: Record<string, jest.Mock> = {
      where: jest.fn(() => qb as never),
      getMany: jest.fn(async () => matches),
      update: jest.fn(() => qb as never),
      set: jest.fn(() => qb as never),
      setParameters: jest.fn(() => qb as never),
      execute,
    };
    return qb as unknown as {
      where: jest.Mock;
      getMany: jest.Mock;
      update: jest.Mock;
      set: jest.Mock;
      setParameters: jest.Mock;
      execute: jest.Mock;
    };
  }

  function makeProcessor(opts: {
    orphanedAssets: ImageAsset[];
    listingMatches: unknown[];
    catalogMatches: unknown[];
  }) {
    const assetRepo = {
      find: jest
        .fn()
        // call 1: soft-deleted assets query
        .mockResolvedValueOnce([])
        // call 2: orphaned temp uploads query
        .mockResolvedValueOnce(opts.orphanedAssets),
      delete: jest.fn(async () => undefined),
    };

    const listingQb = makeQueryBuilder(opts.listingMatches);
    const catalogQb = makeQueryBuilder(opts.catalogMatches);
    const listingRepo = {
      createQueryBuilder: jest.fn(() => listingQb),
    };
    const catalogRepo = {
      createQueryBuilder: jest.fn(() => catalogQb),
    };

    const storageService = {
      isTempKey: jest.fn((key: string) => key.startsWith('mhn/temp/')),
      getCdnUrl: jest.fn((key: string) => `${BUCKET_URL}/${key}`),
      getObjectBuffer: jest.fn(async () => Buffer.from('fake-image-bytes')),
      putObject: jest.fn(async () => undefined),
      deleteObject: jest.fn(async () => undefined),
    };

    const processor = new CleanupProcessor(
      assetRepo as never,
      listingRepo as never,
      catalogRepo as never,
      storageService as never,
    );

    return { processor, assetRepo, listingRepo, catalogRepo, storageService, listingQb, catalogQb };
  }

  const baseAsset = (overrides: Partial<ImageAsset> = {}): ImageAsset =>
    ({
      id: 'asset-1',
      s3Key: 'mhn/temp/abc-123.jpg',
      s3KeyThumb: null,
      mimeType: 'image/jpeg',
      listingId: null,
      jobId: null,
      ...overrides,
    }) as ImageAsset;

  it('deletes an orphaned temp upload with no reference, without healing', async () => {
    const { processor, storageService, assetRepo } = makeProcessor({
      orphanedAssets: [baseAsset()],
      listingMatches: [],
      catalogMatches: [],
    });

    const result = await processor.process({} as never);

    expect(result).toEqual({ cleaned: 1, healed: 0 });
    expect(storageService.putObject).not.toHaveBeenCalled();
    expect(storageService.deleteObject).toHaveBeenCalledWith('mhn/temp/abc-123.jpg');
    expect(assetRepo.delete).toHaveBeenCalledWith('asset-1');
  });

  it('heals a still-referenced temp upload before deleting it (does not destroy the only copy)', async () => {
    const { processor, storageService, listingQb } = makeProcessor({
      orphanedAssets: [baseAsset()],
      listingMatches: [{ id: 'listing-1' }],
      catalogMatches: [],
    });

    const result = await processor.process({} as never);

    // Mirrored to a durable key before the temp original was ever deleted.
    expect(storageService.getObjectBuffer).toHaveBeenCalledWith('mhn/temp/abc-123.jpg');
    expect(storageService.putObject).toHaveBeenCalledWith(
      'catalog-images/healed/abc-123.jpg',
      expect.any(Buffer),
      'image/jpeg',
    );

    // The referencing listing_records row was repointed at the durable URL.
    expect(listingQb.update).toHaveBeenCalled();
    expect(listingQb.setParameters).toHaveBeenCalledWith({
      old: `${BUCKET_URL}/mhn/temp/abc-123.jpg`,
      new: `${BUCKET_URL}/catalog-images/healed/abc-123.jpg`,
    });

    // Only after healing does the original temp object get deleted.
    expect(storageService.deleteObject).toHaveBeenCalledWith('mhn/temp/abc-123.jpg');
    expect(result).toEqual({ cleaned: 1, healed: 1 });
  });

  it('heals via catalog_products.image_urls too, independent of listing_records', async () => {
    const { processor, catalogQb } = makeProcessor({
      orphanedAssets: [baseAsset({ s3Key: 'mhn/temp/def-456.png', mimeType: 'image/png' })],
      listingMatches: [],
      catalogMatches: [{ id: 'catalog-1' }],
    });

    const result = await processor.process({} as never);

    expect(catalogQb.update).toHaveBeenCalled();
    expect(catalogQb.setParameters).toHaveBeenCalledWith({
      old: `${BUCKET_URL}/mhn/temp/def-456.png`,
      new: `${BUCKET_URL}/catalog-images/healed/def-456.png`,
    });
    expect(result).toEqual({ cleaned: 1, healed: 1 });
  });

  it('never checks non-temp keys for references (already-durable assets are never orphan-swept anyway)', async () => {
    const { processor, storageService, listingRepo, catalogRepo } = makeProcessor({
      orphanedAssets: [baseAsset({ s3Key: 'mhn/originals/listing-1/photo.webp' })],
      listingMatches: [],
      catalogMatches: [],
    });

    await processor.process({} as never);

    expect(storageService.isTempKey).toHaveBeenCalledWith('mhn/originals/listing-1/photo.webp');
    expect(listingRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(catalogRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
