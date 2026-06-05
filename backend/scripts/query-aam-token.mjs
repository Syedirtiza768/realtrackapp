import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const c = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
await c.connect();
const r = await c.query(`
  SELECT cea.sellerpundit_account_name, cea.connection_source, cea.environment,
         eot.granted_scopes, eot.access_token_expires_at, eot.reconnect_required,
         eot.last_refreshed_at
  FROM connected_ebay_accounts cea
  LEFT JOIN ebay_oauth_tokens eot ON eot.ebay_account_id = cea.id
  WHERE cea.sellerpundit_account_name = 'All About Mercedes'
`);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
