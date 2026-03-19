/* ─── seed-demo-ebay.ts ────────────────────────────────────
 *  Standalone script that creates a demo eBay sandbox
 *  connection + store in the database.
 *
 *  Usage:
 *    cd backend
 *    npx ts-node -r tsconfig-paths/register src/scripts/seed-demo-ebay.ts
 * ────────────────────────────────────────────────────────── */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'listingpro',
});

async function main() {
  await ds.initialize();
  console.log('✓ Connected to database');

  const qr = ds.createQueryRunner();

  // Ensure tables exist (they should from migrations/sync)
  const tableCheck = await qr.query(
    `SELECT to_regclass('public.channel_connections') AS cc, to_regclass('public.stores') AS st`,
  );
  if (!tableCheck[0]?.cc) {
    console.error('✗ channel_connections table not found — run migrations first');
    process.exit(1);
  }

  // Check for existing eBay demo connection
  const existing = await qr.query(
    `SELECT id FROM channel_connections WHERE channel = 'ebay' AND account_name = 'eBay Sandbox Demo' LIMIT 1`,
  );

  let connectionId: string;

  if (existing.length > 0) {
    connectionId = existing[0].id;
    console.log(`✓ Existing eBay demo connection: ${connectionId}`);
  } else {
    // Create a demo connection with placeholder encrypted tokens
    const demoTokens = JSON.stringify({
      accessToken: 'DEMO_SANDBOX_TOKEN_' + Date.now(),
      refreshToken: 'DEMO_SANDBOX_REFRESH_' + Date.now(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account',
      tokenType: 'User Access Token',
    });

    // Simple encryption compatible with TokenEncryptionService dev fallback
    const key = crypto.scryptSync('dev-insecure-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(demoTokens, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encryptedTokens = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

    // Use a fixed UUID so the seed is idempotent
    const userId = '00000000-0000-0000-0000-000000000001';

    const result = await qr.query(
      `INSERT INTO channel_connections (channel, user_id, account_name, external_account_id, encrypted_tokens, token_expires_at, scope, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        'ebay',
        userId,
        'eBay Sandbox Demo',
        process.env.EBAY_CLIENT_ID ?? 'IrtizaHa-listingp-SBX-e6e5fa804-178dade4',
        encryptedTokens,
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'active',
      ],
    );
    connectionId = result[0].id;
    console.log(`✓ Created eBay demo connection: ${connectionId}`);
  }

  // Create demo store if not exists
  const existingStore = await qr.query(
    `SELECT id FROM stores WHERE connection_id = $1 AND store_name = 'MHN eBay Sandbox Store' LIMIT 1`,
    [connectionId],
  );

  if (existingStore.length > 0) {
    console.log(`✓ Existing demo store: ${existingStore[0].id}`);
  } else {
    const storeResult = await qr.query(
      `INSERT INTO stores (connection_id, channel, store_name, store_url, external_store_id, is_primary, config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        connectionId,
        'ebay',
        'MHN eBay Sandbox Store',
        'https://sandbox.ebay.com',
        process.env.EBAY_CLIENT_ID ?? 'IrtizaHa-listingp-SBX-e6e5fa804-178dade4',
        true,
        JSON.stringify({
          marketplace: 'EBAY_MOTORS_US',
          sandbox: true,
          clientId: process.env.EBAY_CLIENT_ID,
          devId: process.env.EBAY_DEV_ID,
        }),
        'active',
      ],
    );
    console.log(`✓ Created demo store: ${storeResult[0].id}`);
  }

  // Log the demo simulation entry
  if (tableCheck[0]?.st) {
    await qr.query(
      `INSERT INTO demo_simulation_logs (operation_type, channel, notes, request_payload, response_payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'auth_simulated',
        'ebay',
        'Demo eBay sandbox store seeded via script',
        JSON.stringify({
          clientId: process.env.EBAY_CLIENT_ID,
          devId: process.env.EBAY_DEV_ID,
          sandbox: true,
        }),
        JSON.stringify({ connectionId, status: 'active' }),
      ],
    ).catch(() => { /* table may not exist yet */ });
  }

  console.log('\n🎉 Demo eBay sandbox store is ready!');
  console.log('   Connection ID:', connectionId);
  console.log('   Client ID:', process.env.EBAY_CLIENT_ID);
  console.log('   Sandbox: true');
  console.log('   Demo Mode: true (no real API calls)');

  await ds.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
