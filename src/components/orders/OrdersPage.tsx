import { useEffect, useState, useCallback } from 'react';
import {
    ShoppingCart,
    Truck,
    PackageCheck,
    Clock,
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    ExternalLink,
    X,
    Copy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const API = '/api/orders';

/* ─── Types ─── */

interface OrderSummary {
    id: string;
    channel: string;
    externalOrderId: string | null;
    externalUrl: string | null;
    status: string;
    buyerUsername: string | null;
    buyerName: string | null;
    totalAmount: string;
    currency: string;
    trackingNumber: string | null;
    trackingCarrier: string | null;
    orderedAt: string;
    createdAt: string;
}

interface OrderItem {
    id: string;
    sku: string | null;
    title: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    fulfilled: boolean;
}

interface OrderDetail extends OrderSummary {
    buyerEmail: string | null;
    shippingName: string | null;
    shippingAddress1: string | null;
    shippingAddress2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingZip: string | null;
    shippingCountry: string | null;
    shippingMethod: string | null;
    shippingCost: string;
    subtotal: string;
    taxAmount: string;
    marketplaceFee: string;
    netRevenue: string | null;
    refundAmount: string;
    refundReason: string | null;
    paidAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
    items: OrderItem[];
}

interface OrderStats {
    [status: string]: number;
}

/* ─── Helpers ─── */

const statusConfigs: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: <Clock size={12} /> },
    confirmed: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: <PackageCheck size={12} /> },
    processing: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: <PackageCheck size={12} /> },
    shipped: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: <Truck size={12} /> },
    delivered: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <PackageCheck size={12} /> },
    cancelled: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <X size={12} /> },
    refunded: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <X size={12} /> },
    partial_refund: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <X size={12} /> },
    return_requested: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <Clock size={12} /> },
    completed: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <PackageCheck size={12} /> },
};

const defaultStatus = { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: <Clock size={12} /> };

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function fmtCurrency(amount: string | number, currency = 'USD'): string {
    return Number(amount).toLocaleString('en-US', {
        style: 'currency', currency,
        minimumFractionDigits: 2,
    });
}

/* ─── Component ─── */

export default function OrdersPage() {
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [stats, setStats] = useState<OrderStats>({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [channelFilter, setChannelFilter] = useState<string>('');
    const [searchQ, setSearchQ] = useState('');
    const [page, setPage] = useState(0);
    const limit = 20;

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            if (channelFilter) params.set('channel', channelFilter);
            params.set('limit', String(limit));
            params.set('offset', String(page * limit));

            const [listRes, statsRes] = await Promise.all([
                fetch(`${API}?${params}`).then(r => r.json()),
                fetch(`${API}/stats`).then(r => r.json()),
            ]);
            setOrders(listRes.items ?? listRes.orders ?? []);
            setTotal(listRes.total ?? 0);
            setStats(statsRes ?? {});
        } catch (e) {
            console.error('Orders fetch error', e);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, channelFilter, page]);

    useEffect(() => { void fetchOrders(); }, [fetchOrders]);

    const openDetail = async (id: string) => {
        setDetailLoading(true);
        try {
            const res = await fetch(`${API}/${id}`).then(r => r.json());
            setSelectedOrder(res);
        } catch (e) {
            console.error('Order detail error', e);
        } finally {
            setDetailLoading(false);
        }
    };

    const totalOrders = Object.values(stats).reduce((a, b) => a + Number(b), 0);

    const filteredOrders = searchQ
        ? orders.filter(o =>
            (o.externalOrderId ?? '').toLowerCase().includes(searchQ.toLowerCase()) ||
            (o.buyerName ?? '').toLowerCase().includes(searchQ.toLowerCase()) ||
            (o.buyerUsername ?? '').toLowerCase().includes(searchQ.toLowerCase())
        )
        : orders;

    return (
        <div className="space-y-4 sm:space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Orders</h2>

            {/* ─── Stats Cards ─── */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold">{totalOrders}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold text-yellow-500">
                            {Number(stats['pending'] ?? 0) + Number(stats['confirmed'] ?? 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Shipped</CardTitle>
                        <Truck className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold text-purple-500">
                            {stats['shipped'] ?? 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Completed</CardTitle>
                        <PackageCheck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-500">
                            {Number(stats['delivered'] ?? 0) + Number(stats['completed'] ?? 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Filters ─── */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search order ID, buyer..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-slate-600"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="">All Statuses</option>
                    {Object.keys(statusConfigs).map(s => (
                        <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
                    ))}
                </select>
                <select
                    value={channelFilter}
                    onChange={e => { setChannelFilter(e.target.value); setPage(0); }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="">All Channels</option>
                    <option value="ebay">eBay</option>
                    <option value="shopify">Shopify</option>
                    <option value="manual">Manual</option>
                </select>
            </div>

            {/* ─── Orders Table ─── */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-800/30">
                                    <th className="text-left py-3 px-4 text-slate-500 font-medium">Order</th>
                                    <th className="text-left py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">Buyer</th>
                                    <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                                    <th className="text-left py-3 px-4 text-slate-500 font-medium hidden md:table-cell">Channel</th>
                                    <th className="text-right py-3 px-4 text-slate-500 font-medium">Total</th>
                                    <th className="text-right py-3 px-4 text-slate-500 font-medium hidden lg:table-cell">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-500">
                                            No orders found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map(order => {
                                        const sc = statusConfigs[order.status] ?? defaultStatus;
                                        return (
                                            <tr
                                                key={order.id}
                                                className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                                                onClick={() => void openDetail(order.id)}
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-200 font-mono text-xs">
                                                        {order.externalOrderId ?? order.id.substring(0, 8)}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-400 hidden sm:table-cell">
                                                    {order.buyerName ?? order.buyerUsername ?? '—'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${sc.color}`}>
                                                        {sc.icon}
                                                        <span className="capitalize">{order.status.replace('_', ' ')}</span>
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 hidden md:table-cell">
                                                    <span className="text-slate-400 capitalize">{order.channel}</span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-slate-200">
                                                    {fmtCurrency(order.totalAmount, order.currency)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-400 hidden lg:table-cell">
                                                    {fmtDate(order.orderedAt)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {total > limit && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-sm text-slate-500">
                                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    disabled={(page + 1) * limit >= total}
                                    onClick={() => setPage(p => p + 1)}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── Order Detail Modal ─── */}
            {(selectedOrder || detailLoading) && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
                    onClick={() => !detailLoading && setSelectedOrder(null)}
                >
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {detailLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                            </div>
                        ) : selectedOrder && (
                            <>
                                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-100">
                                            Order #{selectedOrder.externalOrderId ?? selectedOrder.id.substring(0, 8)}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${(statusConfigs[selectedOrder.status] ?? defaultStatus).color}`}>
                                                {(statusConfigs[selectedOrder.status] ?? defaultStatus).icon}
                                                <span className="capitalize">{selectedOrder.status.replace('_', ' ')}</span>
                                            </span>
                                            <span className="text-xs text-slate-500 capitalize">{selectedOrder.channel}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="p-2 text-slate-400 hover:text-slate-100 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-4 sm:p-6 space-y-6">
                                    {/* Amounts */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div>
                                            <span className="text-xs text-slate-500 block">Subtotal</span>
                                            <span className="text-sm font-medium text-slate-200">{fmtCurrency(selectedOrder.subtotal)}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 block">Shipping</span>
                                            <span className="text-sm font-medium text-slate-200">{fmtCurrency(selectedOrder.shippingCost)}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 block">Tax</span>
                                            <span className="text-sm font-medium text-slate-200">{fmtCurrency(selectedOrder.taxAmount)}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 block">Total</span>
                                            <span className="text-lg font-bold text-slate-100">{fmtCurrency(selectedOrder.totalAmount)}</span>
                                        </div>
                                    </div>

                                    {/* Buyer & Shipping */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Buyer</h4>
                                            <div className="text-sm text-slate-300 space-y-1">
                                                {selectedOrder.buyerName && <p>{selectedOrder.buyerName}</p>}
                                                {selectedOrder.buyerUsername && <p className="text-slate-400">@{selectedOrder.buyerUsername}</p>}
                                                {selectedOrder.buyerEmail && <p className="text-slate-400">{selectedOrder.buyerEmail}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Ship To</h4>
                                            <div className="text-sm text-slate-300 space-y-1">
                                                {selectedOrder.shippingName && <p>{selectedOrder.shippingName}</p>}
                                                {selectedOrder.shippingAddress1 && <p className="text-slate-400">{selectedOrder.shippingAddress1}</p>}
                                                {selectedOrder.shippingAddress2 && <p className="text-slate-400">{selectedOrder.shippingAddress2}</p>}
                                                {(selectedOrder.shippingCity || selectedOrder.shippingState) && (
                                                    <p className="text-slate-400">
                                                        {[selectedOrder.shippingCity, selectedOrder.shippingState, selectedOrder.shippingZip].filter(Boolean).join(', ')}
                                                    </p>
                                                )}
                                                {selectedOrder.shippingCountry && <p className="text-slate-400">{selectedOrder.shippingCountry}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tracking */}
                                    {selectedOrder.trackingNumber && (
                                        <div className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs text-slate-500 block">Tracking</span>
                                                <span className="text-sm font-mono text-slate-200">
                                                    {selectedOrder.trackingCarrier ? `${selectedOrder.trackingCarrier}: ` : ''}
                                                    {selectedOrder.trackingNumber}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => void navigator.clipboard.writeText(selectedOrder.trackingNumber!)}
                                                className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
                                                title="Copy tracking number"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Line Items */}
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Items</h4>
                                        <div className="border border-slate-800 rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-800 bg-slate-800/30">
                                                        <th className="text-left py-2 px-3 text-slate-500 font-medium">Item</th>
                                                        <th className="text-center py-2 px-3 text-slate-500 font-medium">Qty</th>
                                                        <th className="text-right py-2 px-3 text-slate-500 font-medium">Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {(selectedOrder.items ?? []).map(item => (
                                                        <tr key={item.id}>
                                                            <td className="py-2 px-3">
                                                                <p className="text-slate-200">{item.title}</p>
                                                                {item.sku && <p className="text-xs text-slate-500 mt-0.5">SKU: {item.sku}</p>}
                                                            </td>
                                                            <td className="py-2 px-3 text-center text-slate-300">{item.quantity}</td>
                                                            <td className="py-2 px-3 text-right text-slate-200">{fmtCurrency(item.totalPrice)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* External Link */}
                                    {selectedOrder.externalUrl && (
                                        <a
                                            href={selectedOrder.externalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            View on {selectedOrder.channel} <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
