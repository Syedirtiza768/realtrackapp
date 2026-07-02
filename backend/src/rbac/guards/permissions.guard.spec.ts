import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard.js';
import type { RbacService } from '../rbac.service.js';
import type { User } from '../../auth/entities/user.entity.js';

/* ── Helpers ── */

function mockContext(options: {
  isPublic?: boolean;
  permissions?: string[];
  mode?: 'all' | 'any';
  user?: User | null;
} = {}): ExecutionContext {
  const request = { user: options.user ?? null };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

/* ── Tests ── */

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let rbac: RbacService;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    rbac = {
      getPermissionKeysForUser: jest.fn().mockResolvedValue(new Set<string>()),
    } as unknown as RbacService;
    guard = new PermissionsGuard(reflector, rbac);
  });

  it('returns true for public routes', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(true) // IS_PUBLIC_KEY
    ;
    const result = await guard.canActivate(mockContext());
    expect(result).toBe(true);
  });

  it('returns true when no permissions required', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(undefined) // PERMISSIONS_KEY
    ;
    const result = await guard.canActivate(mockContext());
    expect(result).toBe(true);
  });

  it('returns true when user has all required permissions', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['listings.view', 'listings.create'])
      .mockReturnValueOnce('all')
    ;
    (rbac.getPermissionKeysForUser as jest.Mock).mockResolvedValue(
      new Set(['listings.view', 'listings.create', 'dashboard.view']),
    );

    const result = await guard.canActivate(mockContext({ user: { id: 'u-1' } as User }));
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user missing required permission (mode=all)', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['listings.publish'])
      .mockReturnValueOnce('all')
    ;
    (rbac.getPermissionKeysForUser as jest.Mock).mockResolvedValue(
      new Set(['listings.view']),
    );

    await expect(
      guard.canActivate(mockContext({ user: { id: 'u-1' } as User })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns true when user has any required permission (mode=any)', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['listings.publish', 'listings.approve'])
      .mockReturnValueOnce('any')
    ;
    (rbac.getPermissionKeysForUser as jest.Mock).mockResolvedValue(
      new Set(['listings.publish']),
    );

    const result = await guard.canActivate(mockContext({ user: { id: 'u-1' } as User }));
    expect(result).toBe(true);
  });

  it('throws when user has none of any required permissions', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['listings.publish', 'listings.approve'])
      .mockReturnValueOnce('any')
    ;
    (rbac.getPermissionKeysForUser as jest.Mock).mockResolvedValue(
      new Set(['listings.view']),
    );

    await expect(
      guard.canActivate(mockContext({ user: { id: 'u-1' } as User })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no user on request', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['listings.view'])
      .mockReturnValueOnce('all')
    ;

    await expect(
      guard.canActivate(mockContext({ user: null })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('works with single permission', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['dashboard.view'])
      .mockReturnValueOnce('all')
    ;
    (rbac.getPermissionKeysForUser as jest.Mock).mockResolvedValue(
      new Set(['dashboard.view']),
    );

    const result = await guard.canActivate(mockContext({ user: { id: 'u-1' } as User }));
    expect(result).toBe(true);
  });

  it('defaults to mode=all when mode not specified', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['a', 'b'])
      .mockReturnValueOnce(undefined)
    ;
    (rbac.getPermissionKeysForUser as jest.Mock).mockResolvedValue(
      new Set(['a']), // only has 'a', missing 'b'
    );

    await expect(
      guard.canActivate(mockContext({ user: { id: 'u-1' } as User })),
    ).rejects.toThrow(ForbiddenException);
  });
});
