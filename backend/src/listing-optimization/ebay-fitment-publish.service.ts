import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayCompatibilityReconciliationService } from '../channels/ebay/ebay-compatibility-reconciliation.service.js';
import { EbayPublishService } from '../channels/ebay/ebay-publish.service.js';
import type { EbayCompatibilityPayload } from '../channels/ebay/ebay-api.types.js';

interface PublishedChannelTarget {
  channelId: string;
  storeId: string;
  marketplaceId: string;
  sku: string;
  listingId: string;
  offerId: string | null;
  publishedListingId: string | null;
}

export interface EbayFitmentPublishResult {
  productId: string;
  status: 'published' | 'skipped' | 'failed';
  rows: number;
  channels: number;
  message?: string;
}

/**
 * Publishes only fitment rows that have passed the application/MVL checks.
 *
 * This service is called by the durable listing-optimization worker after a
 * pending product is re-optimized. It deliberately does not publish empty,
 * rejected, or review-only fitment, and it serializes channel writes per
 * product so eBay Trading API writes do not race on the same account/listing.
 */
@Injectable()
export class EbayFitmentPublishService {
  private readonly logger = new Logger(EbayFitmentPublishService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CatalogProduct)
    private readonly catalogRepo: Repository<CatalogProduct>,
    private readonly publishService: EbayPublishService,
    private readonly reconciler: EbayCompatibilityReconciliationService,
  ) {}

  async publishValidatedFitment(
    productId: string,
    marketplace: 'US' | 'DE' | 'AU' = 'US',
  ): Promise<EbayFitmentPublishResult> {
    const catalog = await this.catalogRepo.findOneBy({ id: productId });
    if (!catalog) {
      return {
        productId,
        status: 'failed',
        rows: 0,
        channels: 0,
        message: 'Catalog product not found',
      };
    }

    const expected = (await this.publishService.resolveCatalogCompatibility(
      catalog,
    )) ?? { compatibleProducts: [] };
    if (expected.compatibleProducts.length === 0) {
      this.logger.log(
        `Skipping product ${catalog.sku ?? productId}: no validated fitment rows after optimization`,
      );
      return {
        productId,
        status: 'skipped',
        rows: 0,
        channels: 0,
        message: 'No validated fitment rows',
      };
    }

    const marketplaceId = this.marketplaceIdFor(marketplace);
    const targets = (await this.dataSource.query(
      `
        SELECT
          elc.id AS "channelId",
          ca.primary_store_id AS "storeId",
          elc.marketplace_id AS "marketplaceId",
          COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) AS sku,
          elc.listing_id AS "listingId",
          elc.offer_id AS "offerId",
          epl.id AS "publishedListingId"
        FROM ebay_listing_channels elc
        JOIN connected_ebay_accounts ca ON ca.id = elc.ebay_account_id
        JOIN catalog_products cp ON cp.id = elc.catalog_product_id
        LEFT JOIN ebay_published_listings epl
          ON epl.ebay_account_id = elc.ebay_account_id
         AND epl.marketplace_id = elc.marketplace_id
         AND epl.ebay_item_id = elc.listing_id
        WHERE elc.catalog_product_id = $1
          AND elc.listing_status = 'published'
          AND elc.listing_id IS NOT NULL
          AND elc.marketplace_id = $2
          AND COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) IS NOT NULL
        ORDER BY elc.ebay_account_id, elc.listing_id
      `,
      [productId, marketplaceId],
    )) as PublishedChannelTarget[];

    if (targets.length === 0) {
      return {
        productId,
        status: 'skipped',
        rows: expected.compatibleProducts.length,
        channels: 0,
        message: 'No published eBay channels for product',
      };
    }

    let synced = 0;
    for (const target of targets) {
      await this.syncTarget(target, expected);
      synced += 1;
    }

    this.logger.log(
      `Published ${expected.compatibleProducts.length} validated fitment row(s) for ${catalog.sku ?? productId} across ${synced} channel(s)`,
    );
    return {
      productId,
      status: 'published',
      rows: expected.compatibleProducts.length,
      channels: synced,
    };
  }

  private async syncTarget(
    target: PublishedChannelTarget,
    expected: EbayCompatibilityPayload,
  ): Promise<void> {
    let listingId = target.listingId;
    let sku = target.sku;
    let offerId = target.offerId;

    try {
      await this.reconciler.syncInventory(target.storeId, sku, expected);

      if (offerId) {
        try {
          listingId =
            (await this.reconciler.refreshPublishedOffer(
              target.storeId,
              offerId,
              sku,
              expected,
            )) ?? listingId;
          await this.reconciler.verifyLiveListing(
            target.storeId,
            listingId,
            target.marketplaceId,
            sku,
            expected,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (
            !message.includes('compatibility verification failed') &&
            !message.includes('status code 404')
          ) {
            throw err;
          }

          try {
            listingId = await this.reconciler.recreatePublishedOffer(
              target.storeId,
              offerId,
              sku,
              expected,
            );
            await this.reconciler.verifyLiveListing(
              target.storeId,
              listingId,
              target.marketplaceId,
              sku,
              expected,
            );
          } catch (sameSkuErr: unknown) {
            const sameSkuMessage =
              sameSkuErr instanceof Error
                ? sameSkuErr.message
                : String(sameSkuErr);
            this.logger.warn(
              `Same-SKU fitment recovery failed for ${sku}/${target.listingId}: ${sameSkuMessage}; using fresh SKU`,
            );
            const fresh =
              await this.reconciler.recreatePublishedOfferWithFreshSku(
                target.storeId,
                offerId,
                sku,
                expected,
              );
            listingId = fresh.listingId;
            sku = fresh.sku;
            offerId = fresh.offerId;
            await this.reconciler.verifyLiveListing(
              target.storeId,
              listingId,
              target.marketplaceId,
              sku,
              expected,
            );
          }
        }
      } else {
        await this.reconciler.syncLiveListing(
          target.storeId,
          listingId,
          target.marketplaceId,
          sku,
          expected,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes('not allowed to revise ended listings') ||
        message.includes('original offer is missing and 0 replacement')
      ) {
        await this.dataSource.query(
          `UPDATE ebay_listing_channels
              SET listing_status = 'ended',
                  last_synced_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1`,
          [target.channelId],
        );
        this.logger.warn(
          `Marked ended channel ${target.channelId} for item ${target.listingId} while publishing fitment`,
        );
        return;
      }
      throw err;
    }

    await this.dataSource.query(
      `UPDATE ebay_listing_channels
          SET listing_id = $1,
              listing_url = $2,
              offer_id = $3,
              ebay_inventory_sku = $4,
              last_revised_at = NOW(),
              last_synced_at = NOW(),
              updated_at = NOW()
        WHERE id = $5`,
      [
        listingId,
        `https://www.ebay.com/itm/${listingId}`,
        offerId,
        sku,
        target.channelId,
      ],
    );

    if (target.publishedListingId) {
      await this.dataSource.query(
        `UPDATE ebay_published_listings
            SET ebay_item_id = $1,
                offer_id = $2,
                sku = $3,
                listing_url = $4,
                compatibility = $5::jsonb,
                last_synced_at = NOW(),
                updated_at = NOW()
          WHERE id = $6`,
        [
          listingId,
          offerId,
          sku,
          `https://www.ebay.com/itm/${listingId}`,
          JSON.stringify(expected),
          target.publishedListingId,
        ],
      );
    }
  }

  private marketplaceIdFor(marketplace: 'US' | 'DE' | 'AU'): string {
    if (marketplace === 'DE') return 'EBAY_DE';
    if (marketplace === 'AU') return 'EBAY_AU';
    return 'EBAY_MOTORS_US';
  }
}
