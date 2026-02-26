import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantSetting } from './entities/tenant-setting.entity.js';
import { ShippingProfile } from './entities/shipping-profile.entity.js';
import { PricingRule } from './entities/pricing-rule.entity.js';
import type {
  CreateShippingProfileDto,
  UpdateShippingProfileDto,
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
} from './dto/settings.dto.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  /** In-memory cache of settings for fast reads */
  private cache = new Map<string, unknown>();

  constructor(
    @InjectRepository(TenantSetting)
    private readonly settingRepo: Repository<TenantSetting>,
    @InjectRepository(ShippingProfile)
    private readonly shippingRepo: Repository<ShippingProfile>,
    @InjectRepository(PricingRule)
    private readonly pricingRepo: Repository<PricingRule>,
  ) {}

  /* ═══ Tenant Settings ═══ */

  async getAll(): Promise<Record<string, Record<string, unknown>>> {
    const rows = await this.settingRepo.find({ order: { category: 'ASC', key: 'ASC' } });
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.key] = row.value;
    }
    return grouped;
  }

  async getByCategory(category: string): Promise<Record<string, unknown>> {
    const rows = await this.settingRepo.find({
      where: { category },
      order: { key: 'ASC' },
    });
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async getSetting(category: string, key: string): Promise<unknown> {
    const cacheKey = `${category}:${key}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const row = await this.settingRepo.findOne({ where: { category, key } });
    if (!row) return undefined;
    this.cache.set(cacheKey, row.value);
    return row.value;
  }

  async updateSetting(
    category: string,
    key: string,
    value: unknown,
    updatedBy?: string,
  ): Promise<TenantSetting> {
    let row = await this.settingRepo.findOne({ where: { category, key } });
    if (!row) {
      row = this.settingRepo.create({ category, key, value, updatedBy: updatedBy ?? null });
    } else {
      row.value = value;
      row.updatedBy = updatedBy ?? null;
    }
    const saved = await this.settingRepo.save(row);
    this.cache.set(`${category}:${key}`, value);
    return saved;
  }

  /* ═══ Shipping Profiles ═══ */

  async getShippingProfiles(): Promise<ShippingProfile[]> {
    return this.shippingRepo.find({ order: { isDefault: 'DESC', name: 'ASC' } });
  }

  async createShippingProfile(dto: CreateShippingProfileDto): Promise<ShippingProfile> {
    // If setting as default, unset all others
    if (dto.isDefault) {
      await this.shippingRepo.update({}, { isDefault: false });
    }
    const profile = this.shippingRepo.create(dto);
    return this.shippingRepo.save(profile);
  }

  async updateShippingProfile(
    id: string,
    dto: UpdateShippingProfileDto,
  ): Promise<ShippingProfile> {
    const profile = await this.shippingRepo.findOne({ where: { id } });
    if (!profile) throw new NotFoundException('Shipping profile not found');

    if (dto.isDefault) {
      await this.shippingRepo.update({}, { isDefault: false });
    }

    Object.assign(profile, dto);
    return this.shippingRepo.save(profile);
  }

  async deleteShippingProfile(id: string): Promise<void> {
    const result = await this.shippingRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Shipping profile not found');
  }

  /* ═══ Pricing Rules ═══ */

  async getPricingRules(): Promise<PricingRule[]> {
    return this.pricingRepo.find({ order: { priority: 'ASC', createdAt: 'DESC' } });
  }

  async createPricingRule(dto: CreatePricingRuleDto): Promise<PricingRule> {
    const rule = this.pricingRepo.create({
      name: dto.name,
      ruleType: dto.ruleType,
      channel: dto.channel ?? null,
      categoryId: dto.categoryId ?? null,
      brand: dto.brand ?? null,
      parameters: dto.parameters,
      priority: dto.priority ?? 0,
      active: dto.active ?? true,
    });
    return this.pricingRepo.save(rule);
  }

  async updatePricingRule(id: string, dto: UpdatePricingRuleDto): Promise<PricingRule> {
    const rule = await this.pricingRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule not found');
    Object.assign(rule, dto);
    return this.pricingRepo.save(rule);
  }

  async deletePricingRule(id: string): Promise<void> {
    const result = await this.pricingRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Pricing rule not found');
  }
}
