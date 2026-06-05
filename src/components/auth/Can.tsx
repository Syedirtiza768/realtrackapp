import type { ReactNode } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

type CanProps = {
  permission?: string;
  any?: string[];
  all?: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

/** Renders children only when the user has the required permission(s). */
export default function Can({ permission, any, all, children, fallback = null }: CanProps) {
  const { has, hasAny, hasAll } = usePermissions();

  let allowed = true;
  if (permission) allowed = has(permission);
  else if (any?.length) allowed = hasAny(any);
  else if (all?.length) allowed = hasAll(all);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
