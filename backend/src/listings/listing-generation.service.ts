import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MasterProduct } from './entities/master-product.entity.js';
import { EbayOffer } from './entities/ebay-offer.entity.js';
import { ExportRuleService } from './export-rule.service.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { TemplateService } from '../templates/template.service.js';
import { EbayPublishService } from '../channels/ebay/ebay-publish.service.js';
import type { PublishRequest, PublishResult } from '../channels/ebay/ebay-publish.service.js';
import type { ListingGenerationResult } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type { Store } from '../channels/entities/store.entity.js';

/* ── Types ── */

export interface GenerateListingInput {
  /** Master product ID */
  masterProductId: string;
  /** Optional template ID for context-aware generation */
  templateId?: string;
  /** Target store ID (used for export rule overrides) */
  storeId?: string;
  /** Override eBay category name for the prompt */
  categoryName?: string;
}

export interface GenerateAndPublishInput extends GenerateListingInput {
  /** Store IDs to publish to. If empty, uses export rules. */
  storeIds: string[];
  /** Whether to actually publish or just generate draft offers */
  publishImmediately?: boolean;
}

export interface GeneratedListingWithMeta {
  generation: ListingGenerationResult;
  product: MasterProduct;
  appliedOverrides: {
    price: number;
    title: string;
    storeId?: string;
  } | null;
}

/**
 * ListingGenerationService — Orchestrates AI listing generation.
 *
 * Bridges:
 *  - MasterProduct data (SKU, brand, OEM, fitment)
 *  - Template system (optional Handlebars context)
 *  - OpenAI ListingGenerationPipeline
 *  - Export rules (per-store price/title overrides)
 *  - EbayPublishService (create draft offers or publish live)
 *
 * Phase 3 key service: "User selects master SKU → AI generates optimized eBay listing."
 */
@Injectable()
export class ListingGenerationService {
  private readonly logger = new Logger(ListingGenerationService.name);

  constructor(
    @InjectRepository(MasterProduct)
    private readonly productRepo: Repository<MasterProduct>,
    @InjectRepository(EbayOffer)
    private readonly offerRepo: Repository<EbayOffer>,
    private readonly listingPipeline: ListingGenerationPipeline,
    private readonly templateService: TemplateService,
    private readonly exportRuleService: ExportRuleService,
    private readonly publishService: EbayPublishService,
  ) {}

  /* ─── Generate Listing Content (AI) ─── */

  /**
   * Generate optimized listing content for a master product.
   * Optionally uses a template for context-aware generation.
   */
  async generate(input: GenerateListingInput): Promise<GeneratedListingWithMeta> {
    const product = await this.productRepo.findOneBy({ id: input.masterProductId });
    if (!product) {
      throw new NotFoundException(`MasterProduct ${input.masterProductId} not found`);
    }

    // Build product data payload for OpenAI
    const productData: Record<string, unknown> = {
      sku: product.sku,
      brand: product.brand,
      mpn: product.mpn,
      oem_number: product.oemNumber,
      upc: product.upc,
      title: product.title,
      part_type: product.partType,
      condition: product.condition,
      condition_description: product.conditionDescription,
      features: product.features,
      item_specifics: product.itemSpecifics,
      image_count: product.imageUrls.length,
    };

    // If a template is provided, render it as additional context
    if (input.templateId) {
      try {
        const { html } = await this.templateService.renderPreview(input.templateId, {
          variables: productData as Record<string, unknown>,
        });
        productData.template_context = html;
      } catch (err) {
        this.logger.warn(`Template ${input.templateId} render failed, proceeding without: ${err}`);
      }
    }

    const categoryName = input.categoryName
      ?? product.ebayCategoryName
      ?? 'Auto Parts & Accessories';

    const generation = await this.listingPipeline.generate(
      productData,
      categoryName,
      product.condition,
    );

    this.logger.log(
      `Generated listing for ${product.sku}: "${generation.title}"`,
    );

    return {
      generation,
      product,
      appliedOverrides: null,
    };
  }

  /* ─── Generate + Create Draft Offers ─── */

  /**
   * Generate listing content and create draft EbayOffer records
   * for the specified stores (or stores matching export rules).
   */
  async generateAndCreateOffers(
    input: GenerateAndPublishInput,
  ): Promise<{ generation: ListingGenerationResult; offers: EbayOffer[]; publishResults?: PublishResult[] }> {
    const { generation, product } = await this.generate(input);
    const offers: EbayOffer[] = [];

    for (const storeId of input.storeIds) {
      // Check if offer already exists for this product + store
      let offer = await this.offerRepo.findOne({
        where: { masterProductId: product.id, storeId },
      });

      // Compute per-store overrides from export rules
      const rulePrice = await this.findBestRulePrice(product, storeId);
      const finalPrice = rulePrice ?? generation.pricePositioning.suggestedPrice ?? Number(product.retailPrice) ?? 0;
      const finalTitle = generation.title.substring(0, 80); // eBay max

      if (offer) {
        // Update existing draft
        offer.titleOverride = finalTitle !== product.title ? finalTitle : null;
        offer.price = finalPrice;
        offer.quantity = product.totalQuantity;
        offer.status = 'draft';
        offer.lastError = null;
        offer = await this.offerRepo.save(offer);
      } else {
        // Create new draft offer
        offer = this.offerRepo.create({
          masterProductId: product.id,
          storeId,
          sku: product.sku,
          titleOverride: finalTitle !== product.title ? finalTitle : null,
          price: finalPrice,
          quantity: product.totalQuantity,
          categoryId: product.ebayCategoryId,
          format: 'FIXED_PRICE',
          status: 'draft',
        });
        offer = await this.offerRepo.save(offer);
      }

      offers.push(offer);
    }

    this.logger.log(
      `Created ${offers.length} draft offer(s) for ${product.sku}`,
    );

    // Optionally publish immediately
    let publishResults: PublishResult[] | undefined;
    if (input.publishImmediately && offers.length > 0) {
      publishResults = await this.publishOffers(product, offers, generation);
    }

    return { generation, offers, publishResults };
  }

  /* ─── Publish Draft Offers to eBay ─── */

  /**
   * Publish existing draft offers to eBay via the EbayPublishService.
   */
  private async publishOffers(
    product: MasterProduct,
    offers: EbayOffer[],
    generation: ListingGenerationResult,
  ): Promise<PublishResult[]> {
    const publishReq: PublishRequest = {
      listingId: product.id,
      storeIds: offers.map((o) => o.storeId),
      sku: product.sku,
      title: generation.title.substring(0, 80),
      description: generation.description,
      categoryId: product.ebayCategoryId ?? '',
      condition: product.condition as any,
      conditionDescription: product.conditionDescription ?? undefined,
      price: Number(offers[0].price) || 0,
      quantity: product.totalQuantity,
      imageUrls: product.imageUrls,
      aspects: product.itemSpecifics,
    };

    const results = await this.publishService.publish(publishReq);

    // Update offer statuses based on results
    for (const result of results) {
      const offer = offers.find((o) => o.storeId === result.storeId);
      if (!offer) continue;

      if (result.success) {
        offer.ebayOfferId = result.offerId ?? null;
        offer.ebayListingId = result.listingId ?? null;
        offer.status = 'published';
        offer.publishedAt = new Date();
        offer.lastSyncedAt = new Date();
        offer.lastError = null;
      } else {
        offer.status = 'error';
        offer.lastError = result.error ?? 'Unknown publish error';
      }
      await this.offerRepo.save(offer);
    }

    return results;
  }

  /* ─── Batch Generation ─── */

  /**
   * Generate listings for multiple master products in sequence.
   */
  async generateBatch(
    inputs: GenerateListingInput[],
  ): Promise<GeneratedListingWithMeta[]> {
    const results: GeneratedListingWithMeta[] = [];
    for (let i = 0; i < inputs.length; i++) {
      this.logger.debug(`Batch generate ${i + 1}/${inputs.length}`);
      try {
        const result = await this.generate(inputs[i]);
        results.push(result);
      } catch (err) {
        this.logger.error(`Batch item ${i + 1} failed: ${err}`);
      }
    }
    return results;
  }

  /* ─── Helpers ─── */

  /**
   * Find the best-matching export rule price for a product + store combo.
   */
  private async findBestRulePrice(
    product: MasterProduct,
    storeId: string,
  ): Promise<number | null> {
    try {
      const rules = await this.exportRuleService.findAll();
      const storeRule = rules.find(
        (r) => r.storeId === storeId && r.status === 'active',
      );
      if (!storeRule) return null;

      const basePrice = Number(product.retailPrice) || 0;
      return this.exportRuleService.computeRulePrice(storeRule, basePrice);
    } catch {
      return null;
    }
  }
}
