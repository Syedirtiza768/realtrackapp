import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Camera,
  PlusCircle,
  ScanLine,
  Database,
  Settings,
  Package,
  Search,
  Bell,
  Menu,
  X,
  Zap,
  FileText,
  ScrollText,
  Layers,
  Upload,
  Cpu,
  ClipboardList,
  Workflow,
  Eye,
  Car,
  Filter,
  ShoppingBag,
  ListChecks,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../../contexts/BrandingContext";
import { usePermissions } from "../../hooks/usePermissions";

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  permission?: string;
  moduleKey?: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/",
    permission: "dashboard.view",
    moduleKey: "",
  },
  {
    icon: Camera,
    label: "Ingestion",
    path: "/ingestion",
    permission: "ingestion.view",
    moduleKey: "ingestion",
  },
  {
    icon: Cpu,
    label: "Motors Intel",
    path: "/motors",
    permission: "motors.view",
    moduleKey: "motors",
  },
  {
    icon: ClipboardList,
    label: "Review Queue",
    path: "/motors/review",
    permission: "motors.review",
    moduleKey: "motors/review",
  },
  {
    icon: PlusCircle,
    label: "Add Part",
    path: "/listings/new",
    permission: "listings.create",
    moduleKey: "listings/new",
  },
  {
    icon: ScanLine,
    label: "Fitment",
    path: "/fitment",
    permission: "fitment.view",
    moduleKey: "fitment",
  },
  {
    icon: Car,
    label: "VIN Lookup",
    path: "/fitment/vin",
    permission: "fitment.view",
    moduleKey: "fitment/vin",
  },
  {
    icon: Database,
    label: "Catalog",
    path: "/catalog",
    permission: "catalog.view",
    moduleKey: "catalog",
  },
  {
    icon: Upload,
    label: "CSV Import",
    path: "/catalog/import",
    permission: "catalog.import",
    moduleKey: "catalog/import",
  },
  {
    icon: Filter,
    label: "Motors CSV filters",
    path: "/catalog/motors-filters",
    permission: "catalog.view",
    moduleKey: "catalog/motors-filters",
  },
  {
    icon: Package,
    label: "Inventory",
    path: "/inventory",
    permission: "inventory.view",
    moduleKey: "inventory",
  },
  {
    icon: ListChecks,
    label: "Published Listings",
    path: "/published-listings",
    permission: "published_listings.view",
    moduleKey: "published-listings",
  },
  {
    icon: Workflow,
    label: "Pipeline",
    path: "/pipeline",
    permission: "pipeline.view",
    moduleKey: "pipeline",
  },
  {
    icon: Eye,
    label: "eBay Preview",
    path: "/preview",
    permission: "listings.view",
    moduleKey: "preview",
  },
  {
    icon: Layers,
    label: "Bulk Actions",
    path: "/bulk-actions",
    permission: "listings.update",
    moduleKey: "bulk-actions",
  },
  {
    icon: Package,
    label: "Orders",
    path: "/orders",
    permission: "orders.view",
    moduleKey: "orders",
  },
  {
    icon: Zap,
    label: "Automation",
    path: "/automation",
    permission: "automation.view",
    moduleKey: "automation",
  },
  {
    icon: FileText,
    label: "Templates",
    path: "/templates",
    permission: "templates.view",
    moduleKey: "templates",
  },
  {
    icon: ScrollText,
    label: "Audit Trail",
    path: "/audit",
    permission: "audit.view",
    moduleKey: "audit",
  },
  {
    icon: Bell,
    label: "Notifications",
    path: "/notifications",
    permission: "notifications.view",
    moduleKey: "notifications",
  },
  {
    icon: Settings,
    label: "Settings",
    path: "/settings",
    permission: "settings.view",
    moduleKey: "settings",
  },
  {
    icon: Settings,
    label: "Users",
    path: "/settings/users",
    permission: "users.view",
    moduleKey: "settings/users",
  },
  {
    icon: Settings,
    label: "Teams",
    path: "/settings/teams",
    permission: "teams.manage",
    moduleKey: "settings/teams",
  },
  {
    icon: Settings,
    label: "Permissions",
    path: "/settings/permissions",
    permission: "roles.view",
    moduleKey: "settings/permissions",
  },
  {
    icon: Settings,
    label: "Client settings",
    path: "/settings/client",
    permission: "client_settings.view",
    moduleKey: "settings/client",
  },
  {
    icon: ShoppingBag,
    label: "eBay stores",
    path: "/settings/integrations/ebay",
    permission: "ebay.view",
    moduleKey: "settings/integrations/ebay",
  },
  {
    icon: Cpu,
    label: "AI routing",
    path: "/settings/ai-routing",
    permission: "ai.routing.view",
    moduleKey: "settings/ai-routing",
  },
];

/* ── Sidebar content (shared between desktop & mobile drawer) ── */
function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const location = useLocation();
  const { user, logout, sidebarModules } = useAuth();
  const { branding } = useBranding();
  const { has } = usePermissions();
  const navigate = useNavigate();

  const shortLabel = (branding.shortName || branding.appName || "RT")
    .slice(0, 2)
    .toUpperCase();
  const appTitle = branding.appName || "RealTrackApp";

  const sidebarModuleSet = useMemo(
    () => new Set(sidebarModules),
    [sidebarModules],
  );

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.permission && !has(item.permission)) return false;
    // If sidebarModules is empty (no config), show all items (permissive default)
    if (
      sidebarModuleSet.size > 0 &&
      !sidebarModuleSet.has(item.moduleKey ?? "")
    )
      return false;
    return true;
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      <div className="p-4 lg:p-6">
        <h1 className="text-lg lg:text-xl font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-slate-100">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt=""
              className="w-8 h-8 rounded-md object-contain shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center font-mono text-sm shrink-0"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--brand-primary-fg)",
              }}
            >
              {shortLabel}
            </div>
          )}
          <span className="truncate">{appTitle}</span>
        </h1>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                min-h-[44px]
                                ${
                                  isActive
                                    ? "text-slate-900 dark:text-slate-100"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                }`}
              style={
                isActive
                  ? {
                      backgroundColor:
                        "color-mix(in srgb, var(--brand-primary) 15%, transparent)",
                      color: "var(--brand-primary)",
                      fontWeight: 600,
                    }
                  : undefined
              }
            >
              <item.icon size={18} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="text-sm min-w-0 flex-1">
            <div className="font-medium text-slate-700 dark:text-slate-200 truncate">
              {user?.name ?? user?.email ?? "User"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.roleName ?? user?.roleSlug ?? ""}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full text-left text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50"
        >
          Sign out
        </button>
      </div>
    </>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    if (!mobileNavOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileNavOpen]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-[100dvh] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* ── Mobile navigation drawer overlay ──────────── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={closeMobileNav}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 animate-fade-in" />

          {/* Drawer panel */}
          <aside
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeMobileNav}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>

            <SidebarContent onNavClick={closeMobileNav} />
          </aside>
        </div>
      )}

      {/* ── Desktop persistent sidebar ───────────────── */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Main content area ────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 sm:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-3 sm:px-4 lg:px-6 sticky top-0 z-30 gap-2 shrink-0">
          {/* Left: hamburger + search */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
            {/* Hamburger — mobile/tablet only */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div className="relative flex-1 min-w-0">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search inventory, listings, parts..."
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 dark:text-slate-200 focus:ring-1 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                style={{
                  ["--tw-ring-color" as string]: "var(--brand-primary)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 0 1px var(--brand-primary)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "";
                }}
              />
            </div>
          </div>

          {/* Right: status indicators */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button className="relative p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />
            </button>
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Systems Operational
              </span>
            </div>
          </div>
        </header>

        {/* Page content — responsive padding */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}
