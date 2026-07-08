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
});
