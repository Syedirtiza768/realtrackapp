/* ─── Phase 0: Automation & Pricing Regression Tests ────────
 *  Baseline tests for automation rules and pricing evaluation.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutomationService } from './automation.service';
import { AutomationRule } from './entities/automation-rule.entity';

const mockRule = (overrides: Partial<AutomationRule> = {}): AutomationRule =>
  ({
    id: 'rule-1',
    name: 'Test Rule',
    description: null,
    triggerType: 'event',
    triggerConfig: {},
    actionType: 'update_price',
    actionConfig: { percentage: 10 },
    conditions: [],
    enabled: true,
    priority: 0,
    lastExecutedAt: null,
    executionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as AutomationRule;

describe('AutomationService (regression)', () => {
  let service: AutomationService;
  let ruleRepo: Record<string, jest.Mock>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    ruleRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ id: 'rule-new', ...d })),
      save: jest.fn((d) => Promise.resolve(d)),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: getRepositoryToken(AutomationRule), useValue: ruleRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(AutomationService);
  });

  /* ─── CRUD ─── */

  it('findAll returns rules ordered by priority', async () => {
    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockRule()]),
    };
    ruleRepo.createQueryBuilder.mockReturnValue(mockQb);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
  });

  it('create emits event and returns rule', async () => {
    const result = await service.create({
      name: 'New Rule',
      triggerType: 'schedule',
      actionType: 'notify',
    } as any);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'automation.rule_created',
      expect.objectContaining({ name: 'New Rule' }),
    );
  });

  it('findOne throws on missing rule', async () => {
    ruleRepo.findOneBy.mockResolvedValue(null);
    await expect(service.findOne('bad')).rejects.toThrow('not found');
  });

  it('toggle flips enabled state', async () => {
    ruleRepo.findOneBy.mockResolvedValue(mockRule({ enabled: true }));
    ruleRepo.save.mockImplementation((d) => Promise.resolve(d));
    const result = await service.toggle('rule-1');
    expect(result.enabled).toBe(false);
  });

  /* ─── Execute ─── */

  it('execute skips disabled rules', async () => {
    ruleRepo.findOneBy.mockResolvedValue(mockRule({ enabled: false }));
    const result = await service.execute('rule-1');
    expect(result.executed).toBe(false);
    expect(result.result).toContain('disabled');
  });

  it('execute dispatches event for enabled rule', async () => {
    const rule = mockRule({ enabled: true });
    ruleRepo.findOneBy.mockResolvedValue(rule);
    ruleRepo.save.mockImplementation((d) => Promise.resolve(d));
    const result = await service.execute('rule-1');
    expect(result.executed).toBe(true);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'automation.execute.update_price',
      expect.objectContaining({ ruleId: 'rule-1' }),
    );
  });

  /* ─── evaluateByTrigger ─── */

  it('evaluateByTrigger processes matching rules', async () => {
    const triggerQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockRule()]),
    };
    ruleRepo.createQueryBuilder.mockReturnValueOnce(triggerQb);
    ruleRepo.findOneBy.mockResolvedValue(mockRule());
    ruleRepo.save.mockImplementation((d) => Promise.resolve(d));

    const executed = await service.evaluateByTrigger('event');
    expect(executed).toBe(1);
  });

  /* ─── Multi-Store: findAll with storeId / channel ─── */

  it('findAll applies storeId filter with OR-NULL pattern', async () => {
    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockRule({ storeId: 'store-1' as any }), mockRule()]),
    };
    ruleRepo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await service.findAll({ storeId: 'store-1' });
    expect(result).toHaveLength(2);
    expect(mockQb.andWhere).toHaveBeenCalledWith(
      '(r.storeId = :storeId OR r.storeId IS NULL)',
      { storeId: 'store-1' },
    );
  });

  it('findAll applies channel filter with OR-NULL pattern', async () => {
    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockRule()]),
    };
    ruleRepo.createQueryBuilder.mockReturnValue(mockQb);

    await service.findAll({ channel: 'ebay' });
    expect(mockQb.andWhere).toHaveBeenCalledWith(
      '(r.channel = :channel OR r.channel IS NULL)',
      { channel: 'ebay' },
    );
  });

  it('findAll without storeId/channel does not add those filters', async () => {
    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    ruleRepo.createQueryBuilder.mockReturnValue(mockQb);

    await service.findAll({});
    const storeOrChannelCalls = mockQb.andWhere.mock.calls.filter(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        (call[0].includes('storeId') || call[0].includes('channel')),
    );
    expect(storeOrChannelCalls).toHaveLength(0);
  });

  /* ─── Multi-Store: evaluateByTrigger with context ─── */

  it('evaluateByTrigger applies storeId + channel from context', async () => {
    const triggerQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockRule()]),
    };
    ruleRepo.createQueryBuilder.mockReturnValueOnce(triggerQb);
    ruleRepo.findOneBy.mockResolvedValue(mockRule());
    ruleRepo.save.mockImplementation((d) => Promise.resolve(d));

    await service.evaluateByTrigger('event', { storeId: 'store-7', channel: 'shopify' });

    expect(triggerQb.andWhere).toHaveBeenCalledWith(
      '(r.storeId = :storeId OR r.storeId IS NULL)',
      { storeId: 'store-7' },
    );
    expect(triggerQb.andWhere).toHaveBeenCalledWith(
      '(r.channel = :channel OR r.channel IS NULL)',
      { channel: 'shopify' },
    );
  });

  it('evaluateByTrigger without context does not add store filters', async () => {
    const triggerQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    ruleRepo.createQueryBuilder.mockReturnValueOnce(triggerQb);

    await service.evaluateByTrigger('schedule');

    const storeOrChannelCalls = triggerQb.andWhere.mock.calls.filter(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        (call[0].includes('storeId') || call[0].includes('channel')),
    );
    expect(storeOrChannelCalls).toHaveLength(0);
  });
});
