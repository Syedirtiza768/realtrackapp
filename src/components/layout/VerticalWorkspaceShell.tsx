import { type LucideIcon, LogOut, Menu, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import WorkspaceSwitcher from '../auth/WorkspaceSwitcher';

export type VerticalNavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

type Props = {
  title: string;
  icon: LucideIcon;
  loginPath: string;
  navLabel: string;
  navItems: VerticalNavItem[];
  children: ReactNode;
  identityClassName?: string;
};

function SidebarContent({
  title,
  icon: Icon,
  identityClassName,
  navLabel,
  navItems,
  loginPath,
  onNavClick,
}: Omit<Props, 'children'> & { onNavClick?: () => void }) {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(loginPath, { replace: true });
  };

  return (
    <>
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 lg:text-xl">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white ${identityClassName || ''}`}>
            <Icon size={18} aria-hidden="true" />
          </div>
          <span className="truncate">{title}</span>
        </div>
      </div>
      <nav aria-label={navLabel} className="flex-1 space-y-1 overflow-y-auto px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={onNavClick}
            className={({ isActive }) => {
              const active = item.isActive ? item.isActive(location.pathname) : isActive;
              return `flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? ''
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
              }`;
            }}
            style={({ isActive }) => {
              const active = item.isActive ? item.isActive(location.pathname) : isActive;
              return active
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)',
                    color: 'var(--brand-primary)',
                    fontWeight: 600,
                  }
                : undefined;
            }}
          >
            <item.icon size={18} className="shrink-0" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-800">
        <WorkspaceSwitcher />
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate font-medium text-slate-700 dark:text-slate-200">{user?.name ?? user?.email ?? 'User'}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.roleName ?? user?.roleSlug ?? ''}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
        >
          <LogOut size={14} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </>
  );
}

export default function VerticalWorkspaceShell({
  title,
  icon,
  loginPath,
  navLabel,
  navItems,
  children,
  identityClassName = 'bg-slate-800',
}: Props) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    const previouslyHidden = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    window.requestAnimationFrame(() => focusables()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previouslyHidden;
      previouslyFocused?.focus();
    };
  }, [mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 motion-reduce:animate-none" onClick={closeMobileNav} />
          <aside
            ref={drawerRef}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            aria-labelledby={titleId}
          >
            <h2 id={titleId} className="sr-only">
              {navLabel}
            </h2>
            <button
              type="button"
              onClick={closeMobileNav}
              className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
            <SidebarContent
              title={title}
              icon={icon}
              identityClassName={identityClassName}
              navLabel={navLabel}
              navItems={navItems}
              loginPath={loginPath}
              onNavClick={closeMobileNav}
            />
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:flex">
        <SidebarContent
          title={title}
          icon={icon}
          identityClassName={identityClassName}
          navLabel={navLabel}
          navItems={navItems}
          loginPath={loginPath}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 sm:h-16 sm:px-4 lg:px-6">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="-ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
            <p className="hidden truncate text-xs text-slate-500 sm:block">Workspace</p>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent dark:scrollbar-thumb-slate-700 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
