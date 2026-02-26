import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSetting } from './entities/tenant-setting.entity.js';
import { ShippingProfile } from './entities/shipping-profile.entity.js';
import { PricingRule } from './entities/pricing-rule.entity.js';
import { SettingsService } from './settings.service.js';
import { SettingsController } from './settings.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSetting, ShippingProfile, PricingRule]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
