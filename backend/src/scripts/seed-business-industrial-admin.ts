import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { User } from '../auth/entities/user.entity.js';
import { Organization } from '../auth/entities/organization.entity.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { ROLE_SLUGS } from '../rbac/permission-registry.js';

const SALT_ROUNDS = 12;

/** Idempotently provisions the first Business & Industrial administrator. */
async function main(): Promise<void> {
  const email = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD;
  const name = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_NAME?.trim() || 'Business & Industrial Admin';
  const organizationName = process.env.BUSINESS_INDUSTRIAL_SEED_ADMIN_ORGANIZATION_NAME?.trim() || 'Business & Industrial workspace';
  if (!email || !password) throw new Error('BUSINESS_INDUSTRIAL_SEED_ADMIN_EMAIL and BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD are required');
  if (password.length < 12) throw new Error('BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD must be at least 12 characters');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const organizations = app.get<Repository<Organization>>(getRepositoryToken(Organization));
    const members = app.get<Repository<OrganizationMember>>(getRepositoryToken(OrganizationMember));
    const rbac = app.get(RbacService);
    await rbac.syncFromRegistry();

    let user = await users.findOne({ where: { email }, select: ['id', 'email', 'passwordHash', 'name', 'role', 'active', 'storeAccessAll'] });
    const createdUser = !user;
    if (!user) {
      user = await users.save(users.create({ email, passwordHash: await bcrypt.hash(password, SALT_ROUNDS), name, role: 'user', active: true, storeAccessAll: false }));
      await rbac.assignPrimaryRole(user.id, ROLE_SLUGS.BUSINESS_INDUSTRIAL_ADMIN);
    } else if (!(await rbac.userHasPermission(user.id, 'business_industrial.access'))) {
      throw new Error('Existing user has no Business & Industrial role; assign one explicitly before rerunning this seed');
    }

    let membership = await members.findOne({ where: { userId: user.id }, order: { createdAt: 'ASC' } });
    if (!membership) {
      const slug = `business-industrial-${email.split('@')[0].replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'workspace'}`;
      let organization = await organizations.findOne({ where: { slug } });
      if (!organization) organization = await organizations.save(organizations.create({ name: organizationName, slug, plan: 'free', status: 'active' }));
      membership = await members.save(members.create({ organizationId: organization.id, userId: user.id, role: 'owner' }));
    }
    console.log(`${createdUser ? 'Created' : 'Verified'} Business & Industrial admin ${email} in organization ${membership.organizationId}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
