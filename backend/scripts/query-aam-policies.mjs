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
  SELECT ebp.marketplace_id, ebp.policy_type, ebp.ebay_policy_id, ebp.name, ebp.is_default,
         ebp.raw_payload
  FROM ebay_business_policies ebp
  JOIN connected_ebay_accounts cea ON cea.id = ebp.ebay_account_id
  WHERE cea.sellerpundit_account_name = 'All About Mercedes'
    AND ebp.policy_type = 'return'
  ORDER BY ebp.marketplace_id, ebp.ebay_policy_id
`);
for (const row of r.rows) {
  const raw = row.raw_payload ?? {};
  const d = raw.policy_details ?? raw.policyDetails ?? raw;
  console.log({
    marketplace_id: row.marketplace_id,
    ebay_policy_id: row.ebay_policy_id,
    name: row.name,
    is_default: row.is_default,
    geoSite: raw.geoSite ?? d.geoSite,
    days: d.returnPeriod?.value ?? raw.returnPeriod?.value,
    payer: d.returnShippingCostPayer ?? raw.returnShippingCostPayer ?? d.ShippingCostPaidByOption,
  });
}
const mp = await c.query(`
  SELECT marketplace_id, default_return_policy_id
  FROM ebay_account_marketplaces eam
  JOIN connected_ebay_accounts cea ON cea.id = eam.ebay_account_id
  WHERE cea.sellerpundit_account_name = 'All About Mercedes'
`);
console.log('defaults', mp.rows);
await c.end();
