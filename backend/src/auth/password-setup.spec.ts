import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAuditService } from './auth-audit.service';
import { UserOrganizationService } from './user-organization.service';
import { User } from './entities/user.entity';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RbacService } from '../rbac/rbac.service';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

@Controller('password-test')
class ProtectedController {
  @Get('ordinary')
  ordinary() { return { ok: true }; }

  @Get('fashion')
  @RequirePermissions('fashion.access')
  fashion() { return { ok: true }; }
}

describe('First-login password setup HTTP flow', () => {
  let app: INestApplication;
  let user: User;
  let token: string;
  let oldHash: string;
  const currentPassword = 'temporary-test-password';
  const newPassword = 'replacement-test-password';
  const update = jest.fn();
  const audit = jest.fn().mockResolvedValue(undefined);
  const repo = {
    findOne: jest.fn(({ where }: { where: Partial<User> }) => {
      if ((where.id && where.id !== user.id) || (where.email && where.email !== user.email) ||
          (where.active !== undefined && where.active !== user.active)) return Promise.resolve(null);
      return Promise.resolve({ ...user });
    }),
    update,
  };

  beforeAll(async () => {
    oldHash = await bcrypt.hash(currentPassword, 4);
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: 'password-setup-test-signing-key' })],
      controllers: [AuthController, ProtectedController],
      providers: [
        AuthService, JwtStrategy,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'JWT_SECRET' ? 'password-setup-test-signing-key' : 'false' } },
        { provide: UserOrganizationService, useValue: { listForUser: jest.fn().mockResolvedValue([{ organizationId: 'org' }]) } },
        { provide: AuthAuditService, useValue: { log: audit } },
        { provide: RbacService, useValue: {
          getAuthProfile: jest.fn((value: User) => ({ id: value.id, email: value.email })),
          userHasPermission: jest.fn().mockResolvedValue(true),
          getPermissionKeysForUser: jest.fn().mockResolvedValue(new Set(['fashion.access'])),
        } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    token = module.get(JwtService).sign({ sub: 'test-user' });
  });

  beforeEach(() => {
    user = Object.assign(new User(), { id: 'test-user', email: 'fashion@example.test', role: 'user', active: true, passwordHash: oldHash, passwordChangeRequired: true });
    jest.clearAllMocks();
    update.mockImplementation((where: string | Partial<User>, changes: Partial<User>) => {
      if (typeof where !== 'string' && where.passwordHash && where.passwordHash !== user.passwordHash) return Promise.resolve({ affected: 0 });
      Object.assign(user, changes);
      return Promise.resolve({ affected: 1 });
    });
  });

  afterAll(async () => { await app?.close(); });

  it('allows login and /me with the flag, without exposing the hash', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: user.email, password: currentPassword, vertical: 'fashion' }).expect(201);
    expect(login.body.user.passwordChangeRequired).toBe(true);
    expect(login.body.user.passwordHash).toBeUndefined();
    const me = await request(app.getHttpServer()).get('/api/auth/me').auth(token, { type: 'bearer' }).expect(200);
    expect(me.body.user.passwordChangeRequired).toBe(true);
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it.each(['/api/password-test/ordinary', '/api/password-test/fashion', '/api/auth/organizations'])('blocks %s even with a valid JWT', async (path) => {
    const response = await request(app.getHttpServer()).get(path).auth(token, { type: 'bearer' }).expect(403);
    expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('requires authentication even on the setup endpoint', async () => {
    await request(app.getHttpServer()).patch('/api/auth/change-password').send({ currentPassword, newPassword }).expect(401);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an incorrect current password without clearing the flag', async () => {
    await request(app.getHttpServer()).patch('/api/auth/change-password').auth(token, { type: 'bearer' }).send({ currentPassword: 'incorrect', newPassword }).expect(400);
    expect(user.passwordHash).toBe(oldHash);
    expect(user.passwordChangeRequired).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(['short', 'a'.repeat(73), '😀'.repeat(19), currentPassword])('rejects an invalid or reused new password (%#)', async (candidate) => {
    await request(app.getHttpServer()).patch('/api/auth/change-password').auth(token, { type: 'bearer' }).send({ currentPassword, newPassword: candidate }).expect(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects extra fields so callers cannot target another account', async () => {
    await request(app.getHttpServer()).patch('/api/auth/change-password').auth(token, { type: 'bearer' }).send({ currentPassword, newPassword, userId: 'another-user' }).expect(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('atomically changes the hash and flag, then permits the same JWT on the next request', async () => {
    await request(app.getHttpServer()).patch('/api/auth/change-password').auth(token, { type: 'bearer' }).send({ currentPassword, newPassword }).expect(200, { ok: true });
    expect(user.passwordChangeRequired).toBe(false);
    expect(await bcrypt.compare(newPassword, user.passwordHash)).toBe(true);
    expect(await bcrypt.compare(currentPassword, user.passwordHash)).toBe(false);
    expect(update).toHaveBeenCalledWith({ id: user.id, active: true, passwordHash: oldHash }, { passwordHash: user.passwordHash, passwordChangeRequired: false });
    await request(app.getHttpServer()).get('/api/password-test/fashion').auth(token, { type: 'bearer' }).expect(200);
    expect(audit).toHaveBeenCalledWith('auth.password_changed', expect.objectContaining({ actorId: user.id }));
    expect(audit.mock.calls[0][1].metadata).toBeUndefined();
  });

  it('does not force unflagged non-Fashion accounts to change passwords', async () => {
    user.passwordChangeRequired = false;
    user.email = 'motors@example.test';
    await request(app.getHttpServer()).get('/api/password-test/ordinary').auth(token, { type: 'bearer' }).expect(200);
  });

  it('rejects inactive users with a previously issued JWT', async () => {
    user.active = false;
    await request(app.getHttpServer()).patch('/api/auth/change-password').auth(token, { type: 'bearer' }).send({ currentPassword, newPassword }).expect(401);
    expect(update).not.toHaveBeenCalled();
  });

  it('reports a concurrent password change without clearing the flag', async () => {
    update.mockResolvedValueOnce({ affected: 0 });
    await request(app.getHttpServer()).patch('/api/auth/change-password').auth(token, { type: 'bearer' }).send({ currentPassword, newPassword }).expect(409);
    expect(user.passwordChangeRequired).toBe(true);
    expect(user.passwordHash).toBe(oldHash);
  });
});
