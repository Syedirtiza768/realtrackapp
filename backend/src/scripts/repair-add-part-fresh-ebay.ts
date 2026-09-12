/**
 * Recover audited Add Part channels whose eBay SKU is not the canonical
 * catalog SKU (normally a prior -FF- recovery SKU).
 *
 * Dry-run is the default. Apply only after the normal-SKU repair has finished:
 *   node dist/src/scripts/repair-add-part-fresh-ebay.js \
 *     --report=/tmp/add-part-ebay-audit-20260823-v4.jsonl
 *   node dist/src/scripts/repair-add-part-fresh-ebay.js --apply \
 *     --report=/tmp/add-part-ebay-audit-20260823-v4.jsonl
 *   node dist/src/scripts/repair-add-part-fresh-ebay.js --apply \
 *     --channel-id=<channel-uuid> --replacement-sku=BLAP-19279 \
 *     --report=/tmp/add-part-ebay-audit-20260823-v4.jsonl
 *
 * Every recovery builds its item/offer from the local Add Part source. The
 * remote item currently attached to the old SKU is never used as canonical
 * content. The reconciliation service verifies the new live projection before
 * the local channel and published-listing pointers are changed.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayCompatibilityReconciliationService } from '../channels/ebay/ebay-compatibility-reconciliation.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { EbayPublishService } from '../channels/ebay/ebay-publish.service.js';
import { conflictSafeSkuFor } from '../channels/ebay/ebay-sku.util.js';

interface AuditEvent {
  event?: string;
  channelId?: string;
  internalSku?: string | null;
  ebaySku?: string | null;
  anomalies?: unknown[];
}

interface RecoveryTarget {
  channelId: string;
  storeId: string;
  marketplaceId: string;
  accountId: string;
  canonicalSku: string;
  ebaySku: string;
  listingId: string;
  offerId: string | null;
  catalogProductId: string;
  sourceListingId: string;
  publishedListingId: string | null;
}

function option(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return (
    process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
    fallback
  );
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function message(error: unknown): string {
  const base = error instanceof Error ? error.message : String(error);
  if (!error || typeof error !== 'object' || !('response' in error)) return base;
  const response = (error as {
    response?: { status?: number; data?: unknown };
  }).response;
  if (!response) return base;
  const detail = response.data === undefined
    ? ''
    : ` ${typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}`;
  return `${base} (HTTP ${response.status ?? 'unknown'})${detail}`;
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function auditedFreshIds(path: string): string[] {
  const ids = new Set<string>();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trimStart().startsWith('{')) continue;
    try {
      const event = JSON.parse(line) as AuditEvent;
      if (
        event.event === 'audit_result' &&
        event.channelId &&
        (event.anomalies?.length ?? 0) > 0 &&
        event.internalSku &&
        event.ebaySku &&
        event.internalSku !== event.ebaySku
      ) {
        ids.add(event.channelId);
      }
    } catch {
      // Nest startup warnings are not JSON audit events.
    }
  }
  return [...ids];
}

async function updateLocalPointers(
  dataSource: DataSource,
  target: RecoveryTarget,
  recovered: { sku: string; offerId: string; listingId: string },
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query(
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
        recovered.listingId,
        `https://www.ebay.com/itm/${recovered.listingId}`,
        recovered.offerId,
        recovered.sku,
        target.channelId,
      ],
    );

    if (target.publishedListingId) {
      await manager.query(
        `UPDATE ebay_published_listings
            SET ebay_item_id = $1,
                offer_id = $2,
                sku = $3,
                listing_url = $4,
                last_synced_at = NOW(),
                updated_at = NOW()
          WHERE id = $5`,
        [
          recovered.listingId,
          recovered.offerId,
          recovered.sku,
          `https://www.ebay.com/itm/${recovered.listingId}`,
          target.publishedListingId,
        ],
      );
    }
  });
}

async function main(): Promise<void> {
  const apply = hasFlag('apply');
  const limit = Math.max(0, Number(option('limit', '0')) || 0);
  const offset = Math.max(0, Number(option('offset', '0')) || 0);
  const channelFilter = option('channel-id', '').trim();
  const replacementSku = option('replacement-sku', '').trim();
  const cleanupOrphan = hasFlag('cleanup-orphan');
  const cleanupOnly = hasFlag('cleanup-only');
  const diagnose = hasFlag('diagnose');
  const reportPath = option(
    'report',
    '/tmp/add-part-ebay-audit-20260823-v4.jsonl',
  );
  const auditedIds = auditedFreshIds(reportPath);
  if (auditedIds.length === 0) {
    throw new Error(`No audited noncanonical Add Part rows found in ${reportPath}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const dataSource = app.get(DataSource);
    const catalogRepo = app.get<Repository<CatalogProduct>>(
      getRepositoryToken(CatalogProduct),
    );
    const publishService = app.get(EbayPublishService);
    const inventoryApi = app.get(EbayInventoryApiService);
    const reconciler = app.get(EbayCompatibilityReconciliationService);

    const rows = (await dataSource.query(
      `
        SELECT
          elc.id AS "channelId",
          ca.primary_store_id AS "storeId",
          elc.marketplace_id AS "marketplaceId",
          elc.ebay_account_id AS "accountId",
          cp.sku AS "canonicalSku",
          elc.ebay_inventory_sku AS "ebaySku",
          elc.listing_id AS "listingId",
          elc.offer_id AS "offerId",
          cp.id AS "catalogProductId",
          source_listing.id AS "sourceListingId",
          epl.id AS "publishedListingId"
        FROM ebay_listing_channels elc
        JOIN catalog_products cp ON cp.id = elc.catalog_product_id
        JOIN connected_ebay_accounts ca ON ca.id = elc.ebay_account_id
        JOIN LATERAL (
          SELECT lr.id
          FROM listing_records lr
          WHERE lr.origin = 'add_part'
            AND lr."customLabelSku" = cp.sku
            AND lr."deletedAt" IS NULL
          ORDER BY lr."updatedAt" DESC NULLS LAST, lr."importedAt" DESC NULLS LAST
          LIMIT 1
        ) source_listing ON TRUE
        LEFT JOIN ebay_published_listings epl
          ON epl.ebay_account_id = elc.ebay_account_id
         AND epl.marketplace_id = elc.marketplace_id
         AND epl.ebay_item_id = elc.listing_id
        WHERE elc.id = ANY($1::uuid[])
          AND elc.listing_status = 'published'
          AND elc.listing_id IS NOT NULL
          AND elc.ebay_inventory_sku IS NOT NULL
          AND cp.sku IS NOT NULL
          AND elc.ebay_inventory_sku <> cp.sku
          AND COALESCE((
            SELECT lr."cBrand"
            FROM listing_records lr
            WHERE lr.id = source_listing.id
          ), cp.brand, '') !~* '(febi|lemf)'
        ORDER BY ca.id, elc.listing_id
      `,
      [auditedIds],
    )) as RecoveryTarget[];

    const scopedRows = channelFilter
      ? rows.filter((row) => row.channelId === channelFilter)
      : rows;
    if (channelFilter && scopedRows.length === 0) {
      throw new Error(`Fresh recovery channel ${channelFilter} was not found in the audited target set`);
    }
    const pendingRows = scopedRows.filter((row) => {
      const deterministicSku = replacementSku || conflictSafeSkuFor(row.canonicalSku);
      return !deterministicSku || row.ebaySku !== deterministicSku;
    });
    const selected = limit > 0
      ? pendingRows.slice(offset, offset + limit)
      : pendingRows.slice(offset);
    if (replacementSku && selected.length !== 1) {
      throw new Error(
        '--replacement-sku requires --channel-id and exactly one selected target; ' +
          'a replacement SKU must never be reused across different catalog products.',
      );
    }
    console.log(
      JSON.stringify({
        event: 'fresh_recovery_started',
        apply,
        auditedNoncanonicalCount: auditedIds.length,
        targetCount: selected.length,
        channelFilter: channelFilter || null,
        replacementSku: replacementSku || null,
        offset,
        readOnly: !apply,
        startedAt: new Date().toISOString(),
      }),
    );

    let recovered = 0;
    let failed = 0;
    for (const target of selected) {
      if (!apply && !diagnose) {
        console.log(
          JSON.stringify({
            event: 'fresh_recovery_would_apply',
            channelId: target.channelId,
            canonicalSku: target.canonicalSku,
            ebaySku: target.ebaySku,
            offerId: target.offerId,
            sourceListingId: target.sourceListingId,
            replacementSku: replacementSku || null,
          }),
        );
        continue;
      }

      try {
        if (!target.offerId) {
          throw new Error(
            `Cannot recover ${target.ebaySku}: the audited source offer ID is missing; ` +
              'hold for explicit remote-offer reconciliation.',
          );
        }
        const requestedSku =
          replacementSku || conflictSafeSkuFor(target.canonicalSku) || undefined;
        if (diagnose && requestedSku) {
          let item: Awaited<ReturnType<EbayInventoryApiService['getItem']>> | null = null;
          try {
            item = await inventoryApi.getItem(target.storeId, requestedSku);
          } catch (error: unknown) {
            if (!(error instanceof Error) || !/404/.test(error.message)) throw error;
          }
          const offers = await inventoryApi.getOffersBySku(
            target.storeId,
            requestedSku,
            100,
            0,
          );
          console.log(
            JSON.stringify({
              event: 'replacement_diagnostic',
              channelId: target.channelId,
              canonicalSku: target.canonicalSku,
              previousEbaySku: target.ebaySku,
              replacementSku: requestedSku,
              itemExists: Boolean(item),
              itemTitle: item?.product?.title ?? null,
              itemBrand: item?.product?.brand ?? null,
              itemMpn: item?.product?.mpn ?? null,
              itemImageCount: item?.product?.imageUrls?.length ?? null,
              offerCount: offers.total,
              offers: offers.offers.map((offer) => ({
                offerId: offer.offerId ?? null,
                status: offer.status ?? null,
                listingId: offer.listingId ?? null,
              })),
            }),
          );
          continue;
        }
        const catalog = await catalogRepo.findOneBy({
          id: target.catalogProductId,
        });
        if (!catalog) throw new Error(`Catalog product ${target.catalogProductId} not found`);

        const expected =
          (await publishService.resolveCatalogCompatibility(catalog)) ?? {
            compatibleProducts: [],
          };
        const canonical = await publishService.buildCanonicalRecoveryProjection(
          target.sourceListingId,
          target.storeId,
        );
        if (cleanupOrphan && requestedSku) {
          let orphanItem: Awaited<ReturnType<EbayInventoryApiService['getItem']>> | null = null;
          try {
            orphanItem = await inventoryApi.getItem(target.storeId, requestedSku);
          } catch (error: unknown) {
            if (!(error instanceof Error) || !/404/.test(error.message)) throw error;
          }
          const orphanOffers = await inventoryApi.getOffersBySku(
            target.storeId,
            requestedSku,
            100,
            0,
          );
          const expectedProduct = canonical.item.product;
          const actualProduct = orphanItem?.product;
          const titleMatches = normalized(actualProduct?.title) === normalized(expectedProduct.title);
          const imageCountMatches =
            (actualProduct?.imageUrls?.length ?? 0) === (expectedProduct.imageUrls?.length ?? 0);
          const brandMatches =
            !actualProduct?.brand ||
            !expectedProduct.brand ||
            normalized(actualProduct.brand) === normalized(expectedProduct.brand);
          const mpnMatches =
            !actualProduct?.mpn ||
            !expectedProduct.mpn ||
            normalized(actualProduct.mpn) === normalized(expectedProduct.mpn);
          const safeOrphan =
            Boolean(orphanItem) &&
            orphanOffers.total === 0 &&
            titleMatches &&
            imageCountMatches &&
            brandMatches &&
            mpnMatches;
          console.log(
            JSON.stringify({
              event: 'orphan_cleanup_check',
              channelId: target.channelId,
              canonicalSku: target.canonicalSku,
              replacementSku: requestedSku,
              itemExists: Boolean(orphanItem),
              offerCount: orphanOffers.total,
              titleMatches,
              imageCountMatches,
              brandMatches,
              mpnMatches,
              safeOrphan,
              readOnly: !apply,
            }),
          );
          if (!safeOrphan) {
            throw new Error(
              `Orphan cleanup refused for ${requestedSku}: the remote item was not proven to be an unpublished canonical partial recovery.`,
            );
          }
          if (apply) {
            await inventoryApi.deleteItem(target.storeId, requestedSku);
            console.log(
              JSON.stringify({
                event: 'orphan_cleanup_result',
                channelId: target.channelId,
                canonicalSku: target.canonicalSku,
                replacementSku: requestedSku,
                deleted: true,
              }),
            );
            if (cleanupOnly) continue;
          } else {
            continue;
          }
        }
        const result = await reconciler.recreatePublishedOfferWithFreshSku(
          target.storeId,
          target.offerId,
          target.canonicalSku,
          expected,
          { item: canonical.item, offer: canonical.offer },
          replacementSku || undefined,
        );

        // External eBay state is verified by the reconciliation service before
        // this pointer swap. Retry the local transaction once if the database
        // briefly rejects a write; never create another eBay offer for a local
        // persistence transient.
        let persisted = false;
        let lastPersistenceError: unknown;
        for (let attempt = 1; attempt <= 2 && !persisted; attempt++) {
          try {
            await updateLocalPointers(dataSource, target, result);
            persisted = true;
          } catch (persistErr: unknown) {
            lastPersistenceError = persistErr;
            if (attempt === 2) throw persistErr;
          }
        }
        if (!persisted && lastPersistenceError) throw lastPersistenceError;

        recovered += 1;
        console.log(
          JSON.stringify({
            event: 'fresh_recovery_result',
            channelId: target.channelId,
            canonicalSku: target.canonicalSku,
            previousEbaySku: target.ebaySku,
            replacementSku: replacementSku || null,
            result,
          }),
        );
      } catch (error: unknown) {
        failed += 1;
        console.log(
          JSON.stringify({
            event: 'fresh_recovery_error',
            channelId: target.channelId,
            canonicalSku: target.canonicalSku,
            previousEbaySku: target.ebaySku,
            replacementSku: replacementSku || null,
            error: message(error),
          }),
        );
      }
    }

    console.log(
      JSON.stringify({
        event: 'fresh_recovery_completed',
        apply,
        targetCount: selected.length,
        recovered,
        failed,
        offset,
        completedAt: new Date().toISOString(),
      }),
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({ event: 'fresh_recovery_failed', error: message(error) }),
    );
    process.exit(1);
  });
