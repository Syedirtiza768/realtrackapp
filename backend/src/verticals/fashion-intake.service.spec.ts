/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access -- lightweight repository/queue mocks */
import { BadRequestException } from '@nestjs/common';
import {
  FashionIntakeService,
  pendingFashionTitle,
} from './fashion-intake.service';
import type { CreateFashionIntakeDto } from './fashion.dto';

type Product = Record<string, any>;

function setup(product?: Product) {
  const saved: Product[] = [];
  const logs: unknown[] = [];
  const repo = {
    findOneBy: jest.fn(async () => (product ? { ...product } : null)),
    findOne: jest.fn(async () => (product ? { ...product } : null)),
    save: jest.fn(async (value: Product) => {
      if (value.action) logs.push(value);
      else {
        saved.push(value);
        if (product) Object.assign(product, value);
      }
      return value;
    }),
  };
  const manager = { getRepository: () => repo };
  const db = {
    getRepository: () => repo,
    transaction: async (fn: (m: typeof manager) => unknown) => fn(manager),
  };
  const organizations = {
    resolveOrganizationId: jest.fn(async () => ({ organizationId: 'org-1' })),
  };
  const listings = {
    create: jest.fn(async (_user: unknown, dto: Product) => ({
      id: 'p-1',
      ...dto,
    })),
    account: jest.fn(),
  };
  const images = { analyzeImages: jest.fn() };
  const queue = { add: jest.fn(async () => undefined) };
  const service = new FashionIntakeService(
    db as never,
    organizations as never,
    listings as never,
    images as never,
    queue as never,
  );
  return { service, listings, images, queue, saved, logs };
}

const user = { id: 'user-1' } as never;
const baseDto: CreateFashionIntakeDto = {
  sku: 'AVP-0001-M',
  batch: 'avp',
  frontImageUrl: 'https://cdn.test/front.webp',
  backImageUrl: 'https://cdn.test/back.webp',
  tagImageUrls: ['https://cdn.test/tag.webp'],
  additionalImageUrls: ['https://cdn.test/ruler.webp'],
  sizeChartImageUrl: 'https://cdn.test/chart.webp',
  department: 'Unisex',
  conditionId: '3000',
  sizeChartTemplate: 'tshirt',
  measurementsUnit: 'in',
  measurementValues: {
    shoulderMeasurement: '19',
    chestMeasurement: '38',
    sleeveMeasurement: '6',
    bodyLengthMeasurement: '39',
    sleeveWidthMeasurement: '7',
  },
};

describe('FashionIntakeService.create', () => {
  it('orders photos by slot, stores roles, confirms entered values and queues identification', async () => {
    const { service, listings, queue } = setup();
    await service.create(user, baseDto);
    const draft = listings.create.mock.calls[0][1];
    expect(draft.title).toBe(pendingFashionTitle('AVP-0001-M'));
    expect(draft.imageUrls).toEqual([
      'https://cdn.test/front.webp',
      'https://cdn.test/back.webp',
      'https://cdn.test/tag.webp',
      'https://cdn.test/ruler.webp',
      'https://cdn.test/chart.webp',
    ]);
    expect(draft.verticalAttributes._photoRoles).toEqual([
      'front:https://cdn.test/front.webp',
      'back:https://cdn.test/back.webp',
      'tag:https://cdn.test/tag.webp',
      'additional:https://cdn.test/ruler.webp',
      'sizeChart:https://cdn.test/chart.webp',
    ]);
    expect(draft.verticalAttributes._intakeBatch).toBe('AVP');
    expect(draft.verticalAttributes.shoulderMeasurement).toBe('19');
    expect(draft.verticalAttributes._confirmedKeys).toEqual(
      expect.arrayContaining([
        'department',
        'sizeChartTemplate',
        'chestMeasurement',
      ]),
    );
    expect(draft.verticalAttributes._analysisStatus).toBe('queued');
    expect(queue.add).toHaveBeenCalledWith(
      'identify',
      { productId: 'p-1', organizationId: 'org-1' },
      expect.any(Object),
    );
  });

  it('requires every point on the chosen measurement chart', async () => {
    const { service, listings } = setup();
    await expect(
      service.create(user, {
        ...baseDto,
        measurementValues: { shoulderMeasurement: '19' },
      }),
    ).rejects.toThrow(/Enter every measurement/);
    expect(listings.create).not.toHaveBeenCalled();
  });

  it('rejects reusing one photo in two slots', async () => {
    const { service } = setup();
    await expect(
      service.create(user, { ...baseDto, backImageUrl: baseDto.frontImageUrl }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not queue when identification is skipped', async () => {
    const { service, queue, listings } = setup();
    await service.create(user, { ...baseDto, identify: false });
    expect(queue.add).not.toHaveBeenCalled();
    expect(
      listings.create.mock.calls[0][1].verticalAttributes._analysisStatus,
    ).toBe('skipped');
  });
});

describe('FashionIntakeService.processIdentification', () => {
  const analysis = {
    status: 'suggested',
    attributes: {
      categoryFamily: 'clothing',
      department: 'Men',
      color: 'Blue',
      itemType: 'T-Shirt',
      _suggestedKeys: ['color'],
    },
    suggestedKeys: ['color', 'itemType'],
    conflicts: [],
    warnings: [],
    validationErrors: [],
    multipleItems: false,
    reviewPhotoSet: false,
    category: {
      categoryId: '15687',
      categoryName: 'T-Shirts',
      query: 't-shirt',
    },
    brand: 'Gildan',
    conditionLabel: 'USED',
    title: 'Gildan Unisex Blue Graphic T-Shirt Size XL',
    description: 'Item type: T-Shirt',
    suggestedSku: 'AVP-0001-M',
    visibleText: [],
  };

  it('replaces the placeholder title, fills gaps and keeps confirmed values', async () => {
    const product: Product = {
      id: 'p-1',
      organizationId: 'org-1',
      vertical: 'fashion',
      sku: 'AVP-0001-M',
      title: pendingFashionTitle('AVP-0001-M'),
      description: null,
      brand: null,
      conditionId: null,
      categoryId: null,
      verticalValidationStatus: 'draft',
      manualReview: false,
      imageUrls: ['https://cdn.test/front.webp', 'https://cdn.test/chart.webp'],
      verticalAttributes: {
        categoryFamily: 'clothing',
        department: 'Unisex',
        _confirmedKeys: ['department'],
        _photoRoles: [
          'front:https://cdn.test/front.webp',
          'sizeChart:https://cdn.test/chart.webp',
        ],
        // An editor save before identification finished must not lock the placeholder title.
        _titleConfirmed: true,
      },
    };
    const { service, images } = setup(product);
    images.analyzeImages.mockResolvedValue(analysis);
    await expect(
      service.processIdentification({
        productId: 'p-1',
        organizationId: 'org-1',
      }),
    ).resolves.toEqual({ status: 'suggested' });

    expect(images.analyzeImages.mock.calls[0][0].imageUrls).toEqual([
      'https://cdn.test/front.webp',
    ]);
    expect(product.title).toBe(analysis.title);
    expect(product.brand).toBe('Gildan');
    expect(product.conditionId).toBe('3000');
    expect(product.categoryId).toBe('15687');
    expect(product.verticalAttributes.department).toBe('Unisex');
    expect(product.verticalAttributes.color).toBe('Blue');
    expect(product.verticalAttributes._conflictKeys).toEqual(['department']);
    expect(product.verticalAttributes._analysisStatus).toBe('suggested');
    expect(product.verticalValidationStatus).toBe('draft');
  });

  it('never changes approved listings', async () => {
    const product: Product = {
      id: 'p-1',
      organizationId: 'org-1',
      vertical: 'fashion',
      sku: 'AVP-0001-M',
      title: 'Approved title',
      verticalValidationStatus: 'approved',
      manualReview: false,
      imageUrls: ['https://cdn.test/front.webp'],
      verticalAttributes: {},
    };
    const { service, images } = setup(product);
    await expect(
      service.processIdentification({
        productId: 'p-1',
        organizationId: 'org-1',
      }),
    ).resolves.toEqual({ skipped: 'not_identifiable' });
    expect(images.analyzeImages).not.toHaveBeenCalled();
    expect(product.title).toBe('Approved title');
  });

  it('records failure without touching listing content', async () => {
    const product: Product = {
      id: 'p-1',
      organizationId: 'org-1',
      vertical: 'fashion',
      sku: 'AVP-0001-M',
      title: pendingFashionTitle('AVP-0001-M'),
      verticalValidationStatus: 'draft',
      manualReview: false,
      imageUrls: ['https://cdn.test/front.webp'],
      verticalAttributes: { categoryFamily: 'clothing' },
    };
    const { service, images } = setup(product);
    images.analyzeImages.mockResolvedValue({
      ...analysis,
      status: 'failed',
      warnings: ['Vision unavailable'],
    });
    await service.processIdentification({
      productId: 'p-1',
      organizationId: 'org-1',
    });
    expect(product.title).toBe(pendingFashionTitle('AVP-0001-M'));
    expect(product.verticalAttributes._analysisStatus).toBe('failed');
    expect(product.verticalAttributes._warnings).toEqual([
      'Vision unavailable',
    ]);
  });
});
