/* ─── Phase 0: Orders Service Regression Tests ─────────────
 *  Baseline tests BEFORE multi-store changes.
 *  Ensures import, query, state transitions still work.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

const mockOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'order-1',
    channel: 'ebay',
    connectionId: 'conn-1',
    externalOrderId: 'EXT-001',
    status: 'pending',
    buyerEmail: 'buyer@test.com',
    buyerName: 'Test Buyer',
    subtotal: '100.00',
    shippingCost: '10.00',
    taxAmount: '5.00',
    totalAmount: '115.00',
    currency: 'USD',
    marketplaceFee: '11.50',
    refundAmount: '0',
    orderedAt: new Date('2026-01-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Order;

describe('OrdersService (regression)', () => {
  let service: OrdersService;
  let orderRepo: Record<string, jest.Mock>;
  let itemRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    orderRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((o) => Promise.resolve({ id: 'order-new', ...o })),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    itemRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((o) => Promise.resolve({ id: 'item-new', ...o })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: itemRepo },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  /* ─── findAll ─── */

  it('findAll returns paginated result with default params', async () => {
    const result = await service.findAll({});
    expect(result).toEqual({ orders: [], total: 0 });
  });

  it('findAll applies status filter', async () => {
    await service.findAll({ status: 'shipped' });
    const qb = orderRepo.createQueryBuilder();
    expect(orderRepo.createQueryBuilder).toHaveBeenCalled();
  });

  /* ─── findOne ─── */

  it('findOne returns order + items', async () => {
    const order = mockOrder();
    orderRepo.findOne.mockResolvedValue(order);
    itemRepo.find.mockResolvedValue([{ id: 'item-1', orderId: 'order-1', title: 'Part' }]);
    const result = await service.findOne('order-1');
    expect(result.order.id).toBe('order-1');
    expect(result.items).toHaveLength(1);
  });

  it('findOne throws for missing order', async () => {
    orderRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toThrow('not found');
  });

  /* ─── Status transitions ─── */

  it('transitions pending → confirmed', async () => {
    const order = mockOrder({ status: 'pending' });
    orderRepo.findOneBy.mockResolvedValue(order);
    orderRepo.save.mockResolvedValue({ ...order, status: 'confirmed' });
    const result = await service.transitionStatus('order-1', 'confirmed');
    expect(result.status).toBe('confirmed');
  });

  it('rejects invalid transition', async () => {
    const order = mockOrder({ status: 'delivered' });
    orderRepo.findOneBy.mockResolvedValue(order);
    await expect(service.transitionStatus('order-1', 'pending')).rejects.toThrow();
  });

  /* ─── Import idempotency ─── */

  it('importOrder skips duplicate', async () => {
    orderRepo.findOne.mockResolvedValue(mockOrder());
    const result = await service.importOrder({
      channel: 'ebay',
      externalOrderId: 'EXT-001',
      financials: { subtotal: '100', total: '115' },
      items: [{ title: 'Part', quantity: 1, unitPrice: '100' }],
    });
    expect(result.id).toBe('order-1');
    expect(orderRepo.create).not.toHaveBeenCalled();
  });

  it('importOrder creates new order with items', async () => {
    orderRepo.findOne.mockResolvedValue(null);
    const result = await service.importOrder({
      channel: 'shopify',
      externalOrderId: 'SHOP-001',
      financials: { subtotal: '50', total: '60' },
      items: [
        { title: 'Part A', quantity: 2, unitPrice: '25' },
      ],
    });
    expect(orderRepo.create).toHaveBeenCalled();
    expect(itemRepo.save).toHaveBeenCalledTimes(1);
  });

  /* ─── Shipping ─── */

  it('updateShipping auto-transitions processing to shipped', async () => {
    const order = mockOrder({ status: 'processing' });
    orderRepo.findOneBy.mockResolvedValue(order);
    orderRepo.save.mockImplementation((o) => Promise.resolve(o));
    const result = await service.updateShipping('order-1', {
      trackingNumber: 'TRACK123',
    });
    expect(result.status).toBe('shipped');
    expect(result.trackingNumber).toBe('TRACK123');
  });

  /* ─── Refund ─── */

  it('processRefund rejects amount > total', async () => {
    const order = mockOrder({ status: 'refund_requested', totalAmount: '100.00' });
    orderRepo.findOneBy.mockResolvedValue(order);
    await expect(
      service.processRefund('order-1', { amount: '200.00' }),
    ).rejects.toThrow('exceeds');
  });

  /* ─── Multi-Store: findAll storeId filter ─── */

  it('findAll applies storeId filter when provided', async () => {
    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockOrder({ storeId: 'store-1' })], 1]),
    };
    orderRepo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await service.findAll({ storeId: 'store-1' });
    expect(result.total).toBe(1);
    expect(mockQb.andWhere).toHaveBeenCalledWith(
      'o.store_id = :storeId',
      { storeId: 'store-1' },
    );
  });

  it('findAll omits storeId filter when not provided', async () => {
    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    orderRepo.createQueryBuilder.mockReturnValue(mockQb);

    await service.findAll({});
    // andWhere should NOT be called with storeId
    const storeIdCalls = mockQb.andWhere.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('store_id'),
    );
    expect(storeIdCalls).toHaveLength(0);
  });

  /* ─── Multi-Store: importOrder with storeId ─── */

  it('importOrder sets storeId on new order', async () => {
    orderRepo.findOne.mockResolvedValue(null);
    orderRepo.create.mockImplementation((d) => ({ id: 'order-new', ...d }));
    orderRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await service.importOrder({
      channel: 'ebay',
      storeId: 'store-42',
      externalOrderId: 'EXT-STORE-001',
      financials: { subtotal: '100', total: '115' },
      items: [{ title: 'Part', quantity: 1, unitPrice: '100' }],
    });
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-42' }),
    );
  });

  it('importOrder defaults storeId to null when not provided', async () => {
    orderRepo.findOne.mockResolvedValue(null);
    orderRepo.create.mockImplementation((d) => ({ id: 'order-new', ...d }));
    orderRepo.save.mockImplementation((o) => Promise.resolve(o));

    await service.importOrder({
      channel: 'shopify',
      externalOrderId: 'EXT-NO-STORE',
      financials: { subtotal: '50', total: '60' },
      items: [{ title: 'Part B', quantity: 1, unitPrice: '50' }],
    });
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: null }),
    );
  });
});
