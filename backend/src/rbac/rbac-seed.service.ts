import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { Organization } from '../auth/entities/organization.entity.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { ROLE_SLUGS } from './permission-registry.js';
import { RbacService } from './rbac.service.js';

const SALT_ROUNDS = 12;

@Injectable()
export class RbacSeedService {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    private readonly rbac: RbacService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Idempotent demo/default users for dev and initial setup.
   * Controlled by SEED_DEMO_USERS (default true outside production).
   */
  async seedDemoUsers(): Promise<void> {
    const enabled = this.shouldSeedDemoUsers();
    if (!enabled) {
      this.logger.log(
        'Demo user seeding skipped (SEED_DEMO_USERS=false or production)',
      );
      return;
    }

    await this.rbac.syncFromRegistry();

    const users: {
      slug:
        | typeof ROLE_SLUGS.SUPER_ADMIN
        | typeof ROLE_SLUGS.ADMIN
        | typeof ROLE_SLUGS.MANAGER
        | typeof ROLE_SLUGS.STAFF
        | typeof ROLE_SLUGS.VIEWER;
      legacyRole: User['role'];
      emailEnv: string;
      passwordEnv: string;
      nameEnv: string;
      defaultEmail: string;
      defaultName: string;
    }[] = [
      {
        slug: ROLE_SLUGS.SUPER_ADMIN,
        legacyRole: 'super_admin',
        emailEnv: 'DEFAULT_SUPER_ADMIN_EMAIL',
        passwordEnv: 'DEFAULT_SUPER_ADMIN_PASSWORD',
        nameEnv: 'DEFAULT_SUPER_ADMIN_NAME',
        defaultEmail: 'superadmin@realtrack.local',
        defaultName: 'Super Admin',
      },
      {
        slug: ROLE_SLUGS.ADMIN,
        legacyRole: 'admin',
        emailEnv: 'DEFAULT_ADMIN_EMAIL',
        passwordEnv: 'DEFAULT_ADMIN_PASSWORD',
        nameEnv: 'DEFAULT_ADMIN_NAME',
        defaultEmail: 'admin@realtrack.local',
        defaultName: 'Admin User',
      },
      {
        slug: ROLE_SLUGS.MANAGER,
        legacyRole: 'manager',
        emailEnv: 'DEFAULT_MANAGER_EMAIL',
        passwordEnv: 'DEFAULT_MANAGER_PASSWORD',
        nameEnv: 'DEFAULT_MANAGER_NAME',
        defaultEmail: 'manager@realtrack.local',
        defaultName: 'Manager User',
      },
      {
        slug: ROLE_SLUGS.STAFF,
        legacyRole: 'user',
        emailEnv: 'DEFAULT_STAFF_EMAIL',
        passwordEnv: 'DEFAULT_STAFF_PASSWORD',
        nameEnv: 'DEFAULT_STAFF_NAME',
        defaultEmail: 'staff@realtrack.local',
        defaultName: 'Staff User',
      },
      {
        slug: ROLE_SLUGS.VIEWER,
        legacyRole: 'viewer',
        emailEnv: 'DEFAULT_VIEWER_EMAIL',
        passwordEnv: 'DEFAULT_VIEWER_PASSWORD',
        nameEnv: 'DEFAULT_VIEWER_NAME',
        defaultEmail: 'viewer@realtrack.local',
        defaultName: 'Viewer User',
      },
    ];

    for (const spec of users) {
      const email = (
        this.config.get<string>(spec.emailEnv) ?? spec.defaultEmail
      ).toLowerCase();
      const password = this.config.get<string>(spec.passwordEnv);
      if (!password) {
        this.logger.warn(
          `Skipping seed for ${spec.slug}: set ${spec.passwordEnv} in environment`,
        );
        continue;
      }
      const name = this.config.get<string>(spec.nameEnv) ?? spec.defaultName;

      let user = await this.userRepo.findOne({ where: { email } });
      const storeAccessAll =
        spec.slug === ROLE_SLUGS.SUPER_ADMIN || spec.slug === ROLE_SLUGS.ADMIN;
      if (!user) {
        user = await this.userRepo.save(
          this.userRepo.create({
            email,
            name,
            passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
            role: spec.legacyRole,
            active: true,
            storeAccessAll,
          }),
        );
        this.logger.log(`Created seed user ${email} (${spec.slug})`);
      } else {
        user.role = spec.legacyRole;
        user.active = true;
        if (storeAccessAll) user.storeAccessAll = true;
        await this.userRepo.save(user);
      }

      await this.rbac.assignPrimaryRole(user.id, spec.slug);
      await this.ensureDefaultWorkspace(user.id, name, email);
    }
  }

  private async ensureDefaultWorkspace(
    userId: string,
    name: string,
    email: string,
  ): Promise<void> {
    const existing = await this.memberRepo.findOne({ where: { userId } });
    if (existing) return;

    const label = name?.trim() || email.split('@')[0] || 'My workspace';
    const org = await this.orgRepo.save(
      this.orgRepo.create({
        name: label,
        slug: `ws-${crypto.randomBytes(8).toString('hex')}`,
        plan: 'free',
        status: 'active',
      }),
    );
    await this.memberRepo.save(
      this.memberRepo.create({
        organizationId: org.id,
        userId,
        role: 'owner',
      }),
    );
  }

  private shouldSeedDemoUsers(): boolean {
    const explicit = this.config.get<string>('SEED_DEMO_USERS');
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return this.config.get<string>('NODE_ENV', 'development') !== 'production';
  }
}
