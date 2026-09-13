import {
  ClipboardCheck,
  Database,
  Factory,
  ImagePlus,
  LayoutDashboard,
  ShieldAlert,
  Store,
  Upload,
  Users,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import VerticalWorkspaceShell, { type VerticalNavItem } from '../layout/VerticalWorkspaceShell';

const NAV: Array<VerticalNavItem & { permission: string }> = [
  { icon: LayoutDashboard, label: 'Overview', path: '/business-industrial', end: true, permission: 'business_industrial.dashboard.view' },
  {
    icon: Database,
    label: 'Catalog',
    path: '/business-industrial/catalog',
    permission: 'business_industrial.listings.view',
    isActive: (pathname) => pathname === '/business-industrial/catalog' || pathname === '/business-industrial/listings',
  },
  { icon: ImagePlus, label: 'AI image intake', path: '/business-industrial/image-intake', permission: 'business_industrial.import' },
  { icon: Upload, label: 'Bulk import', path: '/business-industrial/import', permission: 'business_industrial.import' },
  { icon: ClipboardCheck, label: 'Compliance review', path: '/business-industrial/review', permission: 'business_industrial.review' },
  { icon: Store, label: 'Stores', path: '/business-industrial/stores', permission: 'business_industrial.stores.view' },
  { icon: ShieldAlert, label: 'Incidents', path: '/business-industrial/incidents', permission: 'business_industrial.incidents.view' },
  { icon: Users, label: 'Users', path: '/business-industrial/users', permission: 'business_industrial.users.manage' },
];

export default function BusinessIndustrialShell({ children }: { children: React.ReactNode }) {
  const { permissions, organizations, activeOrganizationId, selectOrganization } = useAuth();
  const navItems = useMemo(
    () => NAV.filter((item) => permissions.includes(item.permission)).map(({ permission: _permission, ...item }) => item),
    [permissions],
  );

  useEffect(() => {
    localStorage.setItem('mk_preferred_vertical', 'business_industrial');
    const biOrgs = organizations.filter((item) => item.slug.startsWith('business-industrial-'));
    if (!biOrgs.length) return;
    const preferred = biOrgs.find((item) => item.role === 'owner') ?? biOrgs[0];
    if (preferred && activeOrganizationId !== preferred.organizationId) {
      selectOrganization(preferred.organizationId);
    }
  }, [organizations, activeOrganizationId, selectOrganization]);

  return (
    <VerticalWorkspaceShell
      title="Omni Core Business & Industrial"
      icon={Factory}
      identityClassName="bg-cyan-600"
      loginPath="/business-industrial/login"
      navLabel="Business and Industrial navigation"
      navItems={navItems}
    >
      {children}
    </VerticalWorkspaceShell>
  );
}
