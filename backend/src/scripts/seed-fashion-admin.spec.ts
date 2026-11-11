import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserRoleAssignment } from '../rbac/entities/user-role-assignment.entity';
import { RbacService } from '../rbac/rbac.service';
import { provisionFashionAdminUser } from './seed-fashion-admin';

describe('Fashion bootstrap user provisioning', () => {
  const users = {
    findOne: jest.fn(),
    create: jest.fn((value: Partial<User>) => value),
    save: jest.fn((value: User) =>
      Promise.resolve({ ...value, id: 'new-user' }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const assignments = { find: jest.fn() };
  const rbac = { assignPrimaryRole: jest.fn().mockResolvedValue(undefined) };
  const options = {
    email: 'configured-admin@example.test',
    name: 'Fashion Admin',
    requirePasswordChange: false,
  };
  const provision = (overrides = {}) =>
    provisionFashionAdminUser(
      users as unknown as Repository<User>,
      assignments as unknown as Repository<UserRoleAssignment>,
      rbac as unknown as RbacService,
      { ...options, ...overrides },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockResolvedValue({
      id: 'existing-user',
      active: true,
      role: 'user',
      passwordHash: 'untouched-hash',
      passwordChangeRequired: false,
    });
    assignments.find.mockResolvedValue([{ role: { slug: 'fashion_admin' } }]);
  });

  it('flags a newly created admin and hashes the supplied password', async () => {
    users.findOne.mockResolvedValue(null);
    const result = await provision({ password: 'temporary-test-password' });
    expect(result.createdUser).toBe(true);
    expect(result.user.passwordChangeRequired).toBe(true);
    expect(
      await bcrypt.compare('temporary-test-password', result.user.passwordHash),
    ).toBe(true);
    expect(rbac.assignPrimaryRole).toHaveBeenCalledWith(
      'new-user',
      'fashion_admin',
    );
  });

  it('requires a valid password only for new accounts', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(provision()).rejects.toThrow('New admin requires');
    expect(users.save).not.toHaveBeenCalled();
  });

  it('reruns without a password and never resets credentials or reflags completed setup', async () => {
    const result = await provision();
    expect(result.user.passwordHash).toBe('untouched-hash');
    expect(result.user.passwordChangeRequired).toBe(false);
    expect(users.update).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
    expect(rbac.assignPrimaryRole).not.toHaveBeenCalled();
  });

  it('explicitly flags only the configured verified existing admin, ignoring supplied passwords', async () => {
    const result = await provision({
      requirePasswordChange: true,
      password: 'ignored-password',
    });
    expect(users.findOne).toHaveBeenCalledWith({
      where: { email: options.email },
    });
    expect(users.update).toHaveBeenCalledWith(
      { id: 'existing-user', active: true },
      { passwordChangeRequired: true },
    );
    expect(result.user.passwordHash).toBe('untouched-hash');
    expect(users.save).not.toHaveBeenCalled();
  });

  it.each([
    ['super_admin'],
    ['business_industrial_admin'],
    ['fashion_lister'],
    ['fashion_admin', 'admin'],
    [],
  ])('refuses incompatible roles (%j)', async (...slugs) => {
    assignments.find.mockResolvedValue(
      slugs.map((slug) => ({ role: { slug } })),
    );
    await expect(provision({ requirePasswordChange: true })).rejects.toThrow(
      'exclusively Fashion',
    );
    expect(users.update).not.toHaveBeenCalled();
  });

  it('refuses inactive accounts', async () => {
    users.findOne.mockResolvedValue({
      id: 'existing-user',
      active: false,
      role: 'user',
    });
    await expect(provision({ requirePasswordChange: true })).rejects.toThrow(
      'active',
    );
    expect(users.update).not.toHaveBeenCalled();
  });
});
