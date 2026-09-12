import { LogOut, Shirt } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import WorkspaceSwitcher from '../auth/WorkspaceSwitcher';

export default function FashionShell({ children }: { children: React.ReactNode }) {
  const { logout, permissions, user } = useAuth();
  const navigate = useNavigate();
  const links = [
    ['/fashion', 'Overview', 'fashion.dashboard.view'],
    ['/fashion/catalog', 'Catalog', 'fashion.listings.view'],
    ['/fashion/import', 'Bulk import', 'fashion.import'],
    ['/fashion/review', 'Authenticity review', 'fashion.review'],
    ['/fashion/stores', 'Stores', 'fashion.stores.view'],
    ['/fashion/incidents', 'Incidents', 'fashion.incidents.manage'],
    ['/fashion/users', 'Users', 'fashion.users.manage'],
    ['/fashion/settings', 'Settings', 'fashion.settings.manage'],
  ].filter(([, , permission]) => permissions.includes(permission));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-pink-500 p-2 text-white"><Shirt size={20} /></div><div><p className="font-semibold">Omni Core Fashion</p><p className="text-xs text-slate-500">{user?.name || user?.email}</p></div></div>
          <div className="flex items-center gap-3"><WorkspaceSwitcher /><button className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={async () => { await logout(); navigate('/fashion/login', { replace: true }); }}><LogOut size={16} /> Sign out</button></div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 md:flex-row">
        <nav aria-label="Fashion navigation" className="flex gap-2 overflow-x-auto md:w-52 md:shrink-0 md:flex-col">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/fashion'} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-pink-500 font-semibold text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{label}</NavLink>)}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
