import { Building2, Car, ChevronDown, Factory, LogOut, Shirt } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const WORKSPACES = [
  { path: '/auto-parts', label: 'Auto Parts', permission: 'dashboard.view', icon: Car },
  { path: '/business-industrial', label: 'Business & Industrial', permission: 'business_industrial.access', icon: Factory },
  { path: '/fashion', label: 'Fashion', permission: 'fashion.access', icon: Shirt },
] as const;

export default function WorkspaceSwitcher() {
  const { permissions, organizations, activeOrganizationId, selectOrganization, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const available = WORKSPACES.filter((workspace) =>
    permissions.includes(workspace.permission),
  );

  async function useAnotherAccount() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
        <Building2 size={15} />
        Switch workspace
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        {organizations.length > 1 && <label className="block px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Organization
          <select
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            value={activeOrganizationId ?? ''}
            onChange={(event) => selectOrganization(event.target.value)}
          >
            {organizations.map((organization) => (
              <option key={organization.organizationId} value={organization.organizationId}>
                {organization.name} ({organization.role})
              </option>
            ))}
          </select>
        </label>}
        {available.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-xs ${active ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}
            >
              <Icon size={14} /> {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => void useAnotherAccount()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <LogOut size={14} /> Sign out and use another account
        </button>
      </div>
    </details>
  );
}
