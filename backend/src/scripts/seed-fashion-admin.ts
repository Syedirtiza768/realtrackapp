import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { Organization } from '../auth/entities/organization.entity.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { ROLE_SLUGS } from '../rbac/permission-registry.js';
import { UserRoleAssignment } from '../rbac/entities/user-role-assignment.entity.js';

const SALT_ROUNDS = 12;

export async function provisionFashionAdminUser(
  users: Repository<User>,
  assignments: Repository<UserRoleAssignment>,
  rbac: RbacService,
  options: { email: string; password?: string; name: string; requirePasswordChange: boolean },
): Promise<{ user: User; createdUser: boolean }> {
  const user = await users.findOne({ where: { email: options.email } });
  if (user) {
    const roles = await assignments.find({ where: { userId: user.id }, relations: ['role'] });
    // Explicit role verification avoids legacy/super-admin permission fallback.
    if (!user.active || user.role !== 'user' ||
        !roles.some((assignment) => assignment.role?.slug === ROLE_SLUGS.FASHION_ADMIN) ||
        roles.some((assignment) => !assignment.role?.slug.startsWith('fashion_'))) {
      throw new Error('Existing account must be an active, exclusively Fashion administrator; seed made no account changes');
    }
    if (options.requirePasswordChange && !user.passwordChangeRequired) {
      await users.update({ id: user.id, active: true }, { passwordChangeRequired: true });
      user.passwordChangeRequired = true;
    }
    return { user, createdUser: false };
  }
  const password = options.password;
  if (!password || Array.from(password).length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('New admin requires FASHION_SEED_ADMIN_PASSWORD: at least 12 characters, at most 72 UTF-8 bytes');
  }
  const saved = await users.save(users.create({
    email: options.email,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    name: options.name,
    role: 'user',
    active: true,
    storeAccessAll: true,
    passwordChangeRequired: true,
  }));
  await rbac.assignPrimaryRole(saved.id, ROLE_SLUGS.FASHION_ADMIN);
  return { user: saved, createdUser: true };
}

/**
 * Idempotently provisions the first Fashion administrator.
 * Existing passwords and non-Fashion roles are never overwritten.
 */
async function main(): Promise<void> {
  const email = process.env.FASHION_SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.FASHION_SEED_ADMIN_PASSWORD;
  const name = process.env.FASHION_SEED_ADMIN_NAME?.trim() || 'Fashion Admin';
  const organizationName = process.env.FASHION_SEED_ADMIN_ORGANIZATION_NAME?.trim() || 'Fashion workspace';
  if (!email) throw new Error('FASHION_SEED_ADMIN_EMAIL is required');
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--require-password-change')) throw new Error('Unknown seed option');
  const requirePasswordChange = args.includes('--require-password-change');

  const { AppModule } = await import('../app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const organizations = app.get<Repository<Organization>>(getRepositoryToken(Organization));
    const members = app.get<Repository<OrganizationMember>>(getRepositoryToken(OrganizationMember));
    const rbac = app.get(RbacService);
    await rbac.syncFromRegistry();

    const assignments = app.get<Repository<UserRoleAssignment>>(getRepositoryToken(UserRoleAssignment));
    const { user, createdUser } = await provisionFashionAdminUser(users, assignments, rbac, {
      email, password, name, requirePasswordChange,
    });

    let membership = await members.findOne({ where: { userId: user.id }, order: { createdAt: 'ASC' } });
    if (!membership) {
      const slug = `fashion-${email.split('@')[0].replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workspace'}`;
      let organization = await organizations.findOne({ where: { slug } });
      if (!organization) organization = await organizations.save(organizations.create({ name: organizationName, slug, plan: 'free', status: 'active' }));
      membership = await members.save(members.create({ organizationId: organization.id, userId: user.id, role: 'owner' }));
    }

    console.log(`${createdUser ? 'Created' : 'Verified'} Fashion admin ${email} in organization ${membership.organizationId}`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch(() => {
    // Database errors can contain query parameters; never print raw errors here.
    console.error('Fashion admin seed failed. Verify configuration, migration and account role requirements.');
    process.exitCode = 1;
  });
}
