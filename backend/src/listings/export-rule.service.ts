import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportRule } from './entities/export-rule.entity.js';
import { MasterProduct } from './entities/master-product.entity.js';
import { EbayOffer } from './entities/ebay-offer.entity.js';
import type { CreateExportRuleDto, UpdateExportRuleDto } from './dto/export-rule.dto.js';

/**
 * ExportRuleService — Manages automated listing export rules.
 *
 * Rules define criteria for automatically publishing master products
 * to specific eBay stores with per-rule price/title overrides.
 */
@Injectable()
export class ExportRuleService {
  private readonly logger = new Logger(ExportRuleService.name);

  constructor(
    @InjectRepository(ExportRule)
    private readonly ruleRepo: Repository<ExportRule>,
    @InjectRepository(MasterProduct)
    private readonly productRepo: Repository<MasterProduct>,
    @InjectRepository(EbayOffer)
    private readonly offerRepo: Repository<EbayOffer>,
  ) {}

  // ──────────────────────────── CRUD ──────────────────────────────

  async create(dto: CreateExportRuleDto): Promise<ExportRule> {
    const rule = this.ruleRepo.create(dto);
    const saved = await this.ruleRepo.save(rule);
    this.logger.log(`Created export rule "${saved.name}" → store ${saved.storeId}`);
    return saved;
  }

  async findAll(organizationId?: string): Promise<ExportRule[]> {
    const where = organizationId ? { organizationId } : {};
    return this.ruleRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['store'],
    });
  }

  async findOne(id: string): Promise<ExportRule> {
    const rule = await this.ruleRepo.findOne({
      where: { id },
      relations: ['store'],
    });
    if (!rule) throw new NotFoundException(`Export rule ${id} not found`);
    return rule;
  }

  async update(id: string, dto: UpdateExportRuleDto): Promise<ExportRule> {
    const rule = await this.findOne(id);
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findOne(id);
    await this.ruleRepo.remove(rule);
    this.logger.log(`Deleted export rule "${rule.name}"`);
  }

  // ──────────────────────────── Rule Evaluation ──────────────────

  /**
   * Find all master products that match a rule's filters.
   */
  async findMatchingProducts(ruleId: string): Promise<MasterProduct[]> {
    const rule = await this.findOne(ruleId);
    const filters = rule.filters as Record<string, unknown>;

    const qb = this.productRepo.createQueryBuilder('p');
    qb.where('p.status IN (:...statuses)', { statuses: ['ready', 'published'] });

    // Apply filter criteria
    if (filters.brand && Array.isArray(filters.brand)) {
      qb.andWhere('p.brand IN (:...brands)', { brands: filters.brand });
    }
    if (filters.partType && Array.isArray(filters.partType)) {
      qb.andWhere('p.part_type IN (:...partTypes)', { partTypes: filters.partType });
    }
    if (filters.condition && Array.isArray(filters.condition)) {
      qb.andWhere('p.condition IN (:...conditions)', { conditions: filters.condition });
    }
    if (typeof filters.minPrice === 'number') {
      qb.andWhere('p.retail_price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (typeof filters.maxPrice === 'number') {
      qb.andWhere('p.retail_price <= :maxPrice', { maxPrice: filters.maxPrice });
    }
    if (typeof filters.minQuantity === 'number') {
      qb.andWhere('p.total_quantity >= :minQty', { minQty: filters.minQuantity });
    }

    // Exclude products already exported to this store
    qb.andWhere(
      `p.id NOT IN (
        SELECT eo.master_product_id FROM ebay_offers eo
        WHERE eo.store_id = :storeId
        AND eo.status != 'error'
      )`,
      { storeId: rule.storeId },
    );

    return qb.getMany();
  }

  /**
   * Apply a rule's overrides to compute the final price for a product.
   */
  computeRulePrice(rule: ExportRule, basePrice: number): number {
    let price = basePrice * (rule.priceMultiplier ?? 1);
    price += rule.priceAddition ?? 0;
    return Math.round(price * 100) / 100;
  }

  /**
   * Apply a rule's title overrides.
   */
  computeRuleTitle(rule: ExportRule, baseTitle: string): string {
    let title = baseTitle;
    if (rule.titlePrefix) title = `${rule.titlePrefix}${title}`;
    if (rule.titleSuffix) title = `${title}${rule.titleSuffix}`;
    // eBay max title = 80 chars
    return title.substring(0, 80);
  }

  /**
   * Execute a rule: find matching products and create draft eBay offers.
   * Returns the count of new offers created.
   */
  async executeRule(ruleId: string): Promise<number> {
    const rule = await this.findOne(ruleId);
    const products = await this.findMatchingProducts(ruleId);

    if (products.length === 0) {
      this.logger.log(`Rule "${rule.name}": no matching products found`);
      return 0;
    }

    let created = 0;
    for (const product of products) {
      const price = this.computeRulePrice(
        rule,
        Number(product.retailPrice) || 0,
      );
      const title = this.computeRuleTitle(rule, product.title);

      const offer = this.offerRepo.create({
        masterProductId: product.id,
        storeId: rule.storeId,
        sku: product.sku,
        titleOverride: title !== product.title ? title : null,
        price,
        quantity: product.totalQuantity,
        categoryId: product.ebayCategoryId,
        format: 'FIXED_PRICE',
        fulfillmentPolicyId: rule.fulfillmentPolicyId,
        paymentPolicyId: rule.paymentPolicyId,
        returnPolicyId: rule.returnPolicyId,
        status: 'draft',
      });

      await this.offerRepo.save(offer);
      created++;
    }

    // Update rule stats
    rule.lastRunAt = new Date();
    rule.lastRunCount = created;
    rule.totalExported += created;
    await this.ruleRepo.save(rule);

    this.logger.log(
      `Rule "${rule.name}" executed: ${created} offers created from ${products.length} matching products`,
    );
    return created;
  }
}
