/* ─── Phase 4: Pricing Push Service Tests ──────────────────
 *  Tests multi-store aware calculateEffectivePrice logic.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { PricingPushService } from './pricing-push.service';
import { PricingRule } from '../settings/entities/pricing-rule.entity';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service';

const mockRule = (overrides: Partial<PricingRule> = {}): PricingRule =>
  ({
    id: 'rule-1',
    name: 'Global Markup',
    ruleType: 'markup',
    channel: null,
    categoryId: null,
    brand: null,
    storeId: null,
    active: true,
    priority: 10,
    parameters: { percentage: 10 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as PricingRule;

describe('PricingPushService', () => {
  let service: PricingPushService;
  let ruleRepo: Record<string, jest.Mock>;
  let queue: { add: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };

  beforeEach(async () => {
    ruleRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    queue = { add: jest.fn().mockResolvedValue({}) };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingPushService,
        { provide: getRepositoryToken(PricingRule), useValue: ruleRepo },
        { provide: getQueueToken('channels'), useValue: queue },
        { provide: FeatureFlagService, useValue: featureFlags },
      ],
    }).compile();

    service = module.get(PricingPushService);
  });

  /* ─── calculateEffectivePrice baseline ─── */

  it('returns base price when no rules exist', async () => {
    ruleRepo.find.mockResolvedValue([]);
    const result = await service.calculateEffectivePrice(100);
    expect(result.effectivePrice).toBe(100);
    expect(result.appliedRules).toHaveLength(0);
  });

  it('applies global markup rule', async () => {
    ruleRepo.find.mockResolvedValue([mockRule()]);
    const result = await service.calculateEffectivePrice(100, 'ebay');
    expect(result.effectivePrice).toBe(110); // 100 * 1.10
    expect(result.appliedRules).toHaveLength(1);
  });

  /* ─── Multi-Store: storeId filtering in calculateEffectivePrice ─── */

  it('applies store-specific rule when storeId matches', async () => {
    ruleRepo.find.mockResolvedValue([
      mockRule({
        id: 'rule-store',
        name: 'Store Markup',
        storeId: 'store-1' as any,
        parameters: { percentage: 20 },
      }),
    ]);
    const result = await service.calculateEffectivePrice(100, 'ebay', undefined, undefined, 'store-1');
    expect(result.effectivePrice).toBe(120); // 100 * 1.20
    expect(result.appliedRules[0]).toContain('Store Markup');
  });

  it('skips store-specific rule when storeId does not match', async () => {
    ruleRepo.find.mockResolvedValue([
      mockRule({
        id: 'rule-store',
        name: 'Store Markup',
        storeId: 'store-1' as any,
        parameters: { percentage: 20 },
      }),
    ]);
    const result = await service.calculateEffectivePrice(100, 'ebay', undefined, undefined, 'store-99');
    expect(result.effectivePrice).toBe(100); // rule skipped
    expect(result.appliedRules).toHaveLength(0);
  });

  it('applies global rule (no storeId) regardless of storeId param', async () => {
    ruleRepo.find.mockResolvedValue([
      mockRule(), // global: no storeId, 10% markup
    ]);
    const result = await service.calculateEffectivePrice(100, 'ebay', undefined, undefined, 'store-5');
    expect(result.effectivePrice).toBe(110);
    expect(result.appliedRules).toHaveLength(1);
  });

  it('stacks global and store-specific rules in priority order', async () => {
    ruleRepo.find.mockResolvedValue([
      mockRule({ id: 'r1', name: 'Global 10%', priority: 10, parameters: { percentage: 10 } }),
      mockRule({
        id: 'r2',
        name: 'Store 5%',
        priority: 5,
        storeId: 'store-1' as any,
        parameters: { percentage: 5 },
      }),
    ]);
    // Both should apply: 100 * 1.10 = 110, then 110 * 1.05 = 115.5
    const result = await service.calculateEffectivePrice(100, undefined, undefined, undefined, 'store-1');
    expect(result.effectivePrice).toBe(115.5);
    expect(result.appliedRules).toHaveLength(2);
  });

  /* ─── handlePricingRuleChange ─── */

  it('handlePricingRuleChange does nothing when flag disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);
    await service.handlePricingRuleChange({ ruleId: 'rule-1', ruleType: 'markup' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('handlePricingRuleChange enqueues job when flag enabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(true);
    await service.handlePricingRuleChange({ ruleId: 'rule-1', ruleType: 'markup', channel: 'ebay' });
    expect(queue.add).toHaveBeenCalledWith(
      'sync-inventory',
      expect.objectContaining({ ruleId: 'rule-1', channel: 'ebay' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });
});
