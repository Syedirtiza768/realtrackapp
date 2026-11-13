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
  }) {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(undefined),
    };
    const productRepo = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn(),
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
      { resolveStoreFilter: jest.fn().mockResolvedValue(undefined) } as never,
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

  it('returns empty marketplace facets without querying an empty store list', async () => {
    const { service, queryBuilder } = makeService();
    const result = await (service as unknown as {
      marketplaceFacets: (base: unknown, scope: unknown, vertical: string) => Promise<unknown[]>;
    }).marketplaceFacets(queryBuilder, {
      organizationId: 'org-2',
      teamIds: [],
      manageAllTeams: true,
      accessibleStoreIds: [],
    }, 'business_industrial');
    expect(result).toEqual([]);
    expect(queryBuilder.getRawMany).toBeUndefined();
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
