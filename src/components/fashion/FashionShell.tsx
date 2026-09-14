import {
  ClipboardCheck,
  LayoutDashboard,
  PackagePlus,
  Settings,
  ShieldAlert,
  Shirt,
  Store,
  Upload,
  Users,
  Warehouse,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import VerticalWorkspaceShell, { type VerticalNavItem } from '../layout/VerticalWorkspaceShell';

const NAV: Array<VerticalNavItem & { permission: string }> = [
  { icon: LayoutDashboard, label: 'Overview', path: '/fashion', end: true, permission: 'fashion.dashboard.view' },
  {
    icon: Warehouse,
    label: 'Catalog',
    path: '/fashion/catalog',
    permission: 'fashion.listings.view',
    isActive: (pathname) => pathname === '/fashion/catalog' || pathname === '/fashion/listings',
  },
  { icon: PackagePlus, label: 'Add Item', path: '/fashion/listings/new', permission: 'fashion.listings.create' },
  { icon: Upload, label: 'Bulk import', path: '/fashion/import', permission: 'fashion.import' },
  { icon: ClipboardCheck, label: 'Authenticity review', path: '/fashion/review', permission: 'fashion.review' },
  { icon: Store, label: 'Stores', path: '/fashion/stores', permission: 'fashion.stores.view' },
  { icon: ShieldAlert, label: 'Incidents', path: '/fashion/incidents', permission: 'fashion.incidents.manage' },
  { icon: Users, label: 'Users', path: '/fashion/users', permission: 'fashion.users.manage' },
  { icon: Settings, label: 'Settings', path: '/fashion/settings', permission: 'fashion.settings.manage' },
];

export default function FashionShell({ children }: { children: React.ReactNode }) {
  const { permissions, organizations, activeOrganizationId, selectOrganization } = useAuth();
  const navItems = useMemo(
    () => NAV.filter((item) => permissions.includes(item.permission)).map(({ permission: _permission, ...item }) => item),
    [permissions],
  );

  useEffect(() => {
    localStorage.setItem('mk_preferred_vertical', 'fashion');
    const fashionOrgs = organizations.filter((item) => item.slug.startsWith('fashion-'));
    if (!fashionOrgs.length) return;
    const preferred = fashionOrgs.find((item) => item.role === 'owner') ?? fashionOrgs[0];
    if (preferred && activeOrganizationId !== preferred.organizationId) {
      selectOrganization(preferred.organizationId);
    }
  }, [organizations, activeOrganizationId, selectOrganization]);

  return (
    <VerticalWorkspaceShell
      title="Omni Core Fashion"
      icon={Shirt}
      identityClassName="bg-pink-500"
      loginPath="/fashion/login"
      navLabel="Fashion navigation"
      navItems={navItems}
    >
      {children}
    </VerticalWorkspaceShell>
  );
}
