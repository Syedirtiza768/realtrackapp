import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRule } from '../settings/entities/pricing-rule.entity.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';

/**
 * Listens for pricing-related events and enqueues channel price sync jobs.
 *
 * Gated by the `pricing_auto_push` feature flag — disabled by default.
 * When enabled, any pricing rule change triggers a channel inventory sync
 * that pushes updated prices to all affected channel instances.
 */
@Injectable()
export class PricingPushService {
  private readonly logger = new Logger(PricingPushService.name);

  constructor(
    @InjectQueue('channels')
    private readonly channelsQueue: Queue,
    @InjectRepository(PricingRule)
    private readonly pricingRuleRepo: Repository<PricingRule>,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  /**
   * When a pricing rule is created/updated, evaluate affected listings
   * and push updated prices to their channel instances.
   */
  @OnEvent('pricing_rule.changed')
  async handlePricingRuleChange(payload: {
    ruleId: string;
    ruleType: string;
    channel?: string;
  }): Promise<void> {
    const enabled = await this.featureFlags.isEnabled('pricing_auto_push');
    if (!enabled) {
      this.logger.debug('pricing_auto_push flag is disabled — skipping price push');
      return;
    }

    this.logger.log(`Pricing rule changed (${payload.ruleId}), enqueuing price sync`);

    await this.channelsQueue.add(
      'sync-inventory',
      {
        trigger: 'pricing_rule_change',
        ruleId: payload.ruleId,
        channel: payload.channel ?? null,
      },
      {
        jobId: `price-push-${payload.ruleId}-${Date.now()}`,
        delay: 5000, // 5s debounce to batch rapid rule changes
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    );
  }

  /**
   * Calculate effective price for a listing given all active pricing rules.
   * Rules are applied in priority order (highest first).
   */
  async calculateEffectivePrice(
    basePrice: number,
    channel?: string,
    categoryId?: string,
    brand?: string,
    storeId?: string,
  ): Promise<{ effectivePrice: number; appliedRules: string[] }> {
    const rules = await this.pricingRuleRepo.find({
      where: { active: true },
      order: { priority: 'DESC' },
    });

    let price = basePrice;
    const appliedRules: string[] = [];

    for (const rule of rules) {
      // Check if rule applies to this context
      if (rule.channel && rule.channel !== channel) continue;
      if ((rule as any).storeId && (rule as any).storeId !== storeId) continue;
      if (rule.categoryId && rule.categoryId !== categoryId) continue;
      if (rule.brand && rule.brand !== brand) continue;

      const params = rule.parameters as Record<string, number>;

      switch (rule.ruleType) {
        case 'markup': {
          const pct = params.percentage ?? 0;
          price = price * (1 + pct / 100);
          appliedRules.push(`${rule.name}: +${pct}%`);
          break;
        }
        case 'markdown': {
          const pct = params.percentage ?? 0;
          price = price * (1 - pct / 100);
          appliedRules.push(`${rule.name}: -${pct}%`);
          break;
        }
        case 'round': {
          const to = params.roundTo ?? 99;
          price = Math.floor(price) + (to / 100);
          appliedRules.push(`${rule.name}: round to .${to}`);
          break;
        }
        case 'min_margin': {
          const minPct = params.minMarginPercent ?? 10;
          const cost = params.cost ?? 0;
          const minPrice = cost * (1 + minPct / 100);
          if (price < minPrice) {
            price = minPrice;
            appliedRules.push(`${rule.name}: min margin floor $${minPrice.toFixed(2)}`);
          }
          break;
        }
        case 'competitive': {
          // Placeholder for future competitive pricing integration
          this.logger.debug(`Competitive pricing rule ${rule.name} — requires external data (skipped)`);
          break;
        }
      }
    }

    return { effectivePrice: Math.round(price * 100) / 100, appliedRules };
  }
}
