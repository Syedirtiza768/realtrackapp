#!/usr/bin/env node
const { DataSource } = require('typeorm');

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'realtrack',
  password: process.env.DB_PASSWORD || 'realtrack',
  database: process.env.DB_NAME || 'realtrack',
  entities: [],
  synchronize: false,
});

async function main() {
  await ds.initialize();

  // Check super_admin role permissions
  const perms = await ds.query(`
    SELECT p.key, p.label, p.module
    FROM "role_permissions" rp
    JOIN "roles" r ON r.id = rp."roleId"
    JOIN "permissions" p ON p.id = rp."permissionId"
    WHERE r.slug = 'super_admin'
    ORDER BY p.module, p.key
  `);

  console.log('super_admin permissions:');
  perms.forEach(p => console.log(`  ${p.module}.${p.key}`));
  console.log(`\nTotal: ${perms.length} permissions`);

  // Check catalog permissions specifically
  const catalogPerms = perms.filter(p => p.module === 'catalog');
  console.log('\nCatalog permissions:', catalogPerms.map(p => p.key));

  await ds.destroy();
}

main().catch(console.error);
