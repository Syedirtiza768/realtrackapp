import { Factory, LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import WorkspaceSwitcher from '../auth/WorkspaceSwitcher';

export default function BusinessIndustrialShell({ children }: { children: React.ReactNode }) {
  const { logout, permissions, user, organizations, activeOrganizationId, selectOrganization } = useAuth();
  const navigate = useNavigate();
  const links = [
    ['/business-industrial', 'Overview', 'business_industrial.dashboard.view'],
    ['/business-industrial/catalog', 'Catalog', 'business_industrial.listings.view'],
    ['/business-industrial/image-intake', 'AI image intake', 'business_industrial.import'],
    ['/business-industrial/import', 'Bulk import', 'business_industrial.import'],
    ['/business-industrial/review', 'Compliance review', 'business_industrial.review'],
    ['/business-industrial/stores', 'Stores', 'business_industrial.stores.view'],
    ['/business-industrial/incidents', 'Incidents', 'business_industrial.incidents.view'],
    ['/business-industrial/users', 'Users', 'business_industrial.users.manage'],
  ].filter(([, , permission]) => permissions.includes(permission));

  useEffect(() => {
    localStorage.setItem('mk_preferred_vertical', 'business_industrial');
    const biOrgs = organizations.filter((item) => item.slug.startsWith('business-industrial-'));
    if (!biOrgs.length) return;
    const preferred = biOrgs.find((item) => item.role === 'owner') ?? biOrgs[0];
    if (preferred && activeOrganizationId !== preferred.organizationId) {
      selectOrganization(preferred.organizationId);
    }
  }, [organizations, activeOrganizationId, selectOrganization]);

  return <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-600 p-2 text-white"><Factory size={20} /></div><div><p className="font-semibold">Omni Core Business &amp; Industrial</p><p className="text-xs text-slate-500">{user?.name || user?.email}</p></div></div><div className="flex items-center gap-3"><WorkspaceSwitcher /><button className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={async () => { await logout(); navigate('/business-industrial/login', { replace: true }); }}><LogOut size={16} /> Sign out</button></div></div></header>
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 md:flex-row"><nav className="flex gap-2 overflow-x-auto md:w-56 md:flex-col">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/business-industrial'} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-cyan-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{label}</NavLink>)}</nav><main className="min-w-0 flex-1">{children}</main></div>
  </div>;
}
