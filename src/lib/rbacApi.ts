import { fetchWithAuth } from './authApi';

export type RbacPermission = {
  id: string;
  key: string;
  label: string;
  module: string;
  description: string | null;
};

export type RbacRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
};

export type RbacUser = {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  profile?: {
    roleSlug?: string | null;
    roleName?: string | null;
  };
};

export type CreateUserPayload = {
  email: string;
  password: string;
  name?: string;
  roleSlug: string;
};

export async function listRbacUsers(): Promise<RbacUser[]> {
  return fetchWithAuth<RbacUser[]>('/api/rbac/users');
}

export async function listRbacRoles(): Promise<RbacRole[]> {
  return fetchWithAuth<RbacRole[]>('/api/rbac/roles');
}

export async function listRbacPermissions(): Promise<RbacPermission[]> {
  return fetchWithAuth<RbacPermission[]>('/api/rbac/permissions');
}

async function rbacMutation<T>(
  run: () => Promise<T>,
): Promise<{ ok: true; profile: T } | { error: string }> {
  try {
    const res = await run();
    if (res && typeof res === 'object' && 'error' in res && (res as { error: string }).error) {
      return { error: (res as { error: string }).error };
    }
    return { ok: true, profile: res };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function createRbacUser(
  payload: CreateUserPayload,
): Promise<{ ok: true; profile: unknown } | { error: string }> {
  return rbacMutation(() =>
    fetchWithAuth<unknown>('/api/rbac/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  );
}

export async function assignUserRole(
  userId: string,
  roleSlug: string,
): Promise<{ ok: true; profile: unknown } | { error: string }> {
  return rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ roleSlug }),
    }),
  );
}

export async function deactivateUser(
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/users/${userId}/deactivate`, {
      method: 'PATCH',
    }),
  );
  if ('error' in result) return result;
  return { ok: true };
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>('/api/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
  if ('error' in result) return result;
  return { ok: true };
}

export async function adminResetPassword(
  userId: string,
  newPassword: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/users/${userId}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    }),
  );
  if ('error' in result) return result;
  return { ok: true };
}
