#!/usr/bin/env node
/**
 * Fix script: Assign super_admin RBAC role to the existing super admin user.
 * Run: node scripts/fix-super-admin-rbac.js
 */
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
  console.log('Database connected');

  // Find super admin user
  const users = await ds.query(
    `SELECT id, email, role FROM users WHERE role = 'super_admin' OR email LIKE '%superadmin%' LIMIT 5`
  );

  if (users.length === 0) {
    console.log('No super admin user found');
    process.exit(1);
  }

  console.log('Found users:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));

  // Get super_admin role id
  const roles = await ds.query(`SELECT id, slug FROM roles WHERE slug = 'super_admin'`);
  if (roles.length === 0) {
    console.log('super_admin role not found in RBAC - running sync first');
    process.exit(1);
  }
  const superAdminRoleId = roles[0].id;
  console.log('super_admin role ID:', superAdminRoleId);

  // Assign role to each super admin user
  for (const user of users) {
    const existing = await ds.query(
      `SELECT id FROM "user_roles" WHERE "userId" = $1 AND "roleId" = $2`,
      [user.id, superAdminRoleId]
    );

    if (existing.length > 0) {
      console.log(`User ${user.email} already has super_admin role assigned`);
      continue;
    }

    await ds.query(
      `INSERT INTO "user_roles" ("userId", "roleId", "isPrimary", "createdAt")
       VALUES ($1, $2, true, NOW())`,
      [user.id, superAdminRoleId]
    );
    console.log(`Assigned super_admin role to ${user.email}`);
  }

  await ds.destroy();
  console.log('Done!');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
