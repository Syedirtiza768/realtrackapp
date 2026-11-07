import type { Repository } from 'typeorm';
import type { CatalogProduct } from '../entities/catalog-product.entity.js';
import {
  DuplicateDetectionService,
  UPC_OUTSIDE_SCOPE_STRATEGY,
} from './duplicate-detection.service.js';

type ExistingRow = {
  id: string;
  upc: string | null;
  organizationId: string | null;
  vertical: string | null;
  sku?: string | null;
};

/** Minimal QueryBuilder double: returns `rows` for any getMany() call. */
function fakeRepo(rows: ExistingRow[]) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn().mockResolvedValue(null),
  };
  return { repo, qb };
}

function service(rows: ExistingRow[]) {
  const { repo, qb } = fakeRepo(rows);
  const svc = new DuplicateDetectionService(
    repo as unknown as Repository<CatalogProduct>,
  );
  return { svc, qb };
}

const ORG_A = 'org-a';
const ORG_B = 'org-b';

describe('DuplicateDetectionService.checkDuplicateBatch — UPC layer', () => {
  it('matches an in-scope UPC even when SKU/MPN/title differ', async () => {
    const { svc } = service([
      {
        id: 'p1',
        upc: '012345678905',
        organizationId: ORG_A,
        vertical: 'fashion',
      },
    ]);

    const results = await svc.checkDuplicateBatch(
      [
        {
          index: 0,
          sku: 'NEW-SKU',
          upc: '012345678905',
          title: 'Different title',
        },
      ],
      { organizationId: ORG_A, vertical: 'fashion' },
    );

    expect(results.get(0)).toMatchObject({
      isDuplicate: true,
      matchStrategy: 'upc',
      matchedProductId: 'p1',
    });
  });

  it('flags a UPC held by another organization so it is never inserted', async () => {
    const { svc } = service([
      {
        id: 'p-other',
        upc: '012345678905',
        organizationId: ORG_B,
        vertical: 'fashion',
      },
    ]);

    const results = await svc.checkDuplicateBatch(
      [{ index: 0, upc: '012345678905', sku: 'SKU-1' }],
      { organizationId: ORG_A, vertical: 'fashion' },
    );

    expect(results.get(0)).toMatchObject({
      isDuplicate: false,
      isPartialMatch: false,
      matchStrategy: UPC_OUTSIDE_SCOPE_STRATEGY,
      matchedProductId: 'p-other',
    });
  });

  it('flags a UPC held by another vertical in the same organization', async () => {
    const { svc } = service([
      {
        id: 'p-bi',
        upc: '012345678905',
        organizationId: ORG_A,
        vertical: 'business_industrial',
      },
    ]);

    const results = await svc.checkDuplicateBatch(
      [{ index: 0, upc: '012345678905' }],
      { organizationId: ORG_A, vertical: 'fashion' },
    );

    expect(results.get(0)?.matchStrategy).toBe(UPC_OUTSIDE_SCOPE_STRATEGY);
  });

  it('never queries placeholder UPCs such as "Does not apply"', async () => {
    const { svc, qb } = service([]);

    const results = await svc.checkDuplicateBatch(
      [
        { index: 0, upc: 'Does not apply', sku: 'SKU-1' },
        { index: 1, upc: null, sku: 'SKU-2' },
      ],
      { organizationId: ORG_A, vertical: 'fashion' },
    );

    expect(qb.where).not.toHaveBeenCalledWith(
      'p.upc IN (:...upcs)',
      expect.anything(),
    );
    expect(results.size).toBe(0);
  });

  it('keeps the SKU match when the UPC is a placeholder', async () => {
    const { svc, qb } = service([]);
    // No UPC query runs for a placeholder, so the first query is the SKU lookup.
    qb.getMany.mockResolvedValueOnce([
      { id: 'p-sku', sku: 'SKU-1', organizationId: ORG_A, vertical: 'fashion' },
    ]);

    const results = await svc.checkDuplicateBatch(
      [{ index: 0, upc: 'Does not apply', sku: 'SKU-1' }],
      { organizationId: ORG_A, vertical: 'fashion' },
    );

    expect(results.get(0)).toMatchObject({
      isDuplicate: true,
      matchStrategy: 'sku',
      matchedProductId: 'p-sku',
    });
  });
});
