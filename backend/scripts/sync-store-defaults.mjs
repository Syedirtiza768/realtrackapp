#!/usr/bin/env node

/**
 * sync-store-defaults.mjs
 *
 * Syncs store location + all default policies (fulfillment, payment, return)
 * from the eBay Account/Inventory API into the local database.
 *
 * Targets: "Superior Auto Parts" by default, or all connected accounts with --all.
 *
 * Usage:
 *   node scripts/sync-store-defaults.mjs                    # Superior Auto Parts only
 *   node scripts/sync-store-defaults.mjs --all              # all connected accounts
 *   node scripts/sync-store-defaults.mjs --account <uuid>   # specific account
 *   node scripts/sync-store-defaults.mjs --dry-run          # show what would change
 *
 * Run from the `backend/` directory (needs .env for DB + encryption key).
 */

import pg from 'pg';
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flagAll = args.includes('--all');
const dryRun = args.includes('--dry-run');
const accountIdx = args.indexOf('--account');
const targetAccountId = accountIdx !== -1 ? args[accountIdx + 1] : null;
const targetName = 'Superior Auto Parts';

// ── DB ────────────────────────────────────────────────────────
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'listingpro',
  connectionTimeoutMillis: 15000,
};

// ── Encryption (AES-256-GCM, matches TokenEncryptionService) ──
const hexKey =
  process.env.TOKEN_ENCRYPTION_KEY || process.env.CHANNEL_ENCRYPTION_KEY || '';
const encKey =
  hexKey.length === 64
    ? Buffer.from(hexKey, 'hex')
    : crypto.scryptSync('dev-insecure-key', 'salt', 32);

function decrypt(ciphertext) {
  const [ivB64, tagB64, encB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ── eBay API helpers ──────────────────────────────────────────
function apiClient(baseUrl) {
  return axios.create({
    baseURL: baseUrl.replace(/\/$/, ''),
    timeout: 45000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
}

function readDefaultFlag(row) {
  const labels = row.label;
  if (Array.isArray(labels)) {
    return labels.some((l) => String(l).toUpperCase().includes('DEFAULT'));
  }
  return false;
}

async function listPolicies(http, token, marketplaceId, path, mapFn) {
  const out = [];
  let offset = 0;
  const limit = 20;
  for (let page = 0; page < 50; page++) {
    const { data } = await http.get(path, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      },
      params: { marketplace_id: marketplaceId, limit, offset },
    });
    const batch = mapFn(data).filter((p) => p.ebayPolicyId);
    out.push(...batch);
    const total = data.total ?? Number.MAX_SAFE_INTEGER;
    if (offset + batch.length >= total || batch.length !== limit) break;
    offset += limit;
  }
  return out;
}

async function listFulfillmentPolicies(http, token, mp) {
  return listPolicies(http, token, mp, '/sell/account/v1/fulfillment_policy', (data) =>
    (data.fulfillmentPolicies ?? []).map((p) => ({
      ebayPolicyId: String(p.fulfillmentPolicyId ?? ''),
      name: String(p.name ?? ''),
      isDefault: readDefaultFlag(p),
      raw: p,
    })),
  );
}

async function listPaymentPolicies(http, token, mp) {
  return listPolicies(http, token, mp, '/sell/account/v1/payment_policy', (data) =>
    (data.paymentPolicies ?? []).map((p) => ({
      ebayPolicyId: String(p.paymentPolicyId ?? ''),
      name: String(p.name ?? ''),
      isDefault: readDefaultFlag(p),
      raw: p,
    })),
  );
}

async function listReturnPolicies(http, token, mp) {
  return listPolicies(http, token, mp, '/sell/account/v1/return_policy', (data) =>
    (data.returnPolicies ?? []).map((p) => ({
      ebayPolicyId: String(p.returnPolicyId ?? ''),
      name: String(p.name ?? ''),
      isDefault: readDefaultFlag(p),
      raw: p,
    })),
  );
}

async function listInventoryLocations(http, token, mp) {
  const out = [];
  let offset = 0;
  const limit = 50;
  for (let page = 0; page < 20; page++) {
    const { data } = await http.get('/sell/inventory/v1/location', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': mp,
      },
      params: { limit, offset },
    });
    const locs = data.locations ?? [];
    const total = data.total ?? Number.MAX_SAFE_INTEGER;
    for (const l of locs) {
      const key = String(l.merchantLocationKey ?? '');
      if (!key) continue;
      out.push({
        merchantLocationKey: key,
        name: String(l.name ?? key),
        address: l.location?.address ?? {},
        raw: l,
      });
    }
    if (offset + locs.length >= total || locs.length !== limit) break;
    offset += limit;
  }
  return out;
}

// ── Location scoring (mirrors pickPreferredInventoryLocationKey) ──
const DEFAULT_KEY = 'AE_Dubai';

function scoreLocation(loc) {
  const key = loc.merchantLocationKey ?? '';
  const country = (loc.address?.country ?? '').toUpperCase();
  const city = (loc.address?.city ?? '').toLowerCase();
  const postal = loc.address?.postalCode ?? '';
  let s = 0;
  if (key === DEFAULT_KEY || key === 'AE_Dubai') s += 100;
  if (key.startsWith('AE_')) s += 50;
  if (country === 'AE') s += 40;
  if (city === 'dubai') s += 20;
  if (key === 'default') s += 5;
  if (key === 'US_77001' || postal === '77001' || city === 'houston') s -= 100;
  if (country === 'US' && postal === '77001') s -= 50;
  return s;
}

function pickPreferredLocation(locations) {
  if (!locations.length) return undefined;
  return [...locations].sort((a, b) => scoreLocation(b) - scoreLocation(a))[0];
}

// ── Pick default policy (first marked default, or first) ──────
function pickDefault(items) {
  return items.find((x) => x.isDefault) ?? items[0] ?? null;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const client = new pg.Client(dbConfig);
  const report = [];

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected.\n');

    // 1. Find target accounts
    let accountQuery;
    let queryParams;
    if (targetAccountId) {
      accountQuery = `SELECT * FROM connected_ebay_accounts WHERE id = $1`;
      queryParams = [targetAccountId];
    } else if (flagAll) {
      accountQuery = `SELECT * FROM connected_ebay_accounts WHERE connection_status != 'disabled' ORDER BY account_display_name`;
      queryParams = [];
    } else {
      accountQuery = `SELECT * FROM connected_ebay_accounts WHERE account_display_name ILIKE $1 AND connection_status != 'disabled'`;
      queryParams = [`%${targetName}%`];
    }

    const { rows: accounts } = await client.query(accountQuery, queryParams);

    if (!accounts.length) {
      console.log(`No matching eBay accounts found.${!flagAll ? ` (searched for "${targetName}")` : ''}`);
      return;
    }

    console.log(`Found ${accounts.length} account(s) to sync:\n`);
    for (const a of accounts) {
      console.log(`  • ${a.account_display_name} (id=${a.id}, user=${a.ebay_user_id}, env=${a.environment})`);
    }
    console.log('');

    for (const account of accounts) {
      const acctReport = {
        accountId: account.id,
        displayName: account.account_display_name,
        ebayUserId: account.ebay_user_id,
        marketplaces: [],
      };

      console.log(`\n${'='.repeat(70)}`);
      console.log(`Syncing: ${account.account_display_name} (${account.ebay_user_id})`);
      console.log(`${'='.repeat(70)}`);

      // 2. Get token
      const { rows: tokenRows } = await client.query(
        `SELECT * FROM ebay_oauth_tokens WHERE ebay_account_id = $1`,
        [account.id],
      );
      if (!tokenRows.length) {
        console.log('  ⚠ No OAuth token found — skipping.');
        report.push({ ...acctReport, error: 'No OAuth token' });
        continue;
      }

      let accessToken;
      try {
        accessToken = decrypt(tokenRows[0].access_token_encrypted);
      } catch (err) {
        console.log(`  ⚠ Token decryption failed: ${err.message} — skipping.`);
        report.push({ ...acctReport, error: `Token decrypt failed: ${err.message}` });
        continue;
      }

      const baseUrl =
        account.environment === 'production'
          ? 'https://api.ebay.com'
          : 'https://api.sandbox.ebay.com';
      const http = apiClient(baseUrl);

      // 3. Get marketplaces
      const { rows: marketplaces } = await client.query(
        `SELECT * FROM ebay_account_marketplaces WHERE ebay_account_id = $1 AND enabled = true`,
        [account.id],
      );
      if (!marketplaces.length) {
        console.log('  ⚠ No enabled marketplaces — skipping.');
        report.push({ ...acctReport, error: 'No enabled marketplaces' });
        continue;
      }

      for (const mp of marketplaces) {
        const mpReport = {
          marketplaceId: mp.marketplace_id,
          before: {
            fulfillmentPolicyId: mp.default_fulfillment_policy_id,
            paymentPolicyId: mp.default_payment_policy_id,
            returnPolicyId: mp.default_return_policy_id,
            inventoryLocationKey: mp.default_inventory_location_key,
          },
          after: {},
          policiesSynced: 0,
          locations: [],
        };

        console.log(`\n  Marketplace: ${mp.marketplace_id} (currency=${mp.currency})`);

        // 4. Fetch policies from eBay
        let fulfill, payment, ret, locations;
        try {
          [fulfill, payment, ret] = await Promise.all([
            listFulfillmentPolicies(http, accessToken, mp.marketplace_id),
            listPaymentPolicies(http, accessToken, mp.marketplace_id),
            listReturnPolicies(http, accessToken, mp.marketplace_id),
          ]);
        } catch (err) {
          const msg = err.response?.data?.errors?.[0]?.message ?? err.message;
          console.log(`  ✗ Policy fetch failed: ${msg}`);
          mpReport.error = msg;
          acctReport.marketplaces.push(mpReport);
          continue;
        }

        try {
          locations = await Promise.race([
            listInventoryLocations(http, accessToken, mp.marketplace_id),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout (30s)')), 30000),
            ),
          ]);
        } catch (err) {
          console.log(`  ⚠ Location fetch failed: ${err.message}`);
          locations = [];
        }

        // 5. Print what we found
        console.log(`  Policies from eBay:`);
        console.log(`    Fulfillment: ${fulfill.length} (${fulfill.filter((p) => p.isDefault).length} default)`);
        for (const p of fulfill) {
          console.log(`      ${p.isDefault ? '★' : ' '} ${p.name} (${p.ebayPolicyId})`);
        }
        console.log(`    Payment: ${payment.length} (${payment.filter((p) => p.isDefault).length} default)`);
        for (const p of payment) {
          console.log(`      ${p.isDefault ? '★' : ' '} ${p.name} (${p.ebayPolicyId})`);
        }
        console.log(`    Return: ${ret.length} (${ret.filter((p) => p.isDefault).length} default)`);
        for (const p of ret) {
          console.log(`      ${p.isDefault ? '★' : ' '} ${p.name} (${p.ebayPolicyId})`);
        }

        console.log(`\n  Inventory Locations from eBay: ${locations.length}`);
        for (const loc of locations) {
          const addr = loc.address;
          const addrStr = [addr.addressLine1, addr.city, addr.stateOrProvince, addr.postalCode, addr.country]
            .filter(Boolean)
            .join(', ');
          console.log(`    • ${loc.merchantLocationKey} — "${loc.name}" — ${addrStr}`);
        }

        // 6. Pick defaults
        const defFulfill = pickDefault(fulfill);
        const defPayment = pickDefault(payment);
        const defReturn = pickDefault(ret);
        const preferredLoc = pickPreferredLocation(locations);

        const newFulfillId = defFulfill?.ebayPolicyId ?? null;
        const newPaymentId = defPayment?.ebayPolicyId ?? null;
        const newReturnId = defReturn?.ebayPolicyId ?? null;
        const newLocationKey = preferredLoc?.merchantLocationKey ?? null;

        mpReport.after = {
          fulfillmentPolicyId: newFulfillId,
          paymentPolicyId: newPaymentId,
          returnPolicyId: newReturnId,
          inventoryLocationKey: newLocationKey,
        };
        mpReport.policiesSynced = fulfill.length + payment.length + ret.length;
        mpReport.locations = locations.map((l) => ({
          key: l.merchantLocationKey,
          name: l.name,
          address: l.address,
        }));

        // 7. Print what will change
        console.log(`\n  Defaults to set:`);
        const changes = [];
        if (mpReport.before.fulfillmentPolicyId !== newFulfillId) {
          changes.push(`    Fulfillment: ${mpReport.before.fulfillmentPolicyId ?? '(none)'} → ${newFulfillId} (${defFulfill?.name ?? '?'})`);
        }
        if (mpReport.before.paymentPolicyId !== newPaymentId) {
          changes.push(`    Payment: ${mpReport.before.paymentPolicyId ?? '(none)'} → ${newPaymentId} (${defPayment?.name ?? '?'})`);
        }
        if (mpReport.before.returnPolicyId !== newReturnId) {
          changes.push(`    Return: ${mpReport.before.returnPolicyId ?? '(none)'} → ${newReturnId} (${defReturn?.name ?? '?'})`);
        }
        if (mpReport.before.inventoryLocationKey !== newLocationKey) {
          changes.push(`    Location: ${mpReport.before.inventoryLocationKey ?? '(none)'} → ${newLocationKey} (${preferredLoc?.name ?? '?'})`);
        }

        if (changes.length) {
          for (const c of changes) console.log(c);
        } else {
          console.log('    (no changes — already up to date)');
        }

        // 8. Persist
        if (!dryRun) {
          // Replace policies in ebay_business_policies
          await client.query(
            `DELETE FROM ebay_business_policies WHERE ebay_account_id = $1 AND marketplace_id = $2`,
            [account.id, mp.marketplace_id],
          );

          let inserted = 0;
          for (const p of fulfill) {
            await client.query(
              `INSERT INTO ebay_business_policies (id, ebay_account_id, marketplace_id, policy_type, ebay_policy_id, name, raw_payload, is_default, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'fulfillment', $3, $4, $5, $6, NOW(), NOW())`,
              [account.id, mp.marketplace_id, p.ebayPolicyId, p.name, JSON.stringify(p.raw), p.isDefault],
            );
            inserted++;
          }
          for (const p of payment) {
            await client.query(
              `INSERT INTO ebay_business_policies (id, ebay_account_id, marketplace_id, policy_type, ebay_policy_id, name, raw_payload, is_default, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'payment', $3, $4, $5, $6, NOW(), NOW())`,
              [account.id, mp.marketplace_id, p.ebayPolicyId, p.name, JSON.stringify(p.raw), p.isDefault],
            );
            inserted++;
          }
          for (const p of ret) {
            await client.query(
              `INSERT INTO ebay_business_policies (id, ebay_account_id, marketplace_id, policy_type, ebay_policy_id, name, raw_payload, is_default, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'return', $3, $4, $5, $6, NOW(), NOW())`,
              [account.id, mp.marketplace_id, p.ebayPolicyId, p.name, JSON.stringify(p.raw), p.isDefault],
            );
            inserted++;
          }

          // Update marketplace defaults
          await client.query(
            `UPDATE ebay_account_marketplaces
             SET default_fulfillment_policy_id = $1,
                 default_payment_policy_id = $2,
                 default_return_policy_id = $3,
                 default_inventory_location_key = $4,
                 updated_at = NOW()
             WHERE id = $5`,
            [newFulfillId, newPaymentId, newReturnId, newLocationKey, mp.id],
          );

          // Update stores table (legacy Phase 1 columns)
          const { rows: storeRows } = await client.query(
            `SELECT id FROM stores WHERE id = $1`,
            [account.primary_store_id],
          );
          if (storeRows.length) {
            await client.query(
              `UPDATE stores
               SET fulfillment_policy_id = $1,
                   payment_policy_id = $2,
                   return_policy_id = $3,
                   location_key = $4,
                   updated_at = NOW()
               WHERE id = $5`,
              [newFulfillId, newPaymentId, newReturnId, newLocationKey, account.primary_store_id],
            );
            console.log(`\n  ✓ Updated stores row (${account.primary_store_id})`);
          }

          console.log(`  ✓ Replaced ${inserted} policy rows in ebay_business_policies`);
          console.log(`  ✓ Updated ebay_account_marketplaces defaults`);
        } else {
          console.log('\n  (dry-run — no database writes)');
        }

        acctReport.marketplaces.push(mpReport);
      }

      // Stamp account
      if (!dryRun) {
        await client.query(
          `UPDATE connected_ebay_accounts SET last_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [account.id],
        );
        console.log(`\n  ✓ Stamped last_verified_at on account`);
      }

      report.push(acctReport);
    }

    // ── Final Summary ──
    console.log(`\n\n${'='.repeat(70)}`);
    console.log('SYNC SUMMARY');
    console.log(`${'='.repeat(70)}`);

    for (const acct of report) {
      console.log(`\nAccount: ${acct.displayName} (${acct.ebayUserId})`);
      if (acct.error) {
        console.log(`  Error: ${acct.error}`);
        continue;
      }
      for (const mp of acct.marketplaces) {
        console.log(`  Marketplace: ${mp.marketplaceId}`);
        if (mp.error) {
          console.log(`    Error: ${mp.error}`);
          continue;
        }
        console.log(`    Policies synced: ${mp.policiesSynced}`);
        console.log(`    Fulfillment Policy: ${mp.after.fulfillmentPolicyId ?? '(none)'}`);
        console.log(`    Payment Policy:    ${mp.after.paymentPolicyId ?? '(none)'}`);
        console.log(`    Return Policy:     ${mp.after.returnPolicyId ?? '(none)'}`);
        console.log(`    Location Key:      ${mp.after.inventoryLocationKey ?? '(none)'}`);
        if (mp.locations.length) {
          console.log(`    All Locations:`);
          for (const loc of mp.locations) {
            const addr = [loc.address.addressLine1, loc.address.city, loc.address.stateOrProvince, loc.address.postalCode, loc.address.country]
              .filter(Boolean)
              .join(', ');
            console.log(`      • ${loc.key} — "${loc.name}" — ${addr}`);
          }
        }
      }
    }

    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done.`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
