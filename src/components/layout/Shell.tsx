import React from 'react';
import {
    LayoutDashboard,
    Camera,
    PlusCircle,
    ScanLine,
    Database,
    Settings,
    Package,
    Search,
    Bell
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

export default function Shell({ children }: { children: React.ReactNode }) {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-mono text-lg">
                            LP
                        </div>
                        ListingPro<span className="text-blue-500">.ai</span>
                    </h1>
                </div>

                <nav className="flex-1 px-3 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-600/10 text-blue-400'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                                    }`}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                        <div className="text-sm">
                            <div className="font-medium text-slate-200">Demo User</div>
                            <div className="text-xs text-slate-500">Pro Seller</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
                    <div className="flex items-center gap-4 w-96">
                        <div className="relative w-full">
                            <Search className="absolute left-2.5 top-2.5 text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Search inventory, listings, parts..."
                                className="w-full bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-slate-400 hover:text-slate-100 transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>
                        </button>
                        <div className="h-6 w-px bg-slate-800"></div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-medium text-emerald-400">Systems Operational</span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {children}
                </div>
            </main>
        </div>
    );
}
