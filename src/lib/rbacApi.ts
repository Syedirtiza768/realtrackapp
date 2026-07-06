import { fetchWithAuth } from "./authApi";

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
  isCustomized?: boolean;
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
  return fetchWithAuth<RbacUser[]>("/api/rbac/users");
}

export async function listRbacRoles(): Promise<RbacRole[]> {
  return fetchWithAuth<RbacRole[]>("/api/rbac/roles");
}

export async function listRbacPermissions(): Promise<RbacPermission[]> {
  return fetchWithAuth<RbacPermission[]>("/api/rbac/permissions");
}

async function rbacMutation<T>(
  run: () => Promise<T>,
): Promise<{ ok: true; profile: T } | { error: string }> {
  try {
    const res = await run();
    if (
      res &&
      typeof res === "object" &&
      "error" in res &&
      (res as { error: string }).error
    ) {
      return { error: (res as { error: string }).error };
    }
    return { ok: true, profile: res };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Request failed" };
  }
}

export async function createRbacUser(
  payload: CreateUserPayload,
): Promise<{ ok: true; profile: unknown } | { error: string }> {
  return rbacMutation(() =>
    fetchWithAuth<unknown>("/api/rbac/users", {
      method: "POST",
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
      method: "PATCH",
      body: JSON.stringify({ roleSlug }),
    }),
  );
}

export async function deactivateUser(
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/users/${userId}/deactivate`, {
      method: "PATCH",
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>("/api/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

export async function adminResetPassword(
  userId: string,
  newPassword: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/users/${userId}/reset-password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword }),
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

/* ── Store-level access ─────────────────────────────────── */

export type StoreBrief = {
  id: string;
  storeName: string;
};

export type StoreAssignment = {
  id: string;
  userId: string;
  storeId: string;
  accessLevel: "view" | "operate" | "admin";
  createdAt: string;
  store?: StoreBrief;
};

export async function listStores(): Promise<StoreBrief[]> {
  return fetchWithAuth<StoreBrief[]>("/api/stores");
}

export async function getUserStoreAssignments(
  userId: string,
): Promise<{ assignments: StoreAssignment[] }> {
  return fetchWithAuth<{ assignments: StoreAssignment[] }>(
    `/api/store-access/users/${userId}`,
  );
}

export async function assignUserToStore(
  userId: string,
  storeId: string,
  accessLevel: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>("/api/store-access/assign", {
      method: "POST",
      body: JSON.stringify({ userId, storeId, accessLevel }),
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

export async function removeUserFromStore(
  userId: string,
  storeId: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/store-access/assign/${userId}/${storeId}`, {
      method: "DELETE",
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

export async function setUserAccessAll(
  userId: string,
  enabled: boolean,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/store-access/access-all/${userId}`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

/* ── Role CRUD ──────────────────────────────────────────── */

export async function createRole(payload: {
  slug: string;
  name: string;
  description?: string;
}): Promise<{ ok: true; profile: unknown } | { error: string }> {
  return rbacMutation(() =>
    fetchWithAuth<unknown>("/api/rbac/roles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateRole(
  id: string,
  payload: { name?: string; description?: string },
): Promise<{ ok: true; profile: unknown } | { error: string }> {
  return rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteRole(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/roles/${id}`, {
      method: "DELETE",
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

export async function setRolePermissions(
  roleId: string,
  permissionKeys: string[],
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/roles/${roleId}/permissions`, {
      method: "POST",
      body: JSON.stringify({ permissionKeys }),
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

export async function resetRoleToDefaults(
  roleId: string,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>(`/api/rbac/roles/${roleId}/reset`, {
      method: "POST",
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

/* ── Sidebar module visibility ──────────────────────────── */

export type SidebarModuleConfig = {
  id: string;
  roleSlug: string;
  moduleKey: string;
  visible: boolean;
};

export async function getSidebarConfigs(): Promise<SidebarModuleConfig[]> {
  return fetchWithAuth<SidebarModuleConfig[]>("/api/rbac/roles/sidebar-config");
}

export async function setSidebarConfigs(
  configs: Array<{ roleSlug: string; moduleKey: string; visible: boolean }>,
): Promise<{ ok: true } | { error: string }> {
  const result = await rbacMutation(() =>
    fetchWithAuth<unknown>("/api/rbac/roles/sidebar-config", {
      method: "PATCH",
      body: JSON.stringify({ configs }),
    }),
  );
  if ("error" in result) return result;
  return { ok: true };
}

export async function getMySidebarConfig(): Promise<{
  visibleModules: string[];
}> {
  return fetchWithAuth<{ visibleModules: string[] }>(
    "/api/rbac/roles/sidebar-config/me",
  );
}
