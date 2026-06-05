import { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';
import type { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import type { ListingRecord } from '../../../listings/listing-record.entity.js';

describe('CatalogPublishResolverService', () => {
  const listingId = '1ea01423-e593-41cf-96e7-a7d8eb0abbdd';
  const catalogId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  const listingRecord = {
    id: listingId,
    customLabelSku: 'BLA-17856',
    title: 'Test Part',
    itemPhotoUrl:
      'https://cdn.example.com/a.jpg|https://cdn.example.com/b.jpg',
    startPriceNum: 99.99,
    quantityNum: 1,
    categoryId: '33696',
    description: 'desc',
    cBrand: 'Brand',
    cManufacturerPartNumber: 'MPN-1',
    cType: 'Mirror',
    conditionId: '3000',
    sourceFileName: 'import.csv',
    sourceRowNumber: 42,
  } as ListingRecord;

  function makeService(overrides?: {
    catalogProduct?: CatalogProduct | null;
    listingRecord?: ListingRecord | null;
    savedProduct?: CatalogProduct;
  }) {
    const catalogRepo = {
      findOne: jest.fn(async ({ where }: { where: Record<string, string> }) => {
        if (where.id === catalogId) return overrides?.catalogProduct ?? null;
        if (where.sku === listingRecord.customLabelSku) {
          return overrides?.catalogProduct ?? null;
        }
        return null;
      }),
      create: jest.fn((data: Partial<CatalogProduct>) => ({ id: catalogId, ...data })),
      save: jest.fn(async (p: CatalogProduct) => overrides?.savedProduct ?? p),
    };
    const listingRepo = {
      findOne: jest.fn(async ({ where }: { where: Record<string, string> }) => {
        if (where.id === listingId) {
          return overrides?.listingRecord ?? listingRecord;
        }
        if (where.customLabelSku === listingRecord.customLabelSku) {
          return overrides?.listingRecord ?? listingRecord;
        }
        return null;
      }),
    };
    const assetRepo = { find: jest.fn(async () => []) };

    const service = new CatalogPublishResolverService(
      catalogRepo as never,
      listingRepo as never,
      assetRepo as never,
    );
    return { service, catalogRepo, listingRepo };
  }

  it('creates catalog product from listing record id and returns images', async () => {
    const { service, catalogRepo } = makeService({ catalogProduct: null });
    const result = await service.resolve(listingId);
    expect(result).not.toBeNull();
    expect(catalogRepo.create).toHaveBeenCalled();
    expect(catalogRepo.save).toHaveBeenCalled();
    expect(result!.snapshot.catalogProductId).toBe(catalogId);
    expect(result!.snapshot.imageUrls.length).toBeGreaterThan(0);
    expect(result!.snapshot.listingRecordId).toBe(listingId);
  });

  it('backfills images when catalog product exists but image_urls empty', async () => {
    const emptyCatalog = {
      id: catalogId,
      sku: 'BLA-17856',
      title: 'Existing',
      imageUrls: [],
    } as CatalogProduct;
    const { service, catalogRepo } = makeService({
      catalogProduct: emptyCatalog,
    });
    const result = await service.resolve(listingId);
    expect(result!.snapshot.imageUrls).toHaveLength(2);
    expect(catalogRepo.save).toHaveBeenCalled();
  });
});
