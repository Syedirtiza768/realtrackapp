/**
 * Audit individually-added (Add Part/New) eBay listings against their
 * canonical catalog/listing source and the live eBay Inventory/Trading APIs.
 *
 * This script is intentionally read-only. It does not revise, withdraw,
 * delete, or recreate an eBay listing. Repair is a separate, explicitly
 * reviewed operation after the JSONL report has been inspected.
 *
 * Usage:
 *   node dist/src/scripts/audit-add-part-ebay.js
 *   node dist/src/scripts/audit-add-part-ebay.js --limit=25 --concurrency=2
 *   node dist/src/scripts/audit-add-part-ebay.js --skip-trading
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { EbayCompatibilityReconciliationService } from '../channels/ebay/ebay-compatibility-reconciliation.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../channels/ebay/ebay-trading-api.service.js';
import type {
  EbayCompatibilityPayload,
  EbayInventoryItem,
  EbayLocation,
  EbayOffer,
} from '../channels/ebay/ebay-api.types.js';
import {
  fitmentDataToCompatibilityPayload,
  selectPublishFitmentSource,
} from '../fitment/fitment-mvl.util.js';

interface AuditTarget {
  channelId: string;
  storeId: string;
  accountId: string;
  marketplaceId: string;
  internalSku: string | null;
  ebaySku: string | null;
  listingId: string | null;
  offerId: string | null;
  catalogProductId: string;
  sourceTitle: string;
  sourceDescription: string | null;
  catalogTitle: string;
  sourceImages: string[];
  sourceLocation: string | null;
  sourceShippingProfile: string | null;
  sourceReturnProfile: string | null;
  sourcePaymentProfile: string | null;
  fitmentData: Record<string, unknown>[] | null;
  fitmentRows: Record<string, unknown>[] | null;
}

interface PolicyRow {
  ebayAccountId: string;
  marketplaceId: string;
  policyType: 'payment' | 'return' | 'fulfillment';
  ebayPolicyId: string;
  name: string;
}

interface AuditResult {
  channelId: string;
  accountId: string;
  storeId: string;
  marketplaceId: string;
  internalSku: string | null;
  ebaySku: string | null;
  listingId: string | null;
  offerId: string | null;
  sourceTitle: string;
  liveTitle: string | null;
  sourceDescriptionLength: number;
  inventoryDescriptionLength: number | null;
  tradingDescriptionLength: number | null;
  liveDescriptionLength: number | null;
  descriptionSource: 'trading' | 'inventory' | 'unavailable';
  descriptionMatches: boolean | null;
  sourceImageCount: number;
  inventoryImageCount: number | null;
  tradingImageCount: number | null;
  expectedCompatibilityCount: number;
  inventoryCompatibilityCount: number | null;
  tradingCompatibilityCount: number | null;
  expectedPolicies: {
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
  };
  livePolicies: {
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
  } | null;
  liveOfferStatus: string | null;
  liveOfferListingId: string | null;
  expectedLocation: string | null;
  liveLocationKey: string | null;
  liveLocation: EbayLocation | null;
  anomalies: string[];
  fetchErrors: string[];
}

function option(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function uniqueHttpUrls(values: unknown): string[] {
  const list = Array.isArray(values) ? values : [];
  return [...new Set(
    list
      .map((value) => String(value ?? '').trim())
      .filter((value) => /^https?:\/\//i.test(value)),
  )];
}

function compatibilityKey(payload: EbayCompatibilityPayload | null | undefined): Set<string> {
  return new Set(
    (payload?.compatibleProducts ?? [])
      .map((row) =>
        row.compatibilityProperties
          .map((property) => `${normalize(property.name)}:${normalize(property.value)}`)
          .sort()
          .join('|'),
      )
      .filter(Boolean),
  );
}

function compatibilityMatches(
  expected: EbayCompatibilityPayload,
  actual: EbayCompatibilityPayload | null | undefined,
): boolean {
  const expectedKeys = compatibilityKey(expected);
  const actualKeys = compatibilityKey(actual);
  if (expectedKeys.size !== actualKeys.size) return false;
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) return false;
  }
  return true;
}

function sourceLocationMatches(
  expected: string | null,
  actual: EbayLocation | null,
): boolean {
  const wanted = normalize(expected);
  if (!wanted) return true;
  if (!actual) return false;
  const address = actual.location?.address ?? {};
  const actualText = normalize([
    actual.name,
    address.addressLine1,
    address.city,
    address.stateOrProvince,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(', '));
  const wantedTokens = wanted.split(/[, ]+/).filter(Boolean);
  return wantedTokens.every((token) => actualText.includes(token));
}

function isWarehouseBinLocation(value: string | null): boolean {
  const normalized = value?.trim() ?? '';
  return /^[A-Z0-9]+(?:-[A-Z0-9]+){2,}$/i.test(normalized);
}

function policyId(
  policies: PolicyRow[],
  accountId: string,
  marketplaceId: string,
  policyType: PolicyRow['policyType'],
  name: string | null,
): string | null {
  const wanted = normalize(name);
  if (!wanted) return null;
  return policies.find(
    (policy) =>
      policy.ebayAccountId === accountId &&
      policy.marketplaceId === marketplaceId &&
      policy.policyType === policyType &&
      normalize(policy.name) === wanted,
  )?.ebayPolicyId ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const limit = Math.max(0, Number(option('limit', '0')) || 0);
  const concurrency = Math.max(1, Math.min(4, Number(option('concurrency', '2')) || 2));
  const skipTrading = hasFlag('skip-trading');
  const channelFilter = option('channel-id', '').trim();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const inventoryApi = app.get(EbayInventoryApiService);
    const tradingApi = app.get(EbayTradingApiService);
    const reconciler = app.get(EbayCompatibilityReconciliationService);

    const [targets, policies] = await Promise.all([
      dataSource.query(`
        SELECT
          elc.id AS "channelId",
          ca.primary_store_id AS "storeId",
          elc.ebay_account_id AS "accountId",
          elc.marketplace_id AS "marketplaceId",
          elc.internal_sku AS "internalSku",
          elc.ebay_inventory_sku AS "ebaySku",
          elc.listing_id AS "listingId",
          elc.offer_id AS "offerId",
          cp.id AS "catalogProductId",
          COALESCE(NULLIF(lr.title, ''), cp.title) AS "sourceTitle",
          COALESCE(NULLIF(lr.description, ''), cp.description) AS "sourceDescription",
          cp.title AS "catalogTitle",
          cp.image_urls AS "sourceImages",
          COALESCE(NULLIF(lr.location, ''), NULLIF(cp.location, '')) AS "sourceLocation",
          COALESCE(NULLIF(lr."shippingProfileName", ''), NULLIF(cp.shipping_profile, '')) AS "sourceShippingProfile",
          COALESCE(NULLIF(lr."returnProfileName", ''), NULLIF(cp.return_profile, '')) AS "sourceReturnProfile",
          COALESCE(NULLIF(lr."paymentProfileName", ''), NULLIF(cp.payment_profile, '')) AS "sourcePaymentProfile",
          cp.fitment_data AS "fitmentData",
          cp.fitment_rows AS "fitmentRows"
        FROM ebay_listing_channels elc
        JOIN catalog_products cp ON cp.id = elc.catalog_product_id
        JOIN connected_ebay_accounts ca ON ca.id = elc.ebay_account_id
        JOIN LATERAL (
          SELECT lr.*
          FROM listing_records lr
          WHERE lr.origin = 'add_part'
            AND lr."customLabelSku" = cp.sku
            AND lr."deletedAt" IS NULL
          ORDER BY lr."updatedAt" DESC NULLS LAST, lr."importedAt" DESC NULLS LAST
          LIMIT 1
        ) lr ON TRUE
        WHERE elc.listing_status = 'published'
          AND elc.listing_id IS NOT NULL
          AND COALESCE(lr."cBrand", cp.brand, '') !~* '(febi|lemf)'
        ORDER BY elc.ebay_account_id, elc.listing_id
      `),
      dataSource.query(`
        SELECT ebay_account_id AS "ebayAccountId", marketplace_id AS "marketplaceId",
               policy_type AS "policyType", ebay_policy_id AS "ebayPolicyId", name
        FROM ebay_business_policies
      `),
    ]);

    const scopedTargets = channelFilter
      ? targets.filter((target) => target.channelId === channelFilter)
      : targets;
    if (channelFilter && scopedTargets.length === 0) {
      throw new Error(`Audit channel ${channelFilter} was not found in the Add Part target set`);
    }
    const selected = (limit > 0 ? scopedTargets.slice(0, limit) : scopedTargets) as AuditTarget[];
    console.log(JSON.stringify({
      event: 'audit_started',
      scope: 'listing_records.origin=add_part',
      targetCount: selected.length,
      candidateCount: targets.length,
      channelFilter: channelFilter || null,
      concurrency,
      skipTrading,
      readOnly: true,
      startedAt: new Date().toISOString(),
    }));

    const locationCache = new Map<string, Promise<EbayLocation | null>>();
    const getLocation = (storeId: string, key: string | null | undefined) => {
      const trimmed = key?.trim() ?? '';
      if (!trimmed) return Promise.resolve(null);
      const cacheKey = `${storeId}:${trimmed}`;
      const cached = locationCache.get(cacheKey);
      if (cached) return cached;
      const value = inventoryApi.getLocation(storeId, trimmed).catch(() => null);
      locationCache.set(cacheKey, value);
      return value;
    };

    const results: AuditResult[] = [];
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const index = cursor++;
        if (index >= selected.length) return;
        const target = selected[index];
        try {
          const expected = fitmentDataToCompatibilityPayload(
            selectPublishFitmentSource(target.fitmentData, target.fitmentRows),
          ) ?? { compatibleProducts: [] };
          const sourceImages = uniqueHttpUrls(target.sourceImages);
          const anomalies: string[] = [];
          const fetchErrors: string[] = [];
          let item: EbayInventoryItem | null = null;
          let offer: EbayOffer | null = null;
          let trading: Awaited<ReturnType<EbayTradingApiService['getItemDetails']>> | null = null;
          let inventoryCompatibility: EbayCompatibilityPayload | null = null;
          let tradingCompatibility: EbayCompatibilityPayload | null = null;
          let liveLocation: EbayLocation | null = null;

          if (!target.ebaySku) {
          anomalies.push('missing_ebay_inventory_sku');
          } else {
          try {
            item = await inventoryApi.getItem(target.storeId, target.ebaySku);
          } catch (error: unknown) {
            anomalies.push('inventory_item_not_found_or_unreadable');
            fetchErrors.push(`inventory_item: ${errorMessage(error)}`);
          }
          try {
            inventoryCompatibility = await inventoryApi.getCompatibility(
              target.storeId,
              target.ebaySku,
            );
          } catch (error: unknown) {
            if (expected.compatibleProducts.length > 0) {
              fetchErrors.push(`inventory_compatibility: ${errorMessage(error)}`);
            }
            inventoryCompatibility = { compatibleProducts: [] };
          }
          }

          if (target.offerId) {
          try {
            offer = await inventoryApi.getOffer(target.storeId, target.offerId);
          } catch (error: unknown) {
            fetchErrors.push(`offer: ${errorMessage(error)}`);
          }
          }
          if (!offer && target.ebaySku) {
          try {
            const page = await inventoryApi.getOffersBySku(target.storeId, target.ebaySku, 100, 0);
            offer = page.offers.find((candidate) => candidate.listingId === target.listingId) ??
              page.offers.find((candidate) => candidate.status === 'PUBLISHED') ?? null;
          } catch (error: unknown) {
            fetchErrors.push(`offers_by_sku: ${errorMessage(error)}`);
          }
          }

          if (!offer) anomalies.push('missing_or_unreadable_offer');
          if (!target.listingId) {
          anomalies.push('missing_listing_id');
          } else if (!skipTrading) {
          try {
            trading = await tradingApi.getItemDetails(
              target.storeId,
              target.listingId,
              target.marketplaceId,
            );
            tradingCompatibility = trading.compatibility ?? { compatibleProducts: [] };
          } catch (error: unknown) {
            anomalies.push('trading_listing_unreadable');
            fetchErrors.push(`trading_item: ${errorMessage(error)}`);
          }
          }

          const liveTitle = item?.product?.title ?? null;
          if (!liveTitle) anomalies.push('missing_live_title');
          else if (normalize(liveTitle) !== normalize(target.sourceTitle)) anomalies.push('title_mismatch');

          const inventoryDescription = item?.product?.description ?? null;
          const tradingDescription = trading?.description ?? null;
          const sourceDescription = target.sourceDescription?.trim() ?? '';
          const liveDescription = tradingDescription ?? inventoryDescription;
          const descriptionSource = tradingDescription
            ? 'trading'
            : inventoryDescription
              ? 'inventory'
              : 'unavailable';
          const descriptionMatches = sourceDescription.length === 0
            ? true
            : liveDescription != null && normalize(liveDescription) === normalize(sourceDescription);
          if (sourceDescription.length > 0 && !descriptionMatches) {
            anomalies.push(liveDescription ? 'description_mismatch' : 'missing_live_description');
          }

          const inventoryImageCount = item?.product?.imageUrls?.length ?? null;
          const tradingImageCount = trading?.imageUrls?.length ?? null;
          if (inventoryImageCount !== sourceImages.length) anomalies.push('inventory_image_count_mismatch');
          if (tradingImageCount !== null && tradingImageCount !== sourceImages.length) anomalies.push('trading_image_count_mismatch');

          if (!compatibilityMatches(expected, inventoryCompatibility)) anomalies.push('inventory_compatibility_mismatch');
          if (trading && !compatibilityMatches(expected, tradingCompatibility)) anomalies.push('trading_compatibility_mismatch');

          const expectedPolicies = {
          fulfillmentPolicyId: policyId(policies as PolicyRow[], target.accountId, target.marketplaceId, 'fulfillment', target.sourceShippingProfile),
          paymentPolicyId: policyId(policies as PolicyRow[], target.accountId, target.marketplaceId, 'payment', target.sourcePaymentProfile),
          returnPolicyId: policyId(policies as PolicyRow[], target.accountId, target.marketplaceId, 'return', target.sourceReturnProfile),
          };
          if (target.sourceShippingProfile && !expectedPolicies.fulfillmentPolicyId) anomalies.push('source_shipping_policy_not_synced');
          if (target.sourcePaymentProfile && !expectedPolicies.paymentPolicyId) anomalies.push('source_payment_policy_not_synced');
          if (target.sourceReturnProfile && !expectedPolicies.returnPolicyId) anomalies.push('source_return_policy_not_synced');

          const livePolicies = offer?.listingPolicies
          ? {
              fulfillmentPolicyId: offer.listingPolicies.fulfillmentPolicyId ?? null,
              paymentPolicyId: offer.listingPolicies.paymentPolicyId ?? null,
              returnPolicyId: offer.listingPolicies.returnPolicyId ?? null,
            }
          : null;
          if (offer && !livePolicies) {
          anomalies.push('missing_live_policies');
          } else if (livePolicies) {
          for (const [key, expectedId] of Object.entries(expectedPolicies)) {
            if (expectedId && livePolicies[key as keyof typeof livePolicies] !== expectedId) {
              anomalies.push(`${key}_mismatch`);
            }
          }
          }

          const liveLocationKey = offer?.merchantLocationKey ?? null;
          if (liveLocationKey) {
          liveLocation = await getLocation(target.storeId, liveLocationKey);
          if (
            target.sourceLocation &&
            !isWarehouseBinLocation(target.sourceLocation) &&
            !sourceLocationMatches(target.sourceLocation, liveLocation)
          ) {
            anomalies.push('location_mismatch');
          }
          } else {
            anomalies.push('missing_live_location');
          }

          const result: AuditResult = {
          channelId: target.channelId,
          accountId: target.accountId,
          storeId: target.storeId,
          marketplaceId: target.marketplaceId,
          internalSku: target.internalSku,
          ebaySku: target.ebaySku,
          listingId: target.listingId,
          offerId: offer?.offerId ?? target.offerId,
          sourceTitle: target.sourceTitle,
          liveTitle,
          sourceDescriptionLength: sourceDescription.length,
          inventoryDescriptionLength: inventoryDescription?.length ?? null,
          tradingDescriptionLength: tradingDescription?.length ?? null,
          liveDescriptionLength: liveDescription?.length ?? null,
          descriptionSource,
          descriptionMatches,
          sourceImageCount: sourceImages.length,
          inventoryImageCount,
          tradingImageCount,
          expectedCompatibilityCount: expected.compatibleProducts.length,
          inventoryCompatibilityCount: inventoryCompatibility?.compatibleProducts?.length ?? null,
          tradingCompatibilityCount: tradingCompatibility?.compatibleProducts?.length ?? null,
          expectedPolicies,
          livePolicies,
          liveOfferStatus: offer?.status ?? null,
          liveOfferListingId: offer?.listingId ?? null,
          expectedLocation: target.sourceLocation,
          liveLocationKey,
          liveLocation,
          anomalies: [...new Set(anomalies)],
          fetchErrors,
          };
          results.push(result);
          console.log(JSON.stringify({ event: 'audit_result', ...result }));
        } catch (error: unknown) {
          const result: AuditResult = {
            channelId: target.channelId,
            accountId: target.accountId,
            storeId: target.storeId,
            marketplaceId: target.marketplaceId,
            internalSku: target.internalSku,
            ebaySku: target.ebaySku,
            listingId: target.listingId,
            offerId: target.offerId,
            sourceTitle: target.sourceTitle,
            liveTitle: null,
            sourceDescriptionLength: target.sourceDescription?.length ?? 0,
            inventoryDescriptionLength: null,
            tradingDescriptionLength: null,
            liveDescriptionLength: null,
            descriptionSource: 'unavailable',
            descriptionMatches: null,
            sourceImageCount: uniqueHttpUrls(target.sourceImages).length,
            inventoryImageCount: null,
            tradingImageCount: null,
            expectedCompatibilityCount: 0,
            inventoryCompatibilityCount: null,
            tradingCompatibilityCount: null,
            expectedPolicies: {
              fulfillmentPolicyId: null,
              paymentPolicyId: null,
              returnPolicyId: null,
            },
            livePolicies: null,
            liveOfferStatus: null,
            liveOfferListingId: null,
            expectedLocation: target.sourceLocation,
            liveLocationKey: null,
            liveLocation: null,
            anomalies: ['audit_worker_error'],
            fetchErrors: [errorMessage(error)],
          };
          results.push(result);
          console.log(JSON.stringify({ event: 'audit_result', ...result }));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, selected.length)) }, () => worker()));
    const summary = {
      event: 'audit_completed',
      targetCount: results.length,
      anomalousCount: results.filter((result) => result.anomalies.length > 0).length,
      cleanCount: results.filter((result) => result.anomalies.length === 0).length,
      fetchErrorCount: results.filter((result) => result.fetchErrors.length > 0).length,
      anomalyCounts: Object.fromEntries(
        [...new Set(results.flatMap((result) => result.anomalies))]
          .map((code) => [code, results.filter((result) => result.anomalies.includes(code)).length]),
      ),
      completedAt: new Date().toISOString(),
    };
    console.log(JSON.stringify(summary));
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: 'audit_failed', error: errorMessage(error) }));
    process.exit(1);
  });
