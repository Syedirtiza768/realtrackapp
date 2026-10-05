import { LogOut, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function UnauthorizedAccessPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function useAnotherAccount() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
      <ShieldAlert className="h-12 w-12 text-amber-400 mb-4" />
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Access denied</h1>
      <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md text-sm">
        You do not have permission to view this page. Contact your administrator if
        you believe this is an error.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Back to workspaces
        </Link>
        <button type="button" onClick={() => void useAnotherAccount()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <LogOut size={16} /> Sign out and use another account
        </button>
      </div>
    </div>
  );
}
