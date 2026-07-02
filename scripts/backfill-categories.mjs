#!/usr/bin/env node
/**
 * Standalone script to backfill missing eBay category IDs.
 * Uses raw pg driver - no typeorm needed.
 *
 * Usage:
 *   node backfill-categories.mjs [--batch-size 10] [--dry-run]
 */

import pg from 'pg';
const { Client } = pg;

const args = process.argv.slice(2);
const batchSize = Number(args[args.indexOf('--batch-size') + 1] || 10);
const dryRun = args.includes('--dry-run');

// eBay Taxonomy API
async function getEbayToken() {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) throw new Error('Missing EBAY_APP_ID or EBAY_CERT_ID');

  const creds = Buffer.from(`${appId}:${certId}`).toString('base64');
  const resp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!resp.ok) throw new Error(`eBay auth failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

const TREE_IDS = { EBAY_US: '0', EBAY_AU: '15', EBAY_DE: '77', EBAY_GB: '3' };

async function getCategorySuggestions(token, query, treeId = '0') {
  const url = `https://api.ebay.com/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.categorySuggestions || [];
}

function buildQuery(title, brand, partType, mpn) {
  const shortParts = [brand, partType].filter(s => s?.trim());
  if (shortParts.length >= 2) return shortParts.join(' ').trim();

  if (title) {
    const cleaned = title
      .replace(new RegExp(`\\b${brand || ''}\\b`, 'gi'), '')
      .replace(/\b(New|OEM|Genuine|Left|Right|Front|Rear|Driver|Passenger|Upper|Lower|Inner|Outer|Gray|Black|White|Assembly|Set|Pair)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const words = cleaned.split(' ').filter(Boolean).slice(0, 5);
    if (words.length >= 2) return [brand, ...words].filter(Boolean).join(' ').trim();
  }

  const parts = [brand, partType, title].filter(s => s?.trim());
  if (parts.length === 0 && mpn) parts.push(mpn);
  return parts.join(' ').trim();
}

async function lookupCategory(token, title, brand, partType, mpn, marketplace) {
  const treeId = TREE_IDS[`EBAY_${marketplace}`] || '0';
  const query = buildQuery(title, brand, partType, mpn);
  if (!query) return { categoryId: null, categoryName: null };

  try {
    const suggestions = await getCategorySuggestions(token, query, treeId);
    const first = suggestions[0];
    if (first?.category?.categoryId) {
      return { categoryId: first.category.categoryId, categoryName: first.category.categoryName ?? null };
    }
    return { categoryId: null, categoryName: null };
  } catch (err) {
    console.warn(`Lookup failed for "${query}": ${err.message}`);
    return { categoryId: null, categoryName: null };
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🔧 eBay Category Backfill Script');
  console.log(`   Batch size: ${batchSize} | Dry run: ${dryRun}`);

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const token = await getEbayToken();
    console.log('✅ Got eBay API token\n');

    // ── Catalog Products ──
    const { rows: [{ count: catTotal }] } = await client.query(
      `SELECT COUNT(*)::int FROM catalog_products WHERE category_id IS NULL OR category_id = ''`
    );
    console.log(`📦 Catalog Products: ${catTotal} missing categoryId`);

    let catUpdated = 0, catFailed = 0;
    for (let offset = 0; offset < catTotal; offset += batchSize) {
      const { rows: batch } = await client.query(
        `SELECT id, sku, title, brand, part_type, mpn
         FROM catalog_products
         WHERE category_id IS NULL OR category_id = ''
         ORDER BY "createdAt" DESC
         LIMIT $1 OFFSET $2`, [batchSize, offset]
      );

      for (const p of batch) {
        const result = await lookupCategory(token, p.title, p.brand, p.part_type, p.mpn, 'US');
        if (result.categoryId) {
          if (!dryRun) {
            await client.query(
              `UPDATE catalog_products SET category_id = $1, category_name = $2 WHERE id = $3`,
              [result.categoryId, result.categoryName, p.id]
            );
          }
          catUpdated++;
          console.log(`  ✅ ${p.sku || p.id}: ${result.categoryId} (${result.categoryName})`);
        } else {
          catFailed++;
          console.log(`  ❌ ${p.sku || p.id}: no match`);
        }
        await sleep(200); // rate limit
      }
      console.log(`  Progress: ${Math.min(offset + batchSize, catTotal)}/${catTotal}`);
    }

    // ── Listing Records ──
    const { rows: [{ count: listTotal }] } = await client.query(
      `SELECT COUNT(*)::int FROM listing_records WHERE "categoryId" IS NULL OR "categoryId" = ''`
    );
    console.log(`\n📋 Listing Records: ${listTotal} missing categoryId`);

    let listUpdated = 0, listFailed = 0;
    for (let offset = 0; offset < listTotal; offset += batchSize) {
      const { rows: batch } = await client.query(
        `SELECT id, "customLabelSku", title, "cBrand", "categoryName", marketplace
         FROM listing_records
         WHERE "categoryId" IS NULL OR "categoryId" = ''
         ORDER BY "importedAt" DESC
         LIMIT $1 OFFSET $2`, [batchSize, offset]
      );

      for (const rec of batch) {
        let result;
        // Try categoryName first
        if (rec.categoryName) {
          const treeId = TREE_IDS[`EBAY_${rec.marketplace}`] || '0';
          const suggestions = await getCategorySuggestions(token, rec.categoryName, treeId);
          const exact = suggestions.find(s => s.category.categoryName.toLowerCase() === rec.categoryName.toLowerCase());
          if (exact?.category?.categoryId) {
            result = { categoryId: exact.category.categoryId, categoryName: exact.category.categoryName };
          }
        }
        // Fallback to keyword lookup
        if (!result?.categoryId) {
          result = await lookupCategory(token, rec.title, rec.cBrand, null, null, rec.marketplace || 'US');
        }

        if (result.categoryId) {
          if (!dryRun) {
            await client.query(
              `UPDATE listing_records SET "categoryId" = $1, "categoryName" = $2 WHERE id = $3`,
              [result.categoryId, result.categoryName, rec.id]
            );
          }
          listUpdated++;
          console.log(`  ✅ ${rec.customLabelSku || rec.id}: ${result.categoryId} (${result.categoryName})`);
        } else {
          listFailed++;
          console.log(`  ❌ ${rec.customLabelSku || rec.id}: no match`);
        }
        await sleep(200);
      }
      console.log(`  Progress: ${Math.min(offset + batchSize, listTotal)}/${listTotal}`);
    }

    // ── Also sync listing records from catalog_products where product has category but listing doesn't ──
    console.log('\n🔗 Syncing listing records from catalog products...');
    const { rows: [{ count: syncCount }] } = await client.query(`
      SELECT COUNT(*)::int FROM listing_records lr
      JOIN catalog_products cp ON cp.sku = lr."customLabelSku"
      WHERE (lr."categoryId" IS NULL OR lr."categoryId" = '')
        AND cp.category_id IS NOT NULL AND cp.category_id != ''
    `);
    console.log(`   ${syncCount} listing records can be synced from catalog products`);

    if (!dryRun && syncCount > 0) {
      const { rowCount } = await client.query(`
        UPDATE listing_records lr
        SET "categoryId" = cp.category_id, "categoryName" = cp.category_name
        FROM catalog_products cp
        WHERE cp.sku = lr."customLabelSku"
          AND (lr."categoryId" IS NULL OR lr."categoryId" = '')
          AND cp.category_id IS NOT NULL AND cp.category_id != ''
      `);
      console.log(`   ✅ Synced ${rowCount} listing records`);
    }

    console.log('\n📊 Summary:');
    console.log(`   Catalog Products: ${catUpdated} updated, ${catFailed} failed`);
    console.log(`   Listing Records:  ${listUpdated} updated, ${listFailed} failed`);
    console.log(`   Synced from catalog: ${syncCount}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
