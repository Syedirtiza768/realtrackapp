import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserOrganizationService } from './user-organization.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { ROLE_SLUGS } from '../rbac/permission-registry.js';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly userOrgs: UserOrganizationService,
    private readonly rbac: RbacService,
    private readonly config: ConfigService,
  ) {}

  /** Whether unauthenticated clients may call POST /auth/register. */
  isPublicRegistrationEnabled(): boolean {
    const explicit = this.config.get<string>('ALLOW_PUBLIC_REGISTRATION');
    if (explicit !== undefined && explicit !== '') {
      return explicit === 'true' || explicit === '1';
    }
    return this.config.get<string>('NODE_ENV', 'development') !== 'production';
  }

  assertPublicRegistrationAllowed(): void {
    if (!this.isPublicRegistrationEnabled()) {
      throw new ForbiddenException(
        'Public registration is disabled. Contact an administrator for access.',
      );
    }
  }

  async validateAndSign(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: Partial<User> } | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase(), active: true },
      select: ['id', 'email', 'passwordHash', 'name', 'role'],
    });
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    // Update last login
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    this.assertPublicRegistrationAllowed();

    const normalizedEmail = email.toLowerCase();

    const existing = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = this.userRepo.create({
      email: normalizedEmail,
      passwordHash,
      name: name ?? null,
      role: 'user',
    });
    const saved = await this.userRepo.save(user);
    await this.userOrgs.ensureDefaultForUser(saved.id);
    // Self-registered users get read-only Viewer until an admin upgrades the role.
    await this.rbac.assignPrimaryRole(saved.id, ROLE_SLUGS.VIEWER);

    const payload = { sub: saved.id, email: saved.email, role: saved.role };
    const accessToken = this.jwt.sign(payload);

    return {
      accessToken,
      user: {
        id: saved.id,
        email: saved.email,
        name: saved.name,
        role: saved.role,
      },
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId, active: true },
      select: ['id', 'passwordHash'],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.update(userId, { passwordHash });
  }

  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId, active: true },
      select: ['id'],
    });
    if (!user) {
      throw new ConflictException('User not found or inactive');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.update(userId, { passwordHash });
  }
}
