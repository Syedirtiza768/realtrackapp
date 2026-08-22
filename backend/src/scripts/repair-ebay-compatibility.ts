/**
 * Reconcile current eBay Motors listings with the catalog fitment source.
 *
 * Dry run:
 *   node dist/src/scripts/repair-ebay-compatibility.js
 * Apply:
 *   node dist/src/scripts/repair-ebay-compatibility.js --apply
 * Scan every current channel (explicit confirmation required):
 *   node dist/src/scripts/repair-ebay-compatibility.js --apply --all-current --confirm-all-current
 * Reconcile every store channel for a known affected SKU:
 *   node dist/src/scripts/repair-ebay-compatibility.js --apply --sku-list=BLA-19296,BLA-19276
 *
 * The script is deliberately serial. Trading API ReviseItem is a seller write
 * and must not be fanned out in parallel against the same eBay account.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { DataSource } from 'typeorm';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayPublishedListing } from '../published-listings/entities/ebay-published-listing.entity.js';
import { EbayCompatibilityReconciliationService } from '../channels/ebay/ebay-compatibility-reconciliation.service.js';
import { EbayPublishService } from '../channels/ebay/ebay-publish.service.js';
import {
  fitmentDataToCompatibilityPayload,
  selectPublishFitmentSource,
} from '../fitment/fitment-mvl.util.js';
import type { EbayCompatibilityPayload } from '../channels/ebay/ebay-api.types.js';

interface RepairTarget {
  channelId: string;
  storeId: string;
  accountId: string;
  marketplaceId: string;
  sku: string;
  listingId: string;
  offerId: string | null;
  publishedListingId: string | null;
  catalogProductId: string;
  title: string;
  fitmentStatus: string | null;
  fitmentData: Record<string, unknown>[] | null;
  fitmentRows: Record<string, unknown>[] | null;
  localCompatibilityRows: number;
}

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function expectedCompatibilityFromStoredRows(
  target: RepairTarget,
): EbayCompatibilityPayload {
  const source = selectPublishFitmentSource(
    target.fitmentData,
    target.fitmentRows,
  );
  return fitmentDataToCompatibilityPayload(source) ?? {
    compatibleProducts: [],
  };
}

async function main(): Promise<void> {
  const apply = hasFlag('apply');
  if (hasFlag('all-current') && !hasFlag('confirm-all-current')) {
    throw new Error(
      '--all-current scans every published channel; add --confirm-all-current to enable it. ' +
        'Use the default candidate query for fitment mismatch repair.',
    );
  }
  const allCurrent = hasFlag('all-current') && hasFlag('confirm-all-current');
  const skuFilter = option('sku');
  const skuList = (option('sku-list') ?? '')
    .split(',')
    .map((sku) => sku.trim())
    .filter(Boolean);
  const explicitSkuScope = Boolean(skuFilter || skuList.length > 0);
  const skuScope = skuList.length > 0 ? skuList.join(',') : skuFilter ?? null;
  const limit = Number(option('limit') ?? '0');
  // Keep the default scope explicit in SQL. A boolean bind parameter here is
  // surprisingly easy to invert during deployment and can turn a repair into
  // an all-listings scan. The broad mode is opt-in and separately confirmed.
  const unavailableFitmentPredicate = `(
            jsonb_array_length(COALESCE(cp.fitment_data, '[]'::jsonb)) = 0
            AND NOT EXISTS (
              SELECT 1
                FROM jsonb_array_elements(COALESCE(cp.fitment_rows, '[]'::jsonb)) AS fitment_row
               WHERE lower(COALESCE(
                 fitment_row->>'MvlStatus',
                 fitment_row->>'mvlStatus',
                 fitment_row->>'validationStatus',
                 fitment_row->>'ValidationStatus',
                 ''
               )) = 'valid'
            )
            AND (
              jsonb_array_length(COALESCE(cp.fitment_rows, '[]'::jsonb)) = 0
              OR EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(COALESCE(cp.fitment_rows, '[]'::jsonb)) AS fitment_row
                 WHERE lower(COALESCE(
                   fitment_row->>'MvlStatus',
                   fitment_row->>'mvlStatus',
                   fitment_row->>'validationStatus',
                   fitment_row->>'ValidationStatus',
                   ''
                 )) <> ''
              )
            )
          )`;
  const candidatePredicate = allCurrent
    ? 'TRUE'
    : explicitSkuScope
      ? unavailableFitmentPredicate
      : `(
            jsonb_array_length(COALESCE(epl.compatibility->'compatibleProducts', '[]'::jsonb)) > 0
            AND ${unavailableFitmentPredicate}
          )`;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dataSource = app.get(DataSource);
    const reconciler = app.get(EbayCompatibilityReconciliationService);
    const publishService = app.get(EbayPublishService);
    const catalogRepo = app.get<Repository<CatalogProduct>>(
      getRepositoryToken(CatalogProduct),
    );
    const publishedRepo = app.get<Repository<EbayPublishedListing>>(
      getRepositoryToken(EbayPublishedListing),
    );

    const rows = (await dataSource.query(
      `
        SELECT
          elc.id AS "channelId",
          ca.primary_store_id AS "storeId",
          elc.ebay_account_id AS "accountId",
          elc.marketplace_id AS "marketplaceId",
          COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) AS "sku",
          elc.listing_id AS "listingId",
          elc.offer_id AS "offerId",
          epl.id AS "publishedListingId",
          cp.id AS "catalogProductId",
          cp.title,
          cp.fitment_status AS "fitmentStatus",
          cp.fitment_data AS "fitmentData",
          cp.fitment_rows AS "fitmentRows",
          jsonb_array_length(COALESCE(epl.compatibility->'compatibleProducts', '[]'::jsonb)) AS "localCompatibilityRows"
        FROM ebay_listing_channels elc
        JOIN catalog_products cp ON cp.id = elc.catalog_product_id
        JOIN connected_ebay_accounts ca ON ca.id = elc.ebay_account_id
        LEFT JOIN ebay_published_listings epl
          ON epl.ebay_account_id = elc.ebay_account_id
         AND epl.marketplace_id = elc.marketplace_id
         AND epl.ebay_item_id = elc.listing_id
        WHERE elc.listing_status = 'published'
          AND elc.marketplace_id = 'EBAY_MOTORS_US'
          AND elc.listing_id IS NOT NULL
          AND COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) IS NOT NULL
          AND (
            $1::text IS NULL
            OR COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) = ANY(string_to_array($1, ','))
          )
          AND ${candidatePredicate}
        ORDER BY elc.ebay_account_id, elc.listing_id
      `,
      [skuScope],
    )) as RepairTarget[];

    const targets = limit > 0 ? rows.slice(0, limit) : rows;
    console.log(
      `${apply ? 'APPLY' : 'DRY RUN'}: ${targets.length} target channel(s) ` +
        `(candidate query returned ${rows.length})`,
    );

    let repaired = 0;
    let unchanged = 0;
    let failed = 0;
    for (const target of targets) {
      const storedExpected = expectedCompatibilityFromStoredRows(target);
      const label = `${target.sku} / item ${target.listingId}`;
      console.log(
        `${apply ? 'Repairing' : 'Would repair'} ${label}: ` +
          `${target.localCompatibilityRows} local row(s) -> ${storedExpected.compatibleProducts.length} stored-source row(s) ` +
          `[${target.fitmentStatus ?? 'no status'}]`,
      );

      if (!apply) continue;

      try {
        const catalog = await catalogRepo.findOne({
          where: { id: target.catalogProductId },
        });
        const expected = catalog
          ? ((await publishService.resolveCatalogCompatibility(catalog)) ?? {
              compatibleProducts: [],
            })
          : expectedCompatibilityFromStoredRows(target);

        await reconciler.syncInventory(target.storeId, target.sku, expected);
        let verifiedListingId = target.listingId;
        let verifiedSku = target.sku;
        let verifiedOfferId = target.offerId;
        if (target.offerId) {
          const recoverWithFreshSku = async (): Promise<void> => {
            const fresh =
              await reconciler.recreatePublishedOfferWithFreshSku(
                target.storeId,
                verifiedOfferId ?? target.offerId!,
                verifiedSku,
                expected,
              );
            verifiedSku = fresh.sku;
            verifiedOfferId = fresh.offerId;
            verifiedListingId = fresh.listingId;
            await reconciler.verifyLiveListing(
              target.storeId,
              verifiedListingId,
              target.marketplaceId,
              verifiedSku,
              expected,
            );
          };

          try {
            verifiedListingId =
              (await reconciler.refreshPublishedOffer(
                target.storeId,
                target.offerId,
                target.sku,
                expected,
              )) ?? verifiedListingId;
          } catch (refreshErr: unknown) {
            const message =
              refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
            if (!message.includes('status code 404')) throw refreshErr;
            // Some older channels retain a legacy Trading listing after the
            // Inventory offer row has disappeared. Repair that projection
            // directly before resorting to a new Inventory SKU.
            try {
              await reconciler.syncLiveListing(
                target.storeId,
                target.listingId,
                target.marketplaceId,
                target.sku,
                expected,
              );
              verifiedListingId = target.listingId;
            } catch (legacyErr: unknown) {
              const legacyMessage =
                legacyErr instanceof Error ? legacyErr.message : String(legacyErr);
              console.log(
                `${label}: offer ${target.offerId} is gone; legacy fallback returned ${legacyMessage}; using a fresh Inventory SKU`,
              );
              await recoverWithFreshSku();
            }
          }

          try {
            await reconciler.verifyLiveListing(
              target.storeId,
              verifiedListingId,
              target.marketplaceId,
              verifiedSku,
              expected,
            );
          } catch (verificationErr: unknown) {
            const message =
              verificationErr instanceof Error
                ? verificationErr.message
                : String(verificationErr);
            if (!message.includes('compatibility verification failed')) {
              throw verificationErr;
            }
            console.log(
              `${label}: published eBay projection retained stale rows; trying same-SKU recreation`,
            );
            try {
              verifiedListingId = await reconciler.recreatePublishedOffer(
                target.storeId,
                target.offerId,
                target.sku,
                expected,
              );
              await reconciler.verifyLiveListing(
                target.storeId,
                verifiedListingId,
                target.marketplaceId,
                target.sku,
                expected,
              );
            } catch (sameSkuErr: unknown) {
              const sameSkuMessage =
                sameSkuErr instanceof Error ? sameSkuErr.message : String(sameSkuErr);
              console.log(
                `${label}: same-SKU recreation returned ${sameSkuMessage}; using a fresh Inventory SKU`,
              );
              await recoverWithFreshSku();
            }
          }

          if (
            verifiedListingId !== target.listingId ||
            verifiedOfferId !== target.offerId ||
            verifiedSku !== target.sku
          ) {
            await dataSource.query(
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
                verifiedListingId,
                `https://www.ebay.com/itm/${verifiedListingId}`,
                verifiedOfferId,
                verifiedSku,
                target.channelId,
              ],
            );
          }
        } else {
          await reconciler.syncLiveListing(
            target.storeId,
            target.listingId,
            target.marketplaceId,
            target.sku,
            expected,
          );
        }
        if (target.publishedListingId) {
          await publishedRepo.update(
            target.publishedListingId,
            {
              ebayItemId: verifiedListingId,
              offerId: verifiedOfferId,
              sku: verifiedSku,
              listingUrl: `https://www.ebay.com/itm/${verifiedListingId}`,
              compatibility: expected,
              lastSyncedAt: new Date(),
            } as any,
          );
        }
        if (target.localCompatibilityRows === expected.compatibleProducts.length) {
          unchanged += 1;
        } else {
          repaired += 1;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // A channel can remain marked published in our database after eBay
        // has ended the listing and removed its Inventory offer. It is not a
        // live buyer-facing fitment case anymore; close the stale local
        // mapping instead of inventing a replacement listing without a
        // recoverable offer payload.
        if (
          message.includes('not allowed to revise ended listings') ||
          message.includes('original offer is missing and 0 replacement')
        ) {
          await dataSource.query(
            `UPDATE ebay_listing_channels
                SET listing_status = 'ended',
                    last_synced_at = NOW(),
                    updated_at = NOW()
              WHERE id = $1`,
            [target.channelId],
          );
          if (target.publishedListingId) {
            await publishedRepo.update(
              target.publishedListingId,
              {
                compatibility: { compatibleProducts: [] },
                lastSyncedAt: new Date(),
              } as any,
            );
          }
          unchanged += 1;
          console.warn(`ENDED ${label}: ${message}`);
          continue;
        }
        failed += 1;
        console.error(
          `FAILED ${label}: ${message}`,
        );
      }
    }

    console.log(
      `Summary: repaired=${repaired}, unchanged=${unchanged}, failed=${failed}`,
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
