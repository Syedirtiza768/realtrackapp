/* ─── SKU Detail Page ───────────────────────────────────────
 *  Full-featured SKU detail view with tabbed interface:
 *  Overview | Channels | Inventory | AI Enhancements | Activity
 * ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Radio,
  BarChart3,
  Sparkles,
  History,
  ExternalLink,
  RefreshCw,
  Copy,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import ChannelStorePanel from './ChannelStorePanel';
import InventoryPanel from './InventoryPanel';
import AiEnhancementsPanel from './AiEnhancementsPanel';

interface ListingDetail {
  id: string;
  customLabelSku: string;
  title: string;
  cBrand: string | null;
  cManufacturerPartNumber: string | null;
  cOeOemPartNumber: string | null;
  cType: string | null;
  startPrice: string | null;
  quantity: string | null;
  conditionId: string | null;
  pictureUrl: string | null;
  itemPhotoUrl: string | null;
  status: string;
  description: string | null;
  ebayListingId: string | null;
  shopifyProductId: string | null;
  cFeatures: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabId = 'overview' | 'channels' | 'inventory' | 'ai' | 'activity';

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<any> }> = [
  { id: 'overview', label: 'Overview', icon: Package },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'inventory', label: 'Inventory', icon: BarChart3 },
  { id: 'ai', label: 'AI Enhancements', icon: Sparkles },
  { id: 'activity', label: 'Activity', icon: History },
];

export default function SkuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const fetchListing = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/listings/${id}`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data = await res.json();
      setListing(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchListing(); }, [fetchListing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <p className="text-red-600">{error ?? 'Listing not found'}</p>
        <button onClick={() => navigate('/catalog')} className="mt-4 text-blue-600 hover:underline">
          Back to Catalog
        </button>
      </div>
    );
  }

  const imageUrl = listing.itemPhotoUrl || listing.pictureUrl;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/catalog')}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-bold">
              {listing.customLabelSku}
            </span>
            <StatusBadge status={listing.status} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 truncate mt-1">
            {listing.title}
          </h1>
        </div>
        <button
          onClick={fetchListing}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Quick Info Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <QuickStat label="Brand" value={listing.cBrand ?? '—'} />
        <QuickStat label="MPN" value={listing.cManufacturerPartNumber ?? '—'} />
        <QuickStat label="OEM #" value={listing.cOeOemPartNumber ?? '—'} />
        <QuickStat label="Price" value={listing.startPrice ? `$${Number(listing.startPrice).toFixed(2)}` : '—'} />
        <QuickStat label="Condition" value={listing.conditionId ?? '—'} />
        <QuickStat label="Type" value={listing.cType ?? '—'} />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tabId
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pb-8">
        {activeTab === 'overview' && <OverviewTab listing={listing} imageUrl={imageUrl} />}
        {activeTab === 'channels' && <ChannelStorePanel listingId={listing.id} />}
        {activeTab === 'inventory' && <InventoryPanel listingId={listing.id} />}
        {activeTab === 'ai' && <AiEnhancementsPanel listingId={listing.id} />}
        {activeTab === 'activity' && <ActivityTab listingId={listing.id} />}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 truncate" title={value}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    published: { bg: 'bg-green-100', text: 'text-green-700' },
    draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
    ready: { bg: 'bg-blue-100', text: 'text-blue-700' },
    sold: { bg: 'bg-amber-100', text: 'text-amber-700' },
    delisted: { bg: 'bg-red-100', text: 'text-red-700' },
    archived: { bg: 'bg-slate-200', text: 'text-slate-500' },
  };
  const c = config[status] ?? config.draft;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

// ─── Overview Tab ────────────────────────────────────────

function OverviewTab({ listing, imageUrl }: { listing: ListingDetail; imageUrl: string | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Image + Basic Info */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={listing.title}
              className="w-full h-64 object-contain bg-slate-50"
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" x="25" font-size="40">📦</text></svg>'; }}
            />
          ) : (
            <div className="w-full h-64 bg-slate-50 flex items-center justify-center">
              <Package className="w-16 h-16 text-slate-300" />
            </div>
          )}
          <div className="p-4 border-t border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-3">Identifiers</h3>
            <dl className="space-y-2 text-sm">
              <InfoRow label="SKU" value={listing.customLabelSku} copyable />
              <InfoRow label="MPN" value={listing.cManufacturerPartNumber} copyable />
              <InfoRow label="OEM Part #" value={listing.cOeOemPartNumber} copyable />
              {listing.ebayListingId && (
                <InfoRow label="eBay ID" value={listing.ebayListingId} link={`https://www.ebay.com/itm/${listing.ebayListingId}`} />
              )}
              {listing.shopifyProductId && (
                <InfoRow label="Shopify ID" value={listing.shopifyProductId} />
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Details + Description */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Product Details</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <InfoRow label="Brand" value={listing.cBrand} />
            <InfoRow label="Part Type" value={listing.cType} />
            <InfoRow label="Condition" value={listing.conditionId} />
            <InfoRow label="Price" value={listing.startPrice ? `$${Number(listing.startPrice).toFixed(2)}` : null} />
            <InfoRow label="Quantity" value={listing.quantity} />
            <InfoRow label="Status" value={listing.status} />
          </dl>
        </div>

        {listing.cFeatures && (
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Features</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{listing.cFeatures}</p>
          </div>
        )}

        {listing.description && (
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Description</h3>
            <div
              className="text-sm text-slate-600 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: listing.description }}
            />
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Metadata</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Created" value={new Date(listing.createdAt).toLocaleDateString()} />
            <InfoRow label="Updated" value={new Date(listing.updatedAt).toLocaleDateString()} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, copyable, link }: {
  label: string;
  value: string | null | undefined;
  copyable?: boolean;
  link?: string;
}) {
  const display = value ?? '—';
  return (
    <div className="flex justify-between items-center">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium flex items-center gap-1">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
            {display} <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          display
        )}
        {copyable && value && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="p-0.5 hover:bg-slate-100 rounded"
            title="Copy"
          >
            <Copy className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </dd>
    </div>
  );
}

// ─── Activity Tab ────────────────────────────────────────

function ActivityTab({ listingId }: { listingId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/audit-logs?entityId=${listingId}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.items ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [listingId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">No activity yet</p>
        <p className="text-sm mt-1">Activity will appear as you publish, update, and manage this listing.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
      {logs.map((log: any) => (
        <div key={log.id} className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <History className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{log.action}</p>
            <p className="text-xs text-slate-500">
              {log.entityType} · {new Date(log.createdAt).toLocaleString()}
            </p>
          </div>
          {log.actorType && (
            <span className="text-xs text-slate-400">{log.actorType}</span>
          )}
        </div>
      ))}
    </div>
  );
}
