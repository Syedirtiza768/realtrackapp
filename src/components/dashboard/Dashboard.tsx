
import {
    BarChart3,
    Package,
    AlertTriangle,
    Activity,
    ArrowUpRight,
    RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

export default function Dashboard() {
    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-slate-500">Last sync: Just now</span>
                    <button className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <RefreshCw size={16} className="text-slate-400" />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Catalog</CardTitle>
                        <Package className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold">12,345</div>
                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                            <span className="text-emerald-500">+180</span> from last week
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Active Listings</CardTitle>
                        <Activity className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-500">8,902</div>
                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            <span className="text-slate-400">Across 3 channels</span>
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Needs Review</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold text-amber-500">24</div>
                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            <span className="text-slate-400">Low confidence fitments</span>
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Sales Today</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold">$4,231</div>
                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                            <span className="text-emerald-500">+12%</span> vs yesterday
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-7">
                {/* Recent Activity */}
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { title: 'Alternator for 2018 Camry', action: 'Sold on eBay', time: '2 mins ago', type: 'success' },
                                { title: 'Brake Pads Set', action: 'Sync Warning', time: '15 mins ago', type: 'warning' },
                                { title: 'Headlight Assembly', action: 'Listed on Shopify', time: '1 hour ago', type: 'default' },
                                { title: 'Transmission Module', action: 'Fitment Updated', time: '2 hours ago', type: 'default' },
                                { title: 'Oil Filter Set (Bulk)', action: 'Quantity Low', time: '3 hours ago', type: 'destructive' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-slate-800 last:border-0 pb-4 last:pb-0">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-2 rounded-full ${item.type === 'success' ? 'bg-emerald-500' :
                                            item.type === 'warning' ? 'bg-amber-500' :
                                                item.type === 'destructive' ? 'bg-red-500' : 'bg-blue-500'
                                            }`}></div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{item.title}</p>
                                            <p className="text-xs text-slate-500">{item.action}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono">
                                        {item.time}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Sync Status */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Channel Sync Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { channel: 'eBay Motors', status: 'Operational', latency: '45ms', color: 'emerald' },
                                { channel: 'Shopify Store', status: 'Syncing...', latency: '120ms', color: 'blue' },
                                { channel: 'Amazon Automotive', status: 'Degraded', latency: '850ms', color: 'amber' },
                                { channel: 'WHI Solutions', status: 'Operational', latency: '32ms', color: 'emerald' },
                            ].map((c) => (
                                <div key={c.channel} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-md bg-${c.color}-500/10 text-${c.color}-500`}>
                                            <RefreshCw size={14} className={c.status === 'Syncing...' ? 'animate-spin' : ''} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">{c.channel}</div>
                                            <div className="text-xs text-slate-500">{c.status}</div>
                                        </div>
                                    </div>
                                    <Badge variant={c.color === 'emerald' ? 'success' : c.color === 'amber' ? 'warning' : 'secondary'}>
                                        {c.latency}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
