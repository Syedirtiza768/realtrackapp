/* ─── Bulk Actions Page ───────────────────────────────────
 *  Bulk operations for selected listings:
 *   - Bulk price adjust (markup / markdown / set price)
 *   - Bulk category change
 *   - Bulk image operations (regenerate thumbnails, remove images)
 *   - Bulk status change
 *  Phase 2 — new isolated page alongside existing CatalogManager bulk-publish.
 * ────────────────────────────────────────────────────────── */

import React, { useState, useCallback, useEffect } from 'react';
import {
  DollarSign,
  Tag,
  Image,
  CheckSquare,
  Loader2,
  AlertCircle,
  Search,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Edit3,
  Trash2,
  RefreshCw,
  ToggleLeft,
} from 'lucide-react';
import { bulkUpdateListings } from '../../lib/listingsApi';

const API = '/api';

interface ListingSummary {
  id: string;
  title: string;
  customLabelSku: string;
  startPrice: string | null;
  categoryName: string | null;
  status: string;
  itemPhotoUrl: string | null;
}

type BulkAction = 'price' | 'category' | 'images' | 'status';

export default function BulkActionsPage() {
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAction, setActiveAction] = useState<BulkAction | null>(null);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  // Search listings
  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/listings?limit=100&q=${encodeURIComponent(search)}`);
      const data = await res.json();
      setListings(data.items ?? data.data ?? []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    doSearch();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === listings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listings.map((l) => l.id)));
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Bulk Actions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Select listings and apply bulk operations — price adjustments, category changes, image ops, or status updates.
        </p>
      </div>

      {/* Search + Select All */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Search listings by title, SKU, or keyword..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => { setSearch(''); doSearch(); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
        <button onClick={doSearch} className="px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">
          Search
        </button>
        <button onClick={selectAll} className="px-4 py-2.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors">
          <CheckSquare className="w-4 h-4 inline mr-1" />
          {selectedIds.size === listings.length && listings.length > 0 ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${actionResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {actionResult.ok ? <CheckSquare className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {actionResult.message}
          <button onClick={() => setActionResult(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Listing Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No listings found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === listings.length && listings.length > 0}
                    onChange={selectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 text-left">Listing</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Price</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map((listing) => (
                <tr
                  key={listing.id}
                  className={`hover:bg-slate-50 cursor-pointer ${selectedIds.has(listing.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleSelect(listing.id)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(listing.id)}
                      onChange={() => toggleSelect(listing.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {listing.itemPhotoUrl ? (
                        <img
                          src={listing.itemPhotoUrl.split('|')[0]}
                          alt=""
                          className="w-10 h-10 rounded object-cover bg-slate-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center">
                          <Image className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <span className="font-medium text-slate-700 truncate max-w-xs">{listing.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{listing.customLabelSku || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{listing.startPrice ? `$${listing.startPrice}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{listing.categoryName || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={listing.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Action Bar (sticky bottom when items selected) */}
      {selectedCount > 0 && (
        <div className="sticky bottom-4 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg px-6 py-4 flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">{selectedCount} selected</span>
          <div className="h-6 w-px bg-slate-200" />

          <ActionButton icon={DollarSign} label="Adjust Price" active={activeAction === 'price'} onClick={() => setActiveAction(activeAction === 'price' ? null : 'price')} />
          <ActionButton icon={Tag} label="Change Category" active={activeAction === 'category'} onClick={() => setActiveAction(activeAction === 'category' ? null : 'category')} />
          <ActionButton icon={Image} label="Image Ops" active={activeAction === 'images'} onClick={() => setActiveAction(activeAction === 'images' ? null : 'images')} />
          <ActionButton icon={ToggleLeft} label="Change Status" active={activeAction === 'status'} onClick={() => setActiveAction(activeAction === 'status' ? null : 'status')} />
        </div>
      )}

      {/* Action Panels */}
      {activeAction === 'price' && selectedCount > 0 && (
        <BulkPricePanel
          ids={Array.from(selectedIds)}
          processing={processing}
          onExecute={async (changes) => {
            setProcessing(true);
            try {
              const res = await bulkUpdateListings(Array.from(selectedIds), changes);
              setActionResult({ ok: true, message: `Price updated for ${res.updated ?? selectedCount} listings` });
              setActiveAction(null);
              doSearch();
            } catch (e: any) {
              setActionResult({ ok: false, message: e.message });
            } finally {
              setProcessing(false);
            }
          }}
        />
      )}

      {activeAction === 'category' && selectedCount > 0 && (
        <BulkCategoryPanel
          ids={Array.from(selectedIds)}
          processing={processing}
          onExecute={async (changes) => {
            setProcessing(true);
            try {
              const res = await bulkUpdateListings(Array.from(selectedIds), changes);
              setActionResult({ ok: true, message: `Category updated for ${res.updated ?? selectedCount} listings` });
              setActiveAction(null);
              doSearch();
            } catch (e: any) {
              setActionResult({ ok: false, message: e.message });
            } finally {
              setProcessing(false);
            }
          }}
        />
      )}

      {activeAction === 'images' && selectedCount > 0 && (
        <BulkImagePanel
          ids={Array.from(selectedIds)}
          processing={processing}
          onExecute={async (op) => {
            setProcessing(true);
            try {
              const res = await fetch(`${API}/listings/bulk-image-ops`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds), operation: op }),
              });
              if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
              const data = await res.json();
              setActionResult({ ok: true, message: `Image operation "${op}" completed for ${data.processed ?? selectedCount} listings` });
              setActiveAction(null);
              doSearch();
            } catch (e: any) {
              setActionResult({ ok: false, message: e.message });
            } finally {
              setProcessing(false);
            }
          }}
        />
      )}

      {activeAction === 'status' && selectedCount > 0 && (
        <BulkStatusPanel
          ids={Array.from(selectedIds)}
          processing={processing}
          onExecute={async (changes) => {
            setProcessing(true);
            try {
              const res = await bulkUpdateListings(Array.from(selectedIds), changes);
              setActionResult({ ok: true, message: `Status updated for ${res.updated ?? selectedCount} listings` });
              setActiveAction(null);
              doSearch();
            } catch (e: any) {
              setActionResult({ ok: false, message: e.message });
            } finally {
              setProcessing(false);
            }
          }}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<any>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function BulkPricePanel({
  ids,
  processing,
  onExecute,
}: {
  ids: string[];
  processing: boolean;
  onExecute: (changes: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<'markup' | 'markdown' | 'set'>('markup');
  const [value, setValue] = useState('');

  const apply = () => {
    const num = parseFloat(value);
    if (isNaN(num)) return;

    if (mode === 'set') {
      onExecute({ startPrice: String(num) });
    } else {
      // For markup/markdown, send as special bulk operation
      onExecute({ _priceAdjust: { mode, percentage: num } });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h3 className="font-semibold text-slate-800">Bulk Price Adjustment — {ids.length} listings</h3>

      <div className="flex gap-3">
        <button
          onClick={() => setMode('markup')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${
            mode === 'markup' ? 'bg-green-50 border-green-300 text-green-700' : 'border-slate-200 text-slate-600'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Markup %
        </button>
        <button
          onClick={() => setMode('markdown')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${
            mode === 'markdown' ? 'bg-red-50 border-red-300 text-red-700' : 'border-slate-200 text-slate-600'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" />
          Markdown %
        </button>
        <button
          onClick={() => setMode('set')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${
            mode === 'set' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Set Price
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            {mode === 'set' ? '$' : '%'}
          </span>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === 'set' ? '0.00' : '10'}
            className="pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={apply}
          disabled={processing || !value}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {mode === 'markup' && `Increase prices by ${value || '0'}% for ${ids.length} selected listings`}
        {mode === 'markdown' && `Decrease prices by ${value || '0'}% for ${ids.length} selected listings`}
        {mode === 'set' && `Set price to $${value || '0.00'} for ${ids.length} selected listings`}
      </p>
    </div>
  );
}

function BulkCategoryPanel({
  ids,
  processing,
  onExecute,
}: {
  ids: string[];
  processing: boolean;
  onExecute: (changes: Record<string, unknown>) => void;
}) {
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h3 className="font-semibold text-slate-800">Bulk Category Change — {ids.length} listings</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category Name</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Auto Parts > Engine > Turbochargers"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category ID (optional)</label>
          <input
            type="text"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder="e.g. 33559 (eBay category ID)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <button
        onClick={() => {
          const changes: Record<string, unknown> = {};
          if (category) changes['categoryName'] = category;
          if (categoryId) changes['categoryId'] = categoryId;
          if (Object.keys(changes).length) onExecute(changes);
        }}
        disabled={processing || (!category && !categoryId)}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {processing ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Tag className="w-4 h-4 inline mr-1" />}
        Apply Category
      </button>
    </div>
  );
}

function BulkImagePanel({
  ids,
  processing,
  onExecute,
}: {
  ids: string[];
  processing: boolean;
  onExecute: (operation: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h3 className="font-semibold text-slate-800">Bulk Image Operations — {ids.length} listings</h3>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onExecute('regenerate-thumbnails')}
          disabled={processing}
          className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-6 h-6 text-blue-600 ${processing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-slate-700">Regenerate Thumbnails</span>
          <span className="text-xs text-slate-500">Re-process all images through the thumbnail pipeline</span>
        </button>

        <button
          onClick={() => onExecute('remove-broken')}
          disabled={processing}
          className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-6 h-6 text-red-600" />
          <span className="text-sm font-medium text-slate-700">Remove Broken Images</span>
          <span className="text-xs text-slate-500">Scan and remove references to images that no longer exist</span>
        </button>

        <button
          onClick={() => onExecute('reorder-primary')}
          disabled={processing}
          className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <Image className="w-6 h-6 text-green-600" />
          <span className="text-sm font-medium text-slate-700">Set Best Primary</span>
          <span className="text-xs text-slate-500">Auto-select the highest quality image as primary</span>
        </button>
      </div>
    </div>
  );
}

function BulkStatusPanel({
  ids,
  processing,
  onExecute,
}: {
  ids: string[];
  processing: boolean;
  onExecute: (changes: Record<string, unknown>) => void;
}) {
  const statuses = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
    { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700' },
    { value: 'ended', label: 'Ended', color: 'bg-red-100 text-red-700' },
    { value: 'archived', label: 'Archived', color: 'bg-amber-100 text-amber-700' },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h3 className="font-semibold text-slate-800">Bulk Status Change — {ids.length} listings</h3>

      <div className="flex gap-3">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => onExecute({ status: s.value })}
            disabled={processing}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${s.color} hover:opacity-80`}
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
            Set to {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    draft: 'bg-slate-100 text-slate-600',
    ended: 'bg-red-100 text-red-700',
    archived: 'bg-amber-100 text-amber-700',
    pending: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? colors.draft}`}>
      {status}
    </span>
  );
}
