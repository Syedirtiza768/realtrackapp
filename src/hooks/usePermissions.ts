import { useMemo } from 'react';
import { useAuth } from '../components/auth/AuthContext';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from '../lib/permissions';

export function usePermissions() {
  const { permissions, user } = useAuth();

  return useMemo(
    () => ({
      permissions,
      roleSlug: user?.roleSlug,
      isSuperAdmin: user?.roleSlug === 'super_admin',
      has: (key: string) => hasPermission(permissions, key),
      hasAny: (keys: string[]) => hasAnyPermission(permissions, keys),
      hasAll: (keys: string[]) => hasAllPermissions(permissions, keys),
    }),
    [permissions, user?.roleSlug],
  );
}
