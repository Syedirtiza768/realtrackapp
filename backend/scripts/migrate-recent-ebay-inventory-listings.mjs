import 'reflect-metadata';
import fs from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { EbayTradingMigrationModule } from '/app/dist/src/channels/ebay/ebay-trading-migration.module.js';
import { EbayInventoryApiService } from '/app/dist/src/channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '/app/dist/src/channels/ebay/ebay-trading-api.service.js';
import { EbayListingChannel } from '/app/dist/src/integrations/ebay/entities/ebay-listing-channel.entity.js';
import { ConnectedEbayAccount } from '/app/dist/src/integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from '/app/dist/src/published-listings/entities/ebay-published-listing.entity.js';

const PLAN_PATH = '/app/output/.recent-ebay-trading-migration-plan.json';
const RESULT_PATH = '/app/output/.recent-ebay-trading-migration-result.json';
const WINDOW_DAYS = 30;
const BATCH_SIZE = 5;
const MAX_CONVERSIONS_PER_RUN = 250;
const now = () => new Date();
const iso = () => now().toISOString();
const args = new Set(process.argv.slice(2));
const maxArg = process.argv.find((value) => value.startsWith('--max-conversions='));
const maxConversions = maxArg
  ? Number(maxArg.slice('--max-conversions='.length))
  : MAX_CONVERSIONS_PER_RUN;

function listingUrl(itemId, marketplaceId) {
  const host = marketplaceId === 'EBAY_GB' ? 'www.ebay.co.uk' : 'www.ebay.com';
  return `https://${host}/itm/${encodeURIComponent(itemId)}`;
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function isTradingApiRateLimit(error) {
  const status = error?.response?.status;
  return (
    status === 429 ||
    /21919144|10007|call usage limit|rate limit|too many requests/i.test(message(error))
  );
}

function takeBatches(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function toOfferCreatePayload(offer) {
  const {
    offerId: _offerId,
    listing: _listing,
    listingId: _listingId,
    status: _status,
    warnings: _warnings,
    violations: _violations,
    listingStatus: _listingStatus,
    ...payload
  } = offer;
  return payload;
}

function inputFrom(details, offer, channel) {
  const policies = offer.listingPolicies ?? {};
  const paymentProfileId =
    policies.paymentPolicyId ?? details.paymentProfileId;
  const shippingProfileId =
    policies.fulfillmentPolicyId ?? details.shippingProfileId;
  const returnProfileId = policies.returnPolicyId ?? details.returnProfileId;
  const price = Number(
    offer.pricingSummary?.price?.value ?? details.price ?? channel.channelPrice,
  );
  const quantity = Number(
    offer.availableQuantity ??
      (details.quantity == null
        ? channel.channelQuantity
        : details.quantity - (details.quantitySold ?? 0)),
  );
  const sku = details.sku ?? channel.ebayInventorySku ?? channel.internalSku;
  const required = {
    title: details.title,
    description: details.description,
    categoryId: details.categoryId ?? offer.categoryId,
    conditionId: details.conditionId,
    sku,
    paymentProfileId,
    shippingProfileId,
    returnProfileId,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value == null || value === '')
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`missing required eBay fields: ${missing.join(', ')}`);
  }
  const imageUrls = details.imageUrls ?? [];
  if (!imageUrls.length) throw new Error('listing has no eBay photos');
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('listing has no valid current eBay price');
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error('listing has no available quantity');
  }

  return {
    title: details.title,
    description: details.description,
    categoryId: String(required.categoryId),
    conditionId: Number(details.conditionId),
    conditionDescription: details.conditionDescription,
    quantity: Math.trunc(quantity),
    price,
    currency:
      details.currency ?? offer.pricingSummary?.price?.currency ?? 'USD',
    sku: String(sku),
    imageUrls,
    itemSpecifics: details.itemSpecifics ?? {},
    compatibility: details.compatibility,
    listingDuration: details.listingDuration ?? 'GTC',
    location: details.location,
    country: details.country,
    postalCode: details.postalCode,
    paymentProfileId: String(paymentProfileId),
    shippingProfileId: String(shippingProfileId),
    returnProfileId: String(returnProfileId),
    immediatePayRequired: details.listingDetails?.immediatePayRequired,
    bestOfferEnabled: details.listingDetails?.bestOfferEnabled,
  };
}

async function makePlan({ channelRepo, accountRepo, tradingApi, inventoryApi }) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const channels = await channelRepo
    .createQueryBuilder('channel')
    .where('channel.listingStatus = :status', { status: 'published' })
    .andWhere('channel.listingId IS NOT NULL')
    .andWhere('channel.offerId IS NOT NULL')
    .andWhere('channel.publishedAt >= :since', { since })
    .orderBy('channel.publishedAt', 'ASC')
    .addOrderBy('channel.id', 'ASC')
    .getMany();
  const ids = [...new Set(channels.map((channel) => channel.ebayAccountId))];
  const accounts = await accountRepo.find({ where: { id: In(ids) } });
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const entries = [];
  const alreadyTrading = [];
  const skipped = [];

  console.log(`Preflighting ${channels.length} published Inventory-backed channel rows`);
  for (let index = 0; index < channels.length; index++) {
    const channel = channels[index];
    const account = accountsById.get(channel.ebayAccountId);
    const itemId = channel.listingId;
    const offerId = channel.offerId;
    if (!account?.primaryStoreId || !itemId || !offerId) {
      skipped.push({ channelId: channel.id, itemId, reason: 'missing account, store, item ID, or offer ID' });
      continue;
    }
    try {
      const details = await tradingApi.getItemDetails(
        account.primaryStoreId,
        itemId,
        channel.marketplaceId,
      );
      if (details.listingStatus?.toLowerCase() !== 'active') {
        skipped.push({ channelId: channel.id, itemId, reason: `eBay item status is ${details.listingStatus ?? 'unknown'}` });
        continue;
      }
      if (details.inventoryTrackingMethod?.toLowerCase() === 'itemid') {
        alreadyTrading.push({
          channelId: channel.id,
          ebayAccountId: account.id,
          storeId: account.primaryStoreId,
          marketplaceId: channel.marketplaceId,
          itemId,
          sku: details.sku ?? channel.internalSku,
        });
        continue;
      }
      if (!details.listingType?.toLowerCase().includes('fixed')) {
        skipped.push({ channelId: channel.id, itemId, reason: 'not a fixed-price listing' });
        continue;
      }
      const offer = await inventoryApi.getOffer(account.primaryStoreId, offerId);
      const offerListingId = offer.listing?.listingId ?? offer.listingId;
      if (
        offer.status?.toUpperCase() !== 'PUBLISHED' ||
        offerListingId !== itemId ||
        (details.sku && offer.sku && details.sku !== offer.sku)
      ) {
        skipped.push({ channelId: channel.id, itemId, reason: 'Inventory offer is not the matching published offer' });
        continue;
      }
      const input = inputFrom(details, offer, channel);
      entries.push({
        channel: {
          id: channel.id,
          organizationId: channel.organizationId,
          catalogProductId: channel.catalogProductId,
          ebayAccountId: channel.ebayAccountId,
          marketplaceId: channel.marketplaceId,
          internalSku: channel.internalSku,
          ebayInventorySku: channel.ebayInventorySku,
          offerId,
          listingId: itemId,
          listingUrl: channel.listingUrl,
          publishedAt: channel.publishedAt,
        },
        storeId: account.primaryStoreId,
        accountDisplayName: account.accountDisplayName,
        itemId,
        offerId,
        details,
        offer,
        input,
      });
    } catch (error) {
      if (isTradingApiRateLimit(error)) {
        throw new Error(`Trading API rate limit reached during preflight; no listing changes were made: ${message(error)}`);
      }
      skipped.push({ channelId: channel.id, itemId, reason: message(error) });
    }
    if ((index + 1) % 100 === 0 || index + 1 === channels.length) {
      console.log(`Preflight ${index + 1}/${channels.length}`);
    }
  }

  const plan = {
    createdAt: iso(),
    since: since.toISOString(),
    candidateCount: channels.length,
    entries,
    alreadyTrading,
    skipped,
  };
  fs.writeFileSync(PLAN_PATH, JSON.stringify(plan));
  console.log(JSON.stringify({
    planPath: PLAN_PATH,
    candidates: channels.length,
    eligibleForReplacement: entries.length,
    alreadyTrading: alreadyTrading.length,
    skipped: skipped.length,
    skipReasons: countBy(skipped, (row) => row.reason),
  }, null, 2));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function applyPlan({ channelRepo, accountRepo, publishedRepo, tradingApi, inventoryApi }, plan) {
  if (!Number.isInteger(maxConversions) || maxConversions < 1 || maxConversions > 1000) {
    throw new Error('--max-conversions must be an integer between 1 and 1000');
  }
  const results = { converted: [], alreadyTrading: [], skipped: [], failed: [] };
  const accountIds = [...new Set([
    ...plan.entries.map((entry) => entry.channel.ebayAccountId),
    ...plan.alreadyTrading.map((entry) => entry.ebayAccountId),
  ])];
  const accounts = await accountRepo.find({ where: { id: In(accountIds) } });
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const groups = new Map();
  for (const entry of plan.entries) {
    const key = `${entry.storeId}|${entry.channel.marketplaceId}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const activeByGroup = new Map();
  const getActiveIndex = async (key, group) => {
    if (activeByGroup.has(key)) return activeByGroup.get(key);
    const first = group[0];
    const active = await tradingApi.getAllActiveListings(
      first.storeId,
      first.channel.marketplaceId,
    );
    const index = {
      bySku: new Map(active.reduce((map, item) => {
        if (!item.sku) return map;
        const rows = map.get(item.sku) ?? [];
        rows.push(item);
        map.set(item.sku, rows);
        return map;
      }, new Map())),
    };
    activeByGroup.set(key, index);
    console.log(`Loaded active-list recovery index for ${first.accountDisplayName}, ${first.channel.marketplaceId}: ${active.length} active listings`);
    return index;
  };
  let sellerRateLimited = false;

  for (const entry of plan.alreadyTrading) {
    const channel = await channelRepo.findOneBy({ id: entry.channelId });
    if (!channel || channel.listingId !== entry.itemId) {
      results.skipped.push({ itemId: entry.itemId, reason: 'channel mapping changed after planning' });
      continue;
    }
    channel.offerId = null;
    channel.ebayInventorySku = null;
    channel.lastErrorCode = null;
    channel.lastErrorMessage = null;
    channel.lastSyncedAt = now();
    await channelRepo.save(channel);
    const published = await publishedRepo.findOne({
      where: {
        ebayAccountId: entry.ebayAccountId,
        marketplaceId: entry.marketplaceId,
        ebayItemId: entry.itemId,
      },
    });
    if (published) {
      published.offerId = null;
      published.lastSyncedAt = now();
      await publishedRepo.save(published);
    }
    results.alreadyTrading.push(entry.itemId);
  }

  migrationGroups: for (const [key, group] of groups) {
    const first = group[0];
    let batchNumber = 0;
    for (const batch of takeBatches(group, BATCH_SIZE)) {
      batchNumber += 1;
      console.log(`Starting batch ${batchNumber} for ${first.accountDisplayName}, ${first.channel.marketplaceId} (${batch.length} listings)`);
      const ready = [];
      for (const entry of batch) {
        const current = await channelRepo.findOneBy({ id: entry.channel.id });
        if (
          !current ||
          current.listingId !== entry.itemId ||
          !current.offerId ||
          current.listingStatus !== 'published'
        ) {
          results.skipped.push({ itemId: entry.itemId, reason: 'channel mapping changed after planning' });
          continue;
        }
        if (entry.offerId !== current.offerId) {
          entry.offerId = current.offerId;
          entry.offer = null;
        }
        const pending = current.lastErrorCode === 'TRADING_MIGRATION_PENDING';
        let oldOffer = entry.offer;
        let offerPresent = true;
        try {
          oldOffer = await inventoryApi.getOffer(entry.storeId, entry.offerId);
          if (oldOffer.status?.toUpperCase() !== 'PUBLISHED') {
            if (pending && oldOffer.status?.toUpperCase() === 'UNPUBLISHED') {
              const restored = await inventoryApi.publishOffer(entry.storeId, entry.offerId);
              await restoreDatabaseMapping({
                entry,
                channel: current,
                offerId: entry.offerId,
                listingId: restored.listingId ?? entry.itemId,
                channelRepo,
                publishedRepo,
              });
              results.failed.push({ itemId: entry.itemId, sku: entry.input.sku, reason: 'resumed a pending migration by restoring the withdrawn Inventory offer', restored: true });
              continue;
            }
            results.skipped.push({ itemId: entry.itemId, reason: 'Inventory offer is no longer published' });
            continue;
          }
          if ((oldOffer.listing?.listingId ?? oldOffer.listingId) !== entry.itemId) {
            results.skipped.push({ itemId: entry.itemId, reason: 'Inventory offer is no longer attached to this listing' });
            continue;
          }
          const refreshedInput = inputFrom(entry.details, oldOffer, current);
          entry.input = refreshedInput;
          entry.offer = oldOffer;
        } catch (error) {
          if (!pending) {
            results.skipped.push({ itemId: entry.itemId, reason: `could not recheck current offer: ${message(error)}` });
            continue;
          }
          if (error?.response?.status !== 404) {
            results.failed.push({ itemId: entry.itemId, reason: `pending offer state is uncertain; left untouched for a safe retry: ${message(error)}`, restored: false });
            continue;
          }
          offerPresent = false;
          const sku = entry.input.sku;
          const { bySku } = await getActiveIndex(key, group);
          const replacement = (bySku.get(sku) ?? []).find((item) => item.itemId !== entry.itemId);
          if (replacement) {
            const replacementDetails = await tradingApi.getItemDetails(
              entry.storeId,
              replacement.itemId,
              entry.channel.marketplaceId,
            );
            if (replacementDetails.listingStatus?.toLowerCase() === 'active') {
              await saveConvertedMapping({
                entry,
                itemId: replacement.itemId,
                input: entry.input,
                channelRepo,
                publishedRepo,
              });
              results.converted.push({
                oldItemId: entry.itemId,
                newItemId: replacement.itemId,
                sku,
                storeId: entry.storeId,
                marketplaceId: entry.channel.marketplaceId,
              });
              continue;
            }
          }
          const stored = JSON.parse(current.lastErrorMessage ?? '{}');
          oldOffer = stored.offer ?? entry.offer;
        }
        const latestQuantity = Number(oldOffer.availableQuantity ?? entry.input.quantity);
        const latestPrice = Number(oldOffer.pricingSummary?.price?.value ?? entry.input.price);
        if (latestQuantity < 1 || !Number.isFinite(latestQuantity)) {
          results.skipped.push({ itemId: entry.itemId, reason: 'listing has no remaining available quantity' });
          continue;
        }
        entry.input.quantity = Math.trunc(latestQuantity);
        if (Number.isFinite(latestPrice) && latestPrice > 0) entry.input.price = latestPrice;
        ready.push({ entry, current, oldOffer, offerPresent });
      }

      const removed = [];
      for (const row of ready) {
        const { entry, current, oldOffer, offerPresent } = row;
        current.lastErrorCode = 'TRADING_MIGRATION_PENDING';
        current.lastErrorMessage = JSON.stringify({
          oldItemId: entry.itemId,
          oldOfferId: entry.offerId,
          offer: oldOffer,
        });
        await channelRepo.save(current);
        if (offerPresent) {
          try {
          await inventoryApi.withdrawOffer(entry.storeId, entry.offerId);
          await inventoryApi.deleteOffer(entry.storeId, entry.offerId);
        } catch (error) {
            try {
              const restored = await restoreOfferAfterEndFailure(
                inventoryApi,
                entry,
                oldOffer,
              );
              await restoreDatabaseMapping({
                entry,
                channel: current,
                offerId: restored.offerId,
                listingId: restored.listingId ?? entry.itemId,
                channelRepo,
                publishedRepo,
              });
              results.failed.push({ itemId: entry.itemId, sku: entry.input.sku, reason: `Could not end the old Inventory offer: ${message(error)}`, restored: true });
            } catch (restoreError) {
              current.lastErrorCode = 'TRADING_MIGRATION_PENDING';
              current.lastErrorMessage = JSON.stringify({
                oldItemId: entry.itemId,
                oldOfferId: entry.offerId,
                offer: oldOffer,
                migrationError: `Could not end the old Inventory offer: ${message(error)}`,
                restoreError: message(restoreError),
              });
              await channelRepo.save(current);
              results.failed.push({ itemId: entry.itemId, sku: entry.input.sku, reason: current.lastErrorMessage, restored: false });
            }
            continue;
          }
        }
        removed.push(row);
      }

      if (!removed.length) continue;
      const batchResults = await tradingApi.addFixedPriceItems(
        removed[0].entry.storeId,
        removed.map((row) => row.entry.input),
        removed[0].entry.channel.marketplaceId,
      );
      for (let index = 0; index < removed.length; index++) {
        const row = removed[index];
        const result = batchResults[index];
        if (result?.errorCode === '21919144' || result?.errorCode === '10007' || isTradingApiRateLimit(new Error(result?.error ?? ''))) {
          sellerRateLimited = true;
        }
        let newItemId = result?.success ? result.itemId : undefined;
        let failureReason = result?.error ?? 'AddItems did not return an item ID';
        if (!newItemId && result?.errorCode === '21917122') {
          try {
            const single = await tradingApi.addFixedPriceItem(
              row.entry.storeId,
              row.entry.input,
              row.entry.channel.marketplaceId,
            );
            newItemId = single.itemId;
          } catch (error) {
            failureReason = message(error);
          }
        }

        if (!newItemId) {
          try {
            const restored = await restoreOldOffer(inventoryApi, row.entry, row.oldOffer);
            await restoreDatabaseMapping({
              entry: row.entry,
              channel: row.current,
              offerId: restored.offerId,
              listingId: restored.listingId ?? row.entry.itemId,
              channelRepo,
              publishedRepo,
            });
            results.failed.push({ itemId: row.entry.itemId, sku: row.entry.input.sku, reason: failureReason, restored: true });
          } catch (error) {
            row.current.listingStatus = 'failed';
            row.current.lastErrorCode = 'TRADING_MIGRATION_RESTORE_FAILED';
            row.current.lastErrorMessage = `${failureReason}; restore failed: ${message(error)}`;
            await channelRepo.save(row.current);
            results.failed.push({ itemId: row.entry.itemId, sku: row.entry.input.sku, reason: row.current.lastErrorMessage, restored: false });
          }
          continue;
        }

        row.current.lastErrorMessage = JSON.stringify({
          oldItemId: row.entry.itemId,
          oldOfferId: row.entry.offerId,
          newItemId,
          offer: row.oldOffer,
        });
        await channelRepo.save(row.current);
        try {
          await saveConvertedMapping({
            entry: row.entry,
            itemId: newItemId,
            input: row.entry.input,
            channelRepo,
            publishedRepo,
          });
          results.converted.push({
            oldItemId: row.entry.itemId,
            newItemId,
            sku: row.entry.input.sku,
            storeId: row.entry.storeId,
            marketplaceId: row.entry.channel.marketplaceId,
          });
        } catch (error) {
          let endError;
          try {
            await tradingApi.endFixedPriceItem(
              row.entry.storeId,
              newItemId,
              row.entry.channel.marketplaceId,
            );
          } catch (errorWhileEnding) {
            endError = errorWhileEnding;
          }
          if (endError) {
            row.current.lastErrorCode = 'TRADING_MIGRATION_PENDING';
            row.current.lastErrorMessage = JSON.stringify({
              oldItemId: row.entry.itemId,
              oldOfferId: row.entry.offerId,
              newItemId,
              offer: row.oldOffer,
              mappingError: message(error),
              endError: message(endError),
            });
            await channelRepo.save(row.current);
            results.failed.push({ itemId: row.entry.itemId, newItemId, sku: row.entry.input.sku, reason: `database mapping failed and the new Trading listing could not be confirmed ended; left pending for safe recovery: ${message(error)}; ${message(endError)}`, restored: false });
            continue;
          }
          try {
            const restored = await restoreOldOffer(inventoryApi, row.entry, row.oldOffer);
            await restoreDatabaseMapping({
              entry: row.entry,
              channel: row.current,
              offerId: restored.offerId,
              listingId: restored.listingId ?? row.entry.itemId,
              channelRepo,
              publishedRepo,
            });
            results.failed.push({ itemId: row.entry.itemId, sku: row.entry.input.sku, reason: `database mapping failed and the old offer was restored: ${message(error)}`, restored: true });
          } catch (rollbackError) {
            row.current.listingStatus = 'failed';
            row.current.lastErrorCode = 'TRADING_MIGRATION_MAPPING_FAILED';
            row.current.lastErrorMessage = `new item ${newItemId}; mapping failed: ${message(error)}; rollback failed: ${message(rollbackError)}`;
            await channelRepo.save(row.current);
            results.failed.push({ itemId: row.entry.itemId, newItemId, sku: row.entry.input.sku, reason: row.current.lastErrorMessage, restored: false });
          }
        }
      }
      console.log(`Batch complete: ${results.converted.length} converted, ${results.failed.length} failures`);
      if (sellerRateLimited || results.converted.length >= maxConversions) {
        break migrationGroups;
      }
    }
  }

  const verify = [];
  for (const [key, group] of groups) {
    const first = group[0];
    const groupResults = results.converted.filter(
      (row) =>
        row.storeId === first.storeId &&
        row.marketplaceId === first.channel.marketplaceId,
    );
    let activeNewIdsFound = 0;
    let oldIdsStillActive = 0;
    const verificationErrors = [];
    for (const row of groupResults) {
      try {
        const current = await tradingApi.getItemDetails(
          row.storeId,
          row.newItemId,
          row.marketplaceId,
        );
        if (current.listingStatus?.toLowerCase() === 'active') {
          activeNewIdsFound += 1;
        } else {
          verificationErrors.push({
            itemId: row.newItemId,
            reason: `new Trading listing status is ${current.listingStatus ?? 'unknown'}`,
          });
        }
      } catch (error) {
        verificationErrors.push({ itemId: row.newItemId, reason: message(error) });
      }
      try {
        const old = await tradingApi.getItemDetails(
          row.storeId,
          row.oldItemId,
          row.marketplaceId,
        );
        if (old.listingStatus?.toLowerCase() === 'active') {
          oldIdsStillActive += 1;
          results.failed.push({
            oldItemId: row.oldItemId,
            newItemId: row.newItemId,
            sku: row.sku,
            reason: 'old ItemID remains active after the Inventory offer was deleted',
            restored: false,
          });
        }
      } catch (error) {
        verificationErrors.push({ itemId: row.oldItemId, reason: message(error) });
      }
    }
    verify.push({
      group: key,
      converted: groupResults.length,
      activeNewIdsFound,
      oldIdsStillActive,
      verificationErrors,
    });
  }

  const report = {
    completedAt: iso(),
    since: plan.since,
    planned: plan.entries.length,
    converted: results.converted.length,
    alreadyTrading: results.alreadyTrading.length,
    skipped: results.skipped.length + plan.skipped.length,
    failed: results.failed.length,
    verification: verify,
    results,
  };
  fs.writeFileSync(RESULT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    resultPath: RESULT_PATH,
    planned: report.planned,
    converted: report.converted,
    alreadyTrading: report.alreadyTrading,
    skipped: report.skipped,
    failed: report.failed,
    verification: verify,
    failures: results.failed.slice(0, 50),
  }, null, 2));
}

async function saveConvertedMapping({ entry, itemId, input, channelRepo, publishedRepo }) {
  await channelRepo.manager.transaction(async (manager) => {
    const channels = manager.getRepository(EbayListingChannel);
    const publishedListings = manager.getRepository(EbayPublishedListing);
    const channel = await channels.findOneBy({ id: entry.channel.id });
    if (!channel) throw new Error(`channel ${entry.channel.id} not found`);
    channel.listingId = itemId;
    channel.offerId = null;
    channel.ebayInventorySku = null;
    channel.listingUrl = listingUrl(itemId, entry.channel.marketplaceId);
    channel.channelPrice = input.price.toFixed(2);
    channel.channelQuantity = input.quantity;
    channel.listingStatus = 'published';
    channel.lastRevisedAt = now();
    channel.lastSyncedAt = now();
    channel.lastErrorCode = null;
    channel.lastErrorMessage = null;
    await channels.save(channel);

    let published = await publishedListings.findOne({
      where: [
        {
          ebayAccountId: entry.channel.ebayAccountId,
          marketplaceId: entry.channel.marketplaceId,
          ebayItemId: itemId,
        },
        {
          ebayAccountId: entry.channel.ebayAccountId,
          marketplaceId: entry.channel.marketplaceId,
          ebayItemId: entry.itemId,
        },
      ],
    });
    const updatedAt = now();
    const snapshot = {
      organizationId: entry.channel.organizationId,
      ebayAccountId: entry.channel.ebayAccountId,
      storeId: entry.storeId,
      marketplaceId: entry.channel.marketplaceId,
      ebayItemId: itemId,
      offerId: null,
      sku: input.sku,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      price: input.price.toFixed(2),
      currency: input.currency,
      quantityAvailable: input.quantity,
      quantitySold: entry.details.quantitySold ?? 0,
      listingStatus: 'active',
      listingFormat: 'fixed_price',
      listingUrl: listingUrl(itemId, entry.channel.marketplaceId),
      imageUrls: input.imageUrls,
      itemSpecifics: input.itemSpecifics ?? {},
      listingPolicies: entry.offer.listingPolicies ?? null,
      compatibility: input.compatibility ?? null,
      condition: String(entry.details.conditionId ?? ''),
      ebayStartTime: updatedAt,
      ebayEndTime: null,
      ebayLastModifiedAt: updatedAt,
      lastSyncedAt: updatedAt,
      catalogProductId: entry.channel.catalogProductId,
      ebayListingChannelId: entry.channel.id,
      rawEbayResponse: null,
      healthFlags: [],
      performanceMetrics: {},
    };
    if (!published) published = publishedListings.create(snapshot);
    else Object.assign(published, snapshot);
    await publishedListings.save(published);
  });
}

async function restoreOldOffer(inventoryApi, entry, oldOffer) {
  const recreated = await inventoryApi.createOffer(
    entry.storeId,
    toOfferCreatePayload(oldOffer),
  );
  const published = await inventoryApi.publishOffer(
    entry.storeId,
    recreated.offerId,
  );
  return { offerId: recreated.offerId, listingId: published.listingId };
}

async function restoreOfferAfterEndFailure(inventoryApi, entry, oldOffer) {
  try {
    const current = await inventoryApi.getOffer(entry.storeId, entry.offerId);
    const status = current.status?.toUpperCase();
    if (status === 'PUBLISHED') {
      return {
        offerId: entry.offerId,
        listingId: current.listing?.listingId ?? current.listingId ?? entry.itemId,
      };
    }
    if (status === 'UNPUBLISHED') {
      const published = await inventoryApi.publishOffer(entry.storeId, entry.offerId);
      return { offerId: entry.offerId, listingId: published.listingId ?? entry.itemId };
    }
    throw new Error(`Cannot safely restore Inventory offer in ${status ?? 'unknown'} state`);
  } catch (error) {
    const status = error?.response?.status;
    if (status !== 404) throw error;
    return restoreOldOffer(inventoryApi, entry, oldOffer);
  }
}

async function restoreDatabaseMapping({ entry, channel, offerId, listingId, channelRepo, publishedRepo }) {
  await channelRepo.manager.transaction(async (manager) => {
    const channels = manager.getRepository(EbayListingChannel);
    const publishedListings = manager.getRepository(EbayPublishedListing);
    const current = await channels.findOneBy({ id: entry.channel.id });
    if (!current) throw new Error(`channel ${entry.channel.id} not found`);
    current.listingId = listingId;
    current.offerId = offerId;
    current.ebayInventorySku = entry.input.sku;
    current.listingUrl = listingUrl(listingId, entry.channel.marketplaceId);
    current.channelPrice = entry.input.price.toFixed(2);
    current.channelQuantity = entry.input.quantity;
    current.listingStatus = 'published';
    current.lastErrorCode = 'TRADING_MIGRATION_FAILED_RESTORED';
    current.lastErrorMessage = 'Trading API creation failed; the original Inventory API offer was restored.';
    current.lastSyncedAt = now();
    await channels.save(current);
    const published = await publishedListings.findOne({
      where: [
        {
          ebayAccountId: entry.channel.ebayAccountId,
          marketplaceId: entry.channel.marketplaceId,
          ebayItemId: listingId,
        },
        {
          ebayAccountId: entry.channel.ebayAccountId,
          marketplaceId: entry.channel.marketplaceId,
          ebayItemId: entry.itemId,
        },
      ],
    });
    if (published) {
      published.ebayItemId = listingId;
      published.offerId = offerId;
      published.listingStatus = 'active';
      published.listingUrl = listingUrl(listingId, entry.channel.marketplaceId);
      published.price = entry.input.price.toFixed(2);
      published.quantityAvailable = entry.input.quantity;
      published.lastSyncedAt = now();
      await publishedListings.save(published);
    }
  });
}

async function main() {
  if (args.has('--plan') === args.has('--apply-plan')) {
    throw new Error('Choose exactly one mode: --plan or --apply-plan');
  }
  const app = await NestFactory.createApplicationContext(EbayTradingMigrationModule, {
    logger: ['error', 'warn'],
  });
  try {
    fs.mkdirSync('/app/output', { recursive: true });
    const channelRepo = app.get(getRepositoryToken(EbayListingChannel));
    const accountRepo = app.get(getRepositoryToken(ConnectedEbayAccount));
    const publishedRepo = app.get(getRepositoryToken(EbayPublishedListing));
    const tradingApi = app.get(EbayTradingApiService);
    const inventoryApi = app.get(EbayInventoryApiService);
    const services = { channelRepo, accountRepo, publishedRepo, tradingApi, inventoryApi };
    if (args.has('--plan')) {
      await makePlan(services);
      return;
    }
    if (!fs.existsSync(PLAN_PATH)) {
      throw new Error(`Migration plan not found at ${PLAN_PATH}; run --plan first`);
    }
    const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
    await applyPlan(services, plan);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(`Migration stopped: ${message(error)}`);
  process.exitCode = 1;
});
