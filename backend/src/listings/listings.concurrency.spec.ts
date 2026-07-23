import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ListingsService } from './listings.service.js';
import { ListingRecord } from './listing-record.entity.js';
import { ListingRevision } from './listing-revision.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { TeamsService } from '../teams/teams.service.js';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test',
  role: 'user',
  active: true,
  lastLoginAt: null,
  createdAt: new Date(),
};

describe('ListingsService concurrency', () => {
  let service: ListingsService;
  let findOne: jest.Mock;
  let save: jest.Mock;

  beforeEach(async () => {
    findOne = jest.fn();
    save = jest.fn().mockImplementation((_entity, data) =>
      Promise.resolve({
        ...data,
        version: typeof data.version === 'number' ? data.version + 1 : 4,
      }),
    );

    const module = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getRepositoryToken(ListingRecord),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ListingRevision),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CatalogProduct),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(ListingActionLog),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (fn) =>
              fn({
                findOne,
                save,
                update: jest.fn().mockResolvedValue({ affected: 1 }),
                create: jest.fn((_entity, data) => data),
              }),
            ),
          },
        },
        {
          provide: RbacService,
          useValue: {
            getPermissionKeysForUser: jest
              .fn()
              .mockResolvedValue(
                new Set([
                  'listings.update',
                  'listings.revise',
                  'listings.price_override',
                  'listings.approve',
                ]),
              ),
            userHasPermission: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: StoreAccessService,
          useValue: { getAccessibleStoreIds: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: TeamsService,
          useValue: { getUserTeamIds: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get(ListingsService);
  });

  it('patchStatus succeeds when version matches', async () => {
    findOne.mockResolvedValue({
      id: 'listing-1',
      status: 'draft',
      version: 3,
      publishedAt: null,
      organizationId: null,
    });

    const result = await service.patchStatus(
      'listing-1',
      {
        status: 'ready',
        version: 3,
      },
      mockUser as any,
    );

    expect(result.listing.status).toBe('ready');
    expect(save).toHaveBeenCalled();
  });

  it('patchStatus throws 409 when version is stale', async () => {
    findOne.mockResolvedValue({
      id: 'listing-1',
      status: 'draft',
      version: 5,
      publishedAt: null,
      organizationId: null,
    });

    await expect(
      service.patchStatus(
        'listing-1',
        { status: 'ready', version: 3 },
        mockUser as any,
      ),
    ).rejects.toMatchObject({
      response: {
        currentVersion: 5,
        yourVersion: 3,
      },
    });
    await expect(
      service.patchStatus(
        'listing-1',
        { status: 'ready', version: 3 },
        mockUser as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('patchStatus throws 404 when listing missing', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      service.patchStatus(
        'missing',
        { status: 'ready', version: 1 },
        mockUser as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update syncs startPriceNum and propagates price to catalog + siblings', async () => {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const dataSource = {
      transaction: jest.fn(async (fn: (em: unknown) => Promise<unknown>) =>
        fn({
          findOne,
          save,
          update,
          create: jest.fn((_entity: unknown, data: unknown) => data),
        }),
      ),
    };
    (service as unknown as { dataSource: typeof dataSource }).dataSource =
      dataSource as never;

    findOne
      .mockResolvedValueOnce({
        id: 'listing-base',
        status: 'draft',
        version: 3,
        customLabelSku: 'BLA-18699',
        startPrice: '100.00',
        startPriceNum: 100,
        quantity: '1',
        quantityNum: 1,
        organizationId: null,
      })
      .mockResolvedValueOnce(null); // no existing revision

    save.mockImplementation((_entity, data) =>
      Promise.resolve({
        ...data,
        version: 4,
      }),
    );

    const result = await service.update(
      'listing-base',
      { version: 3, startPrice: '59' },
      mockUser as any,
    );

    expect(result.listing.startPrice).toBe('59');
    expect(result.listing.startPriceNum).toBe(59);
    expect(update).toHaveBeenCalledWith(
      CatalogProduct,
      { sku: 'BLA-18699' },
      { price: 59 },
    );
    expect(update).toHaveBeenCalledWith(
      ListingRecord,
      { customLabelSku: 'BLA-18699' },
      { startPrice: '59', startPriceNum: 59 },
    );
  });
});
