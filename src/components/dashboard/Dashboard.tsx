import { useEffect, useState, useCallback } from 'react';
import {
    BarChart3,
    Package,
    AlertTriangle,
    Activity,
    ArrowUpRight,
    RefreshCw,
    PackageX,
    Loader2,
    Store,
    Sparkles,
    Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

const API = '/api';

interface DashboardSummary {
    totalListings: number;
    activeListings: number;
    totalSales: number;
    revenue: number;
    avgPrice: number;
    channelBreakdown: { channel: string; count: string; revenue: string }[];
    computedAt: string;
}

interface AuditLogItem {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actorType: string;
    createdAt: string;
}

interface ChannelHealthRow {
    channel: string;
    status: string;
    lastSync: string | null;
    lastError: string | null;
    listingCount: string;
    errorCount: string;
}

interface InventoryAlert {
    listingId: string;
    title: string;
    sku: string;
    total: number;
    reserved: number;
    available: number;
    threshold: number;
}

interface MultiStoreMetrics {
    stores: { channel: string; status: string; count: string }[];
    instances: { channel: string; syncStatus: string; count: string }[];
    aiEnhancements: { enhancementType: string; status: string; count: string }[];
    demoSimulations: { operationType: string; channel: string; count: string; successCount: string }[];
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function fmtCurrency(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Dashboard() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [activity, setActivity] = useState<AuditLogItem[]>([]);
    const [channels, setChannels] = useState<ChannelHealthRow[]>([]);
    const [lowStock, setLowStock] = useState<InventoryAlert[]>([]);
    const [outOfStock, setOutOfStock] = useState<InventoryAlert[]>([]);
    const [multiStore, setMultiStore] = useState<MultiStoreMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const safeFetch = async <T,>(url: string, fallback: T): Promise<T> => {
                try {
                    const r = await fetch(url);
                    if (!r.ok) return fallback;
                    return await r.json() as T;
                } catch {
                    return fallback;
                }
            };

            const defaultSummary: DashboardSummary = {
                totalListings: 0, activeListings: 0, totalSales: 0,
                revenue: 0, avgPrice: 0, channelBreakdown: [], computedAt: new Date().toISOString(),
            };

            const [sumRes, actRes, chRes, invRes, msRes] = await Promise.all([
                safeFetch<DashboardSummary>(`${API}/dashboard/summary`, defaultSummary),
                safeFetch<{ items?: AuditLogItem[] }>(`${API}/dashboard/activity?limit=8`, { items: [] }),
                safeFetch<{ channels?: ChannelHealthRow[] }>(`${API}/dashboard/channel-health`, { channels: [] }),
                safeFetch<{ lowStock?: InventoryAlert[]; outOfStock?: InventoryAlert[] }>(`${API}/dashboard/inventory-alerts`, { lowStock: [], outOfStock: [] }),
                safeFetch<MultiStoreMetrics>(`${API}/dashboard/multi-store`, { stores: [], instances: [], aiEnhancements: [], demoSimulations: [] }),
            ]);
            setSummary(sumRes);
            setActivity(actRes.items ?? []);
            setChannels(chRes.channels ?? []);
            setLowStock(invRes.lowStock ?? []);
            setOutOfStock(invRes.outOfStock ?? []);
            setMultiStore(msRes);
            setLastRefresh(new Date());
        } catch (e) {
            console.error('Dashboard fetch error', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchAll(); }, [fetchAll]);

    const actionColorMap: Record<string, string> = {
        create: 'bg-blue-500',
        update: 'bg-blue-500',
        publish: 'bg-emerald-500',
        sell: 'bg-emerald-500',
        delete: 'bg-red-500',
    };

    const channelStatusColor = (status: string) => {
        if (status === 'active') return 'emerald';
        if (status === 'expired' || status === 'error') return 'amber';
        return 'blue';
    };

    const colorClasses = {
        emerald: 'bg-emerald-500/10 text-emerald-500',
        blue: 'bg-blue-500/10 text-blue-500',
        amber: 'bg-amber-500/10 text-amber-500',
    } as const;

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-slate-500">
                        Last sync: {relativeTime(lastRefresh.toISOString())}
                    </span>
                    <button
                        onClick={() => void fetchAll()}
                        disabled={loading}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
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
                        <div className="text-xl sm:text-2xl font-bold">
                            {summary?.totalListings != null ? summary.totalListings.toLocaleString() : '—'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">All listings</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Active Listings</CardTitle>
                        <Activity className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-500">
                            {summary?.activeListings != null ? summary.activeListings.toLocaleString() : '—'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {summary?.channelBreakdown?.length
                                ? `Across ${summary.channelBreakdown.length} channel${summary.channelBreakdown.length !== 1 ? 's' : ''}`
                                : 'Published'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Revenue (30d)</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold">
                            {summary?.revenue != null ? fmtCurrency(summary.revenue) : '—'}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                            <span className="text-emerald-500">{summary?.totalSales ?? 0}</span>&nbsp;sales
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Inventory Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold text-amber-500">
                            {lowStock.length + outOfStock.length}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {outOfStock.length} out of stock, {lowStock.length} low
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
                        {loading && activity.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                            </div>
                        ) : activity.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4">No recent activity</p>
                        ) : (
                            <div className="space-y-4">
                                {activity.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between border-b border-slate-800 last:border-0 pb-4 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-2 rounded-full ${actionColorMap[item.action] ?? 'bg-blue-500'}`} />
                                            <div>
                                                <p className="text-sm font-medium text-slate-200 capitalize">
                                                    {item.action} {item.entityType}
                                                </p>
                                                <p className="text-xs text-slate-500">{item.actorType}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono">
                                            {relativeTime(item.createdAt)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Channel Sync Health */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Channel Sync Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {channels.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4">No channels connected</p>
                        ) : (
                            <div className="space-y-4">
                                {channels.map((c) => {
                                    const color = channelStatusColor(c.status);
                                    return (
                                        <div key={c.channel} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-md ${colorClasses[color]}`}>
                                                    <RefreshCw size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-200 capitalize">{c.channel}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {c.lastSync ? relativeTime(c.lastSync) : 'Never synced'}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant={color === 'emerald' ? 'success' : color === 'amber' ? 'warning' : 'secondary'}>
                                                {Number(c.listingCount)} listings
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Multi-Store & AI Metrics */}
            {multiStore && (multiStore.stores.length > 0 || multiStore.aiEnhancements.length > 0 || multiStore.demoSimulations.length > 0) && (
                <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-3">
                    {/* Store Overview */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Store className="h-4 w-4 text-blue-500" />
                                Multi-Store Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {multiStore.stores.length === 0 ? (
                                <p className="text-sm text-slate-500 py-2">No stores configured</p>
                            ) : (
                                <div className="space-y-2">
                                    {multiStore.stores.map((s) => (
                                        <div key={`${s.channel}-${s.status}`} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-slate-200 capitalize">{s.channel}</span>
                                                <Badge variant={s.status === 'active' ? 'success' : 'secondary'}>{s.status}</Badge>
                                            </div>
                                            <span className="text-sm text-slate-400 font-mono">{s.count}</span>
                                        </div>
                                    ))}
                                    {multiStore.instances.length > 0 && (
                                        <div className="pt-2 border-t border-slate-800 mt-2">
                                            <p className="text-xs text-slate-500 mb-1">Channel Instances</p>
                                            {multiStore.instances.map((inst) => (
                                                <div key={`${inst.channel}-${inst.syncStatus}`} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400 capitalize">{inst.channel} · {inst.syncStatus}</span>
                                                    <span className="text-slate-300 font-mono">{inst.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI Enhancements */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                                AI Enhancements
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {multiStore.aiEnhancements.length === 0 ? (
                                <p className="text-sm text-slate-500 py-2">No enhancements yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {multiStore.aiEnhancements.map((ai) => (
                                        <div key={`${ai.enhancementType}-${ai.status}`} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 capitalize">{ai.enhancementType.replace(/_/g, ' ')}</span>
                                                <Badge variant={
                                                    ai.status === 'approved' ? 'success' :
                                                    ai.status === 'rejected' ? 'destructive' :
                                                    ai.status === 'generated' ? 'warning' : 'secondary'
                                                }>{ai.status}</Badge>
                                            </div>
                                            <span className="text-slate-400 font-mono">{ai.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Demo Simulations */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Radio className="h-4 w-4 text-amber-500" />
                                Demo Mode Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {multiStore.demoSimulations.length === 0 ? (
                                <p className="text-sm text-slate-500 py-2">No simulations logged</p>
                            ) : (
                                <div className="space-y-2">
                                    {multiStore.demoSimulations.map((d) => (
                                        <div key={`${d.operationType}-${d.channel}`} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 capitalize">{d.channel}</span>
                                                <span className="text-slate-500">{d.operationType.replace(/_/g, ' ')}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 font-mono">{d.count}</span>
                                                <span className="text-emerald-500 text-[10px]">({d.successCount} ok)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Inventory Alerts Row */}
            {(lowStock.length > 0 || outOfStock.length > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PackageX className="h-4 w-4 text-red-500" />
                            Inventory Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-800">
                                        <th className="text-left py-2 pr-4">Title</th>
                                        <th className="text-left py-2 pr-4">SKU</th>
                                        <th className="text-right py-2 pr-4">Available</th>
                                        <th className="text-right py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {outOfStock.slice(0, 5).map((item) => (
                                        <tr key={item.listingId} className="border-b border-slate-800/50">
                                            <td className="py-2 pr-4 text-slate-200 truncate max-w-[200px]">{item.title ?? '—'}</td>
                                            <td className="py-2 pr-4 text-slate-400 font-mono text-xs">{item.sku ?? '—'}</td>
                                            <td className="py-2 pr-4 text-right text-red-500 font-bold">{item.available}</td>
                                            <td className="py-2 text-right"><Badge variant="destructive">Out of Stock</Badge></td>
                                        </tr>
                                    ))}
                                    {lowStock.slice(0, 5).map((item) => (
                                        <tr key={item.listingId} className="border-b border-slate-800/50">
                                            <td className="py-2 pr-4 text-slate-200 truncate max-w-[200px]">{item.title ?? '—'}</td>
                                            <td className="py-2 pr-4 text-slate-400 font-mono text-xs">{item.sku ?? '—'}</td>
                                            <td className="py-2 pr-4 text-right text-amber-500 font-bold">{item.available}</td>
                                            <td className="py-2 text-right"><Badge variant="warning">Low Stock</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
