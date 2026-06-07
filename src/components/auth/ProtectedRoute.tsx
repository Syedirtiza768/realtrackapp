import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { hasAllPermissions, hasAnyPermission } from '../../lib/permissions';
import UnauthorizedPage from './UnauthorizedPage';

type ProtectedRouteProps = {
  children: React.ReactNode;
  /** Require authentication only (default). */
  permissions?: string[];
  /** When multiple permissions listed, require any (default) or all. */
  mode?: 'any' | 'all';
};

export default function ProtectedRoute({
  children,
  permissions,
  mode = 'any',
}: ProtectedRouteProps) {
  const { isAuthenticated, initializing, permissions: granted } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (permissions?.length) {
    const allowed =
      mode === 'all'
        ? hasAllPermissions(granted, permissions)
        : hasAnyPermission(granted, permissions);
    if (!allowed) {
      return <UnauthorizedPage />;
    }
  }

  return <>{children}</>;
}
