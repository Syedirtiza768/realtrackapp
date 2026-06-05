/**
 * Permission helpers for frontend UX gating (backend remains authoritative).
 */

export function hasPermission(
  permissions: readonly string[] | undefined,
  key: string,
): boolean {
  if (!permissions?.length) return false;
  return permissions.includes(key);
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  keys: string[],
): boolean {
  if (!permissions?.length || !keys.length) return false;
  return keys.some((k) => permissions.includes(k));
}

export function hasAllPermissions(
  permissions: readonly string[] | undefined,
  keys: string[],
): boolean {
  if (!permissions?.length || !keys.length) return false;
  return keys.every((k) => permissions.includes(k));
}
