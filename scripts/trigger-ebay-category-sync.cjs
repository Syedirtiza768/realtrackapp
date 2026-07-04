/**
 * One-shot: fetch eBay categories accepted per connected store marketplace
 * via Trading API GetCategories (uses each store's OAuth token).
 *
 * Run inside Docker:
 *   docker compose exec backend node scripts/trigger-ebay-category-sync.cjs
 */
const https = require('https');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { EbayAuthService } = require('../dist/src/channels/ebay/ebay-auth.service.js');
const { EbayCategory } = require('../dist/src/listings/entities/ebay-category.entity.js');
const { Store } = require('../dist/src/channels/entities/store.entity.js');
const { ConnectedEbayAccount } = require('../dist/src/integrations/ebay/entities/connected-ebay-account.entity.js');
const { DataSource } = require('typeorm');

const SITE_ID = {
  EBAY_US: 0,
  EBAY_MOTORS_US: 100,
  EBAY_GB: 3,
  EBAY_DE: 77,
  EBAY_AU: 15,
};

const TREE_ID = {
  EBAY_US: '0',
  EBAY_MOTORS_US: '0',
  EBAY_GB: '3',
  EBAY_DE: '77',
  EBAY_AU: '15',
};

/** Motors / vehicle-parts subtree roots per marketplace */
const MOTORS_ROOT = {
  EBAY_US: '6000',
  EBAY_MOTORS_US: '6000',
  EBAY_AU: '29690',
  EBAY_GB: '9800',
  EBAY_DE: '131090',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tagValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m?.[1]?.trim() ?? null;
}

function parseCategories(xml) {
  const blocks = xml.match(/<Category>[\s\S]*?<\/Category>/gi) ?? [];
  const rows = [];
  for (const block of blocks) {
    const id = tagValue(block, 'CategoryID');
    const name = tagValue(block, 'CategoryName');
    const parentId = tagValue(block, 'CategoryParentID');
    const level = Number(tagValue(block, 'CategoryLevel') ?? '0');
    const leaf = /<LeafCategory>true<\/LeafCategory>/i.test(block);
    if (!id || !name) continue;
    rows.push({
      ebayCategoryId: id,
      parentCategoryId: parentId === id ? null : parentId,
      categoryName: name,
      depth: Number.isFinite(level) ? level : 0,
      isLeaf: leaf,
    });
  }
  return rows;
}

function buildPaths(rows) {
  const byId = new Map(rows.map((r) => [r.ebayCategoryId, r]));
  for (const row of rows) {
    const parts = [row.categoryName];
    let parentId = row.parentCategoryId;
    let guard = 0;
    while (parentId && byId.has(parentId) && guard++ < 25) {
      parts.unshift(byId.get(parentId).categoryName);
      parentId = byId.get(parentId).parentCategoryId;
    }
    row.categoryPath = parts.join(' > ');
  }
}

function httpsPost(hostname, pathName, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: pathName, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        } else resolve(data);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getCategories(token, marketplaceId, sandbox, categoryParent) {
  const host = sandbox ? 'api.sandbox.ebay.com' : 'api.ebay.com';
  const siteId = SITE_ID[marketplaceId] ?? 0;
  const parentXml = categoryParent
    ? `<CategoryParent>${categoryParent}</CategoryParent>`
    : '';
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <ViewAllNodes>true</ViewAllNodes>
  <LevelLimit>8</LevelLimit>
  ${parentXml}
</GetCategoriesRequest>`;

  const xml = await httpsPost(
    host,
    '/ws/api.dll',
    {
      'Content-Type': 'text/xml',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-CALL-NAME': 'GetCategories',
      'X-EBAY-API-SITEID': String(siteId),
      'X-EBAY-API-IAF-TOKEN': token,
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  );

  if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
    throw new Error(tagValue(xml, 'LongMessage') ?? 'GetCategories failed');
  }
  return xml;
}

async function upsertCategories(ds, treeId, rows) {
  const repo = ds.getRepository(EbayCategory);
  const chunkSize = 250;
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await repo.upsert(
      chunk.map((row) => ({
        ebayCategoryId: row.ebayCategoryId,
        treeId,
        parentCategoryId: row.parentCategoryId,
        categoryName: row.categoryName,
        categoryPath: row.categoryPath ?? row.categoryName,
        depth: row.depth,
        isLeaf: row.isLeaf,
        requiredAspects: [],
        recommendedAspects: [],
        supportsCompatibility: false,
      })),
      ['ebayCategoryId', 'treeId'],
    );
    total += chunk.length;
  }
  return total;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ebayAuth = app.get(EbayAuthService);
    const ds = app.get(DataSource);
    const storeRepo = ds.getRepository(Store);
    const accountRepo = ds.getRepository(ConnectedEbayAccount);

    const stores = await storeRepo
      .createQueryBuilder('s')
      .innerJoin(
        ConnectedEbayAccount,
        'a',
        'a.channel_connection_id = s.connection_id',
      )
      .where('s.channel = :ch', { ch: 'ebay' })
      .andWhere('s.status = :st', { st: 'active' })
      .andWhere('a.connection_status = :cs', { cs: 'active' })
      .andWhere('s.ebay_marketplace_id IS NOT NULL')
      .orderBy('s.ebay_marketplace_id', 'ASC')
      .addOrderBy('s.store_name', 'ASC')
      .getMany();

    const seen = new Set();
    const apiConfig = ebayAuth.getApiConfig();

    console.log(`Found ${stores.length} active eBay store row(s)`);

    for (const store of stores) {
      const mkt = store.ebayMarketplaceId;
      if (!mkt || seen.has(mkt)) continue;
      seen.add(mkt);

      const account = await accountRepo.findOne({
        where: { channelConnectionId: store.connectionId },
      });
      if (!account || account.connectionSource !== 'native_oauth') {
        console.log(`\nSkipping ${mkt}: no native OAuth account`);
        continue;
      }

      const motorsRoot = MOTORS_ROOT[mkt];
      const treeId = TREE_ID[mkt] ?? '0';
      console.log(`\n--- ${store.storeName} / ${mkt} (tree ${treeId}, motors root ${motorsRoot}) ---`);

      try {
        const token = await ebayAuth.getAccessToken(store.id);
        const xml = await getCategories(
          token,
          mkt,
          apiConfig.sandbox,
          motorsRoot,
        );
        let rows = parseCategories(xml);
        buildPaths(rows);
        console.log(`  Fetched ${rows.length} categories from Trading API`);

        if (!rows.length && motorsRoot) {
          console.log('  Retrying without CategoryParent filter...');
          const xmlAll = await getCategories(token, mkt, apiConfig.sandbox, null);
          rows = parseCategories(xmlAll);
          buildPaths(rows);
          const filtered = rows.filter((r) =>
            /motors|vehicle|auto|motorrad|parts|accessories|teile|zubeh/i.test(
              r.categoryPath ?? r.categoryName,
            ),
          );
          if (filtered.length > 100) rows = filtered;
          console.log(`  Fallback fetched ${rows.length} categories`);
        }

        const upserted = await upsertCategories(ds, treeId, rows);
        console.log(`  Upserted ${upserted} rows into ebay_categories`);
      } catch (err) {
        console.error(`  Failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      await sleep(2000);
    }

    const summary = await ds.query(`
      SELECT tree_id, COUNT(*)::int AS cnt, MAX(updated_at) AS last_updated
      FROM ebay_categories GROUP BY tree_id ORDER BY tree_id
    `);
    console.log('\nebay_categories summary:');
    for (const row of summary) {
      console.log(`  tree ${row.tree_id}: ${row.cnt} categories (updated ${row.last_updated})`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
