import React, { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Camera, label: 'Ingestion', path: '/ingestion' },
    { icon: PlusCircle, label: 'New Listing', path: '/listings/new' },
    { icon: ScanLine, label: 'Fitment', path: '/fitment' },
    { icon: Database, label: 'Catalog', path: '/catalog' },
    { icon: Package, label: 'Orders', path: '/orders' },
    { icon: Settings, label: 'Settings', path: '/settings' },
];

/* ── Sidebar content (shared between desktop & mobile drawer) ── */
function SidebarContent({
    onNavClick,
}: {
    onNavClick?: () => void;
}) {
    const location = useLocation();

    return (
        <>
            <div className="p-4 lg:p-6">
                <h1 className="text-lg lg:text-xl font-bold tracking-tight flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-mono text-lg shrink-0">
                        RT
                    </div>
                    <span className="truncate">
                        RealTrack<span className="text-blue-500">App</span>
                    </span>
                </h1>
            </div>

            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={onNavClick}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                min-h-[44px]
                                ${isActive
                                    ? 'bg-blue-600/10 text-blue-400'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                                }`}
                        >
                            <item.icon size={18} className="shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0" />
                    <div className="text-sm min-w-0">
                        <div className="font-medium text-slate-200 truncate">Demo User</div>
                        <div className="text-xs text-slate-500">Pro Seller</div>
                    </div>
                </div>
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
            if (e.key === 'Escape') setMobileNavOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [mobileNavOpen]);

    // Prevent background scroll when drawer is open
    useEffect(() => {
        if (mobileNavOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [mobileNavOpen]);

    const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

    return (
        <div className="flex h-[100dvh] bg-slate-900 text-slate-100 overflow-hidden font-sans">
            {/* ── Mobile navigation drawer overlay ──────────── */}
            {mobileNavOpen && (
                <div
                    className="fixed inset-0 z-50 lg:hidden"
                    onClick={closeMobileNav}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 animate-fade-in" />

                    {/* Drawer panel */}
                    <aside
                        className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 flex flex-col shadow-2xl animate-slide-in-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={closeMobileNav}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors z-10"
                            aria-label="Close navigation"
                        >
                            <X size={20} />
                        </button>

                        <SidebarContent onNavClick={closeMobileNav} />
                    </aside>
                </div>
            )}

            {/* ── Desktop persistent sidebar ───────────────── */}
            <aside className="hidden lg:flex w-64 bg-slate-950 border-r border-slate-800 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {/* ── Main content area ────────────────────────── */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-14 sm:h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-3 sm:px-4 lg:px-6 sticky top-0 z-30 gap-2 shrink-0">
                    {/* Left: hamburger + search */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
                        {/* Hamburger — mobile/tablet only */}
                        <button
                            onClick={() => setMobileNavOpen(true)}
                            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
                            aria-label="Open navigation"
                        >
                            <Menu size={22} />
                        </button>

                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Search inventory, listings, parts..."
                                className="w-full bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Right: status indicators */}
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <button className="relative p-2 text-slate-400 hover:text-slate-100 transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
                        </button>
                        <div className="hidden sm:block h-6 w-px bg-slate-800" />
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-400">Systems Operational</span>
                        </div>
                    </div>
                </header>

                {/* Page content — responsive padding */}
                <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {children}
                </div>
            </main>
        </div>
    );
}
