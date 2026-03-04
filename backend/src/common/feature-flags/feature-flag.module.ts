import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './feature-flag.entity.js';
import { FeatureFlagService } from './feature-flag.service.js';
import { FeatureFlagController } from './feature-flag.controller.js';

/**
 * FeatureFlagModule — Simple DB-backed feature flag system.
 * 
 * On startup, ensures all expected flags exist with sensible defaults.
 * Flags are cached in-memory for 60s to avoid DB hits on every check.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag])],
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule implements OnModuleInit {
  constructor(private readonly flagService: FeatureFlagService) {}

  async onModuleInit(): Promise<void> {
    // Seed default flags — idempotent, won't overwrite existing values
    const defaults: Array<[string, string, boolean]> = [
      ['automation_rules', 'Enable automation rules engine', false],
      ['template_system', 'Enable listing templates', false],
      ['amazon_integration', 'Enable Amazon SP-API integration', false],
      ['walmart_integration', 'Enable Walmart API integration', false],
      ['inventory_real_time_sync', 'Enable real-time inventory sync from channels', false],
      ['order_auto_import', 'Enable scheduled order import from channels', true],
      ['pricing_auto_push', 'Enable automatic price pushing to channels', false],
      ['dashboard_aggregation', 'Enable scheduled dashboard aggregation', true],
      ['storage_cleanup', 'Enable scheduled storage cleanup', true],
      ['low_stock_alerts', 'Enable low stock alert notifications', true],
    ];

    try {
      for (const [key, description, enabled] of defaults) {
        await this.flagService.ensureFlag(key, description, enabled);
      }
    } catch {
      // Silently handle — table may not exist yet on first deployment
    }
  }
}
