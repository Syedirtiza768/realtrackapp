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

export async function createRbacUser(
  payload: CreateUserPayload,
): Promise<{ ok: true; profile: unknown } | { error: string }> {
  const res = await fetchWithAuth<unknown>('/api/rbac/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res && typeof res === 'object' && 'error' in res && (res as { error: string }).error) {
    return { error: (res as { error: string }).error };
  }
  return { ok: true, profile: res };
}

export async function assignUserRole(
  userId: string,
  roleSlug: string,
): Promise<{ ok: true; profile: unknown } | { error: string }> {
  const res = await fetchWithAuth<unknown>(`/api/rbac/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ roleSlug }),
  });
  if (res && typeof res === 'object' && 'error' in res && (res as { error: string }).error) {
    return { error: (res as { error: string }).error };
  }
  return { ok: true, profile: res };
}

export async function deactivateUser(
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const res = await fetchWithAuth<unknown>(`/api/rbac/users/${userId}/deactivate`, {
    method: 'PATCH',
  });
  if (res && typeof res === 'object' && 'error' in res && (res as { error: string }).error) {
    return { error: (res as { error: string }).error };
  }
  return { ok: true };
}
