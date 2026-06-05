/**
 * Standalone RBAC seed script.
 * Usage: cd backend && npx ts-node -r tsconfig-paths/register src/scripts/seed-rbac.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RbacSeedService } from '../rbac/rbac-seed.service';
import { RbacService } from '../rbac/rbac.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const rbac = app.get(RbacService);
    const seed = app.get(RbacSeedService);
    await rbac.syncFromRegistry();
    await rbac.syncLegacyUserRoles();
    await seed.seedDemoUsers();
    console.log('RBAC seed completed');
  } finally {
    await app.close();
  }
}

void main();
