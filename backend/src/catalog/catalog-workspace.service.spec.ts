import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { User } from '../auth/entities/user.entity.js';
import {
  CatalogWorkspaceService,
  resolvePublicationStatus,
} from './catalog-workspace.service.js';

describe('CatalogWorkspaceService', () => {
  const user = { id: 'user-1' } as User;

  function makeService(options?: {
    manageAllTeams?: boolean;
    teamIds?: string[];
    storeIds?: string[];
  }) {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(undefined),
      getQueryAndParameters: jest.fn(() => ['select 1', [] as unknown[]]),
    };
    const productRepo = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };
    const channelRepo = { exists: jest.fn().mockResolvedValue(false) };
    const service = new CatalogWorkspaceService(
      productRepo as never,
      channelRepo as never,
      {} as never,
      {} as never,
      {
        create: jest.fn((value: unknown) => value as object),
        save: jest.fn(),
      } as never,
      {} as never,
      {} as never,
      {
        resolveOrganizationId: jest
          .fn()
          .mockResolvedValue({ organizationId: 'org-2' }),
      } as never,
      {
        resolveStoreFilter: jest.fn().mockResolvedValue(options?.storeIds),
      } as never,
      {
        getUserTeamIds: jest.fn().mockResolvedValue(options?.teamIds ?? []),
      } as never,
      {
        userHasPermission: jest
          .fn()
          .mockResolvedValue(options?.manageAllTeams ?? false),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, queryBuilder, productRepo };
  }

  it('requires organization and vertical predicates before returning a product', async () => {
    const { service, queryBuilder } = makeService();
    await expect(
      service.detail(user, 'fashion', 'product-1', 'org-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'p.organizationId = :organizationId',
      { organizationId: 'org-2' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'p.vertical = :vertical',
      { vertical: 'fashion' },
    );
  });

  it('rejects team filters outside the caller team scope', async () => {
    const { service } = makeService({ teamIds: ['team-own'] });
    await expect(
      service.search(user, 'business_industrial', { teamIds: 'team-foreign' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('omits marketplace facets when the caller has no accessible stores', async () => {
    const { service, productRepo } = makeService({ storeIds: [] });
    const result = await service.facets(user, 'business_industrial', {});
    expect(result.marketplaces).toEqual([]);
    const [facetSql] = productRepo.query.mock.calls[0] as [string, unknown[]];
    expect(facetSql).not.toContain('ebay_listing_channels facet_channel');
  });

  it('derives every facet from one filtered query and maps the rows', async () => {
    const { service, productRepo } = makeService({ manageAllTeams: true });
    const row = (
      facet: string,
      fields: Partial<{
        facet_key: string | null;
        value: string | null;
        count: string | null;
        num: string | null;
      }> = {},
    ) => ({
      facet,
      facet_key: null,
      value: null,
      label: null,
      color: null,
      count: null,
      num: null,
      ...fields,
    });
    productRepo.query.mockResolvedValueOnce([
      row('total', { facet_key: 'all', count: '7' }),
      row('stockLevels', { facet_key: 'in_stock', count: '5' }),
      row('catalogStatuses', { facet_key: 'published', count: '3' }),
      row('price', { facet_key: 'min', num: '1.50' }),
      row('price', { facet_key: 'max' }),
      row('brands', { value: 'Nike', count: '4' }),
      row('attribute', { facet_key: 'size', value: 'M', count: '2' }),
    ]);
    const result = await service.facets(user, 'fashion', {});
    expect(result.totalFiltered).toBe(7);
    expect(
      result.stockLevels.find((bucket) => bucket.value === 'in_stock')?.count,
    ).toBe(5);
    expect(
      result.catalogStatuses.find((bucket) => bucket.value === 'published')
        ?.count,
    ).toBe(3);
    expect(
      result.catalogStatuses.find((bucket) => bucket.value === 'blocked')
        ?.count,
    ).toBe(0);
    expect(result.priceRange).toEqual({ min: 1.5, max: null });
    expect(result.brands).toEqual([{ value: 'Nike', label: 'Nike', count: 4 }]);
    expect(result.attributeFacets).toEqual({
      size: [{ value: 'M', label: 'M', count: 2 }],
    });
    expect(productRepo.query).toHaveBeenCalledTimes(1);
    const [facetSql] = productRepo.query.mock.calls[0] as [string, unknown[]];
    expect(facetSql.startsWith('with filtered as materialized (')).toBe(true);
  });

  it('sorts newest by creation date and updated by last update', () => {
    const { service } = makeService();
    const applySort = (
      service as unknown as {
        applySort: (qb: unknown, sort: string | undefined, hasQuery: boolean) => void;
      }
    ).applySort.bind(service);
    const makeQb = () => ({
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    });

    const newest = makeQb();
    applySort(newest, 'newest', false);
    expect(newest.orderBy).toHaveBeenCalledWith('p.createdAt', 'DESC');

    const defaultSort = makeQb();
    applySort(defaultSort, undefined, false);
    expect(defaultSort.orderBy).toHaveBeenCalledWith('p.createdAt', 'DESC');

    const updated = makeQb();
    applySort(updated, 'updated', false);
    expect(updated.orderBy).toHaveBeenCalledWith('p.updatedAt', 'DESC');
  });

  it('matches condition filters against either condition id or label', async () => {
    const { service, queryBuilder } = makeService({ manageAllTeams: true });
    const applySearchAndFilters = (
      service as unknown as {
        applySearchAndFilters: (
          qb: typeof queryBuilder,
          vertical: string,
          dto: { conditions?: string },
          scope: { organizationId: string; teamIds: string[]; manageAllTeams: boolean },
        ) => void;
      }
    ).applySearchAndFilters.bind(service);
    applySearchAndFilters(
      queryBuilder,
      'business_industrial',
      { conditions: 'USED,3000' },
      { organizationId: 'org-2', teamIds: [], manageAllTeams: true },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(p.conditionId IN (:...catalogConditions) OR p.conditionLabel IN (:...catalogConditions))',
      { catalogConditions: ['USED', '3000'] },
    );
  });

  it.each(['fashion', 'business_industrial'] as const)(
    'fails closed when %s bulk delete targets a published product',
    async (vertical) => {
      const { service, queryBuilder, productRepo } = makeService();
      queryBuilder.getOne.mockResolvedValue({
        id: 'product-1',
        vertical,
        organizationId: 'org-2',
        verticalValidationStatus: 'published',
        manualReview: false,
      });
      const result = await service.bulkDelete(user, vertical, {
        productIds: ['product-1'],
      });
      expect(result.failed).toBe(1);
      expect(productRepo.save).not.toHaveBeenCalled();
    },
  );

  it('marks catalog rows published from a live channel, ebay item id, or listing record', () => {
    expect(
      resolvePublicationStatus({
        verticalValidationStatus: 'approved',
        manualReview: false,
        ebayItemId: null,
        publications: [{ listingStatus: 'published' }],
      }),
    ).toBe('published');
    expect(
      resolvePublicationStatus({
        verticalValidationStatus: 'needs_review',
        manualReview: false,
        ebayItemId: '128080630052',
        publications: [],
      }),
    ).toBe('published');
    expect(
      resolvePublicationStatus({
        verticalValidationStatus: 'approved',
        manualReview: false,
        ebayItemId: null,
        publications: [],
      }),
    ).toBe('unpublished');
    expect(
      resolvePublicationStatus({
        verticalValidationStatus: 'quarantined',
        manualReview: false,
        ebayItemId: '128080630052',
        publications: [{ listingStatus: 'published' }],
      }),
    ).toBe('blocked');
  });

  it('treats ebay item ids as published in catalog status SQL', () => {
    const { service } = makeService({ manageAllTeams: true });
    const sql = (
      service as unknown as {
        publishedSql: (scope: {
          organizationId: string;
          accessibleStoreIds?: string[];
        }) => string;
      }
    ).publishedSql({ organizationId: 'org-2' });
    expect(sql).toContain('p.ebay_item_id IS NOT NULL');
    expect(sql).toContain('pub.vertical is null');
    expect(sql).toContain('lr."ebayListingId" is not null');
    // A per-row correlated EXISTS made facets re-check the publication tables
    // for every catalog row; keep the predicate uncorrelated (hashed once).
    expect(sql).not.toMatch(/exists\s*\(/i);
    expect(sql).toContain(':publishedOrganizationId');
    const emptyStoreSql = (
      service as unknown as {
        publishedSql: (scope: {
          organizationId: string;
          accessibleStoreIds?: string[];
        }) => string;
      }
    ).publishedSql({ organizationId: 'org-2', accessibleStoreIds: [] });
    expect(emptyStoreSql).not.toContain('1 = 0');
  });
});
