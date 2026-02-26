import { useEffect, useState, useCallback } from 'react';
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    Loader2,
    Info,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Filter,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';

const API = '/api/notifications';

/* ─── Types ─── */

interface Notification {
    id: string;
    recipientId: string | null;
    type: string;
    title: string;
    body: string | null;
    icon: string | null;
    severity: 'info' | 'success' | 'warning' | 'error';
    entityType: string | null;
    entityId: string | null;
    actionUrl: string | null;
    read: boolean;
    readAt: string | null;
    dismissed: boolean;
    createdAt: string;
}

/* ─── Helpers ─── */

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const severityConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    info: {
        icon: <Info size={16} />,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
    },
    success: {
        icon: <CheckCircle2 size={16} />,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
    },
    warning: {
        icon: <AlertTriangle size={16} />,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
    },
    error: {
        icon: <AlertCircle size={16} />,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
    },
};

/* ─── Component ─── */

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const limit = 25;

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (severityFilter) params.set('severity', severityFilter);
            if (typeFilter) params.set('type', typeFilter);
            params.set('limit', String(limit));
            params.set('offset', String(page * limit));

            const [listRes, countRes] = await Promise.all([
                fetch(`${API}?${params}`).then(r => r.json()),
                fetch(`${API}/unread-count`).then(r => r.json()),
            ]);

            const items: Notification[] = Array.isArray(listRes) ? listRes : (listRes.items ?? []);
            setNotifications(items);
            setHasMore(items.length >= limit);
            setUnreadCount(countRes.count ?? 0);
        } catch (e) {
            console.error('Notifications fetch error', e);
        } finally {
            setLoading(false);
        }
    }, [page, severityFilter, typeFilter]);

    useEffect(() => { void fetchNotifications(); }, [fetchNotifications]);

    const markAsRead = async (id: string) => {
        await fetch(`${API}/${id}/read`, { method: 'PATCH' });
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount(c => Math.max(0, c - 1));
    };

    const markAllAsRead = async () => {
        await fetch(`${API}/mark-all-read`, { method: 'POST' });
        setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
        setUnreadCount(0);
    };

    const dismiss = async (id: string) => {
        await fetch(`${API}/${id}`, { method: 'DELETE' });
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Collect unique types for the filter dropdown
    const uniqueTypes = [...new Set(notifications.map(n => n.type))].sort();

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h2>
                    {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={() => void markAllAsRead()}
                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <CheckCheck size={16} />
                        Mark all as read
                    </button>
                )}
            </div>

            {/* ─── Filters ─── */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Filter size={14} />
                    Filter:
                </div>
                <select
                    value={severityFilter}
                    onChange={e => { setSeverityFilter(e.target.value); setPage(0); }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="">All Severities</option>
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                </select>
                {uniqueTypes.length > 1 && (
                    <select
                        value={typeFilter}
                        onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">All Types</option>
                        {uniqueTypes.map(t => (
                            <option key={t} value={t}>{t.replace(/[._]/g, ' ')}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* ─── Notification List ─── */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
            ) : notifications.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Bell className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                        <p className="text-sm text-slate-500">No notifications yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {notifications.map(notif => {
                        const sev = severityConfig[notif.severity] ?? severityConfig.info;
                        return (
                            <div
                                key={notif.id}
                                className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-colors group ${
                                    notif.read
                                        ? 'bg-slate-900/50 border-slate-800'
                                        : 'bg-slate-800/50 border-slate-700'
                                }`}
                            >
                                {/* Severity Icon */}
                                <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${sev.bg} ${sev.color}`}>
                                    {sev.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium ${notif.read ? 'text-slate-400' : 'text-slate-200'}`}>
                                                {notif.title}
                                            </p>
                                            {notif.body && (
                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[11px] text-slate-600 font-mono">
                                                    {relativeTime(notif.createdAt)}
                                                </span>
                                                <span className="text-[11px] text-slate-600 capitalize">
                                                    {notif.type.replace(/[._]/g, ' ')}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!notif.read && (
                                                <button
                                                    onClick={() => void markAsRead(notif.id)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors"
                                                    title="Mark as read"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => void dismiss(notif.id)}
                                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                                title="Dismiss"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Unread dot */}
                                {!notif.read && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {(page > 0 || hasMore) && notifications.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-slate-500">
                        Page {page + 1}
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
                            disabled={!hasMore}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
