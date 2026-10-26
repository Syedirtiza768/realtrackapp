import { ArrowLeftRight, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import VerticalWorkspaceShell, { type VerticalNavItem } from '../layout/VerticalWorkspaceShell';

/**
 * Parts Search portal shell. A sibling of the Auto Parts, Fashion and B&I
 * workspaces (not nested under /auto-parts), gated on the same permission as
 * Auto Parts (`dashboard.view`) — see App.tsx.
 */
const NAV: VerticalNavItem[] = [
  {
    icon: Search,
    label: 'Search',
    path: '/parts-search',
    isActive: (pathname) => pathname === '/parts-search' || pathname.startsWith('/parts-search/results') || pathname.startsWith('/parts-search/parts/'),
  },
  { icon: ArrowLeftRight, label: 'Auto Parts workspace', path: '/auto-parts', end: true },
];

export default function PartsSearchShell({ children }: { children: ReactNode }) {
  return (
    <VerticalWorkspaceShell
      title="Parts Search"
      icon={Search}
      identityClassName="bg-sky-600"
      loginPath="/parts-search/login"
      navLabel="Parts Search navigation"
      navItems={NAV}
    >
      {children}
    </VerticalWorkspaceShell>
  );
}
