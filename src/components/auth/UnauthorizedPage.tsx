import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
      <ShieldAlert className="h-12 w-12 text-amber-400 mb-4" />
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Access denied</h1>
      <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md text-sm">
        You do not have permission to view this page. Contact your administrator if
        you believe this is an error.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
