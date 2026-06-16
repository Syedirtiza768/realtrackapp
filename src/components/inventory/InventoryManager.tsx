import { useState, useCallback, useMemo } from 'react';
import {
  Package,
  Upload,
  Search,
  ExternalLink,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Filter,
  Car,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { fetchWithAuth } from '../../lib/authApi';
import { publishListingIdsToEbay } from '../../lib/publishApi';
import { getStoresByChannel } from '../../lib/multiStoreApi';

/* -- Types -- */

interface InventoryItem {
  id: string;
  sku: string;
  title: string;
  brand: string;
  price: number;
  quantity: number;
  condition: string;
  imageUrl: string;
  imageUrls: string[];
  categoryName: string;
  status: 'draft' | 'ready' | 'publishing' | 'published' | 'error';
  ebayListingId?: string;
  fitmentCount: number;
  missingFields: string[];
  errorMessage?: string;
}

/* -- Simulated API (replace with real API calls) -- */

const API_BASE = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchWithAuth<T>(`${API_BASE}${path}`, init);
}

async function fetchInventory(
  page: number,
  limit: number,
  filters: { status?: string; search?: string; missingImages?: boolean },
): Promise<{ items: InventoryItem[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.missingImages) params.set('missingImages', 'true');
  return apiFetch(`/inventory/listings?${params.toString()}`);
}

/* -- Status Badge -- */

function StatusBadge({ status }: { status: InventoryItem['status'] }) {
  const config: Record<string, { variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    ready: { variant: 'default', label: 'Ready' },
    publishing: { variant: 'warning', label: 'Publishing...' },
    published: { variant: 'success', label: 'Published' },
    error: { variant: 'destructive', label: 'Error' },
  };
  const cfg = config[status] ?? { variant: 'secondary', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/* -- Main Component -- */

export default function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [missingImagesFilter, setMissingImagesFilter] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<Array<{ id: string; success: boolean; error?: string }> | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const limit = 25;

  /* -- Load inventory -- */
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchInventory(page, limit, {
        status: statusFilter || undefined,
        search: search || undefined,
        missingImages: missingImagesFilter || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, search, missingImagesFilter]);

  /* -- Publish selected items -- */
  const handlePublish = useCallback(async () => {
    if (selected.size === 0) return;
    setPublishing(true);
    setPublishResults(null);
    try {
      const stores = await getStoresByChannel('ebay');
      if (!stores.length) {
        throw new Error('No eBay stores connected. Connect a store in Channels first.');
      }
      const storeIds = stores.map((s) => s.id);
      const batch = await publishListingIdsToEbay(Array.from(selected), storeIds);
      const flat = batch.flatMap((entry) =>
        entry.results.map((r) => ({
          id: entry.listingId,
          success: r.success,
          error: r.error,
          listingId: r.listingId,
        })),
      );
      setPublishResults(flat);
      setItems((prev) =>
        prev.map((item) => {
          const res = flat.find((r) => r.id === item.id);
          if (!res) return item;
          return {
            ...item,
            status: res.success ? ('published' as const) : ('error' as const),
            errorMessage: res.error,
            ebayListingId: res.listingId ?? item.ebayListingId,
          };
        }),
      );
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [selected]);

  /* -- Selection helpers -- */
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const readyToPublish = useMemo(
    () => items.filter(i => selected.has(i.id) && i.missingFields.length === 0 && i.status !== 'published'),
    [items, selected],
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-400" />
            Inventory Manager
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            View, validate, and publish listings to eBay directly from the app
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadInventory}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            <Search className="h-4 w-4" />
            Load Inventory
          </button>
          {selected.size > 0 && (
            <button
              onClick={handlePublish}
              disabled={publishing || readyToPublish.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Publish {readyToPublish.length} to eBay
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search by SKU, title, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="published">Published</option>
              <option value="error">Error</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={missingImagesFilter}
                onChange={(e) => setMissingImagesFilter(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
              />
              <ImageIcon className="h-4 w-4 text-amber-400" />
              Missing Images Only
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Publish results */}
      {publishResults && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {publishResults.filter(r => r.success).length > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-900/20 border border-emerald-900/50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm">
                    {publishResults.filter(r => r.success).length} listing(s) published successfully
                  </span>
                </div>
              )}
              {publishResults.filter(r => !r.success).map(r => (
                <div key={r.id} className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/50">
                  <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
                  <div>
                    <span className="text-red-400 text-sm font-medium">Failed: {r.id}</span>
                    {r.error && <p className="text-red-400/80 text-xs mt-1">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/50">
          <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Inventory table */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-300">
                {total} listing{total !== 1 ? 's' : ''} found
                {selected.size > 0 && (
                  <span className="ml-2 text-blue-400">({selected.size} selected)</span>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-left">
                    <th className="pb-3 pr-3 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={toggleAll}
                        className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
                      />
                    </th>
                    <th className="pb-3 pr-3 w-16">Image</th>
                    <th className="pb-3 pr-3">SKU / Title</th>
                    <th className="pb-3 pr-3">Brand</th>
                    <th className="pb-3 pr-3">Price</th>
                    <th className="pb-3 pr-3">Qty</th>
                    <th className="pb-3 pr-3">
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" /> Fitments
                      </span>
                    </th>
                    <th className="pb-3 pr-3">Validation</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100/30 dark:bg-slate-800/30 transition-colors"
                    >
                      {/* Checkbox */}
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
                        />
                      </td>

                      {/* Image thumbnail */}
                      <td className="py-3 pr-3">
                        {item.imageUrl && !item.imageUrl.includes('unsplash.com') ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded border border-amber-600/50 bg-amber-900/20 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-amber-400" />
                          </div>
                        )}
                      </td>

                      {/* SKU & Title */}
                      <td className="py-3 pr-3 max-w-[300px]">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{item.sku}</div>
                        <div className="text-slate-600 dark:text-slate-200 truncate" title={item.title}>{item.title}</div>
                        {item.categoryName && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.categoryName}</div>
                        )}
                      </td>

                      {/* Brand */}
                      <td className="py-3 pr-3">
                        <span className={item.brand === 'Generic' ? 'text-amber-400' : 'text-slate-600 dark:text-slate-200'}>
                          {item.brand}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-200">
                        ${item.price.toFixed(2)}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-200">
                        {item.quantity}
                      </td>

                      {/* Fitment count */}
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                          item.fitmentCount > 0
                            ? 'bg-blue-900/30 text-blue-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          <Car className="h-3 w-3" />
                          {item.fitmentCount}
                        </span>
                      </td>

                      {/* Validation */}
                      <td className="py-3 pr-3">
                        {item.missingFields.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <button
                            onClick={() => {
                              setExpandedErrors(prev => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            className="flex items-center gap-1 text-amber-400"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs">{item.missingFields.length}</span>
                            {expandedErrors.has(item.id) ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )}
                        {expandedErrors.has(item.id) && item.missingFields.length > 0 && (
                          <div className="mt-1 text-xs text-amber-400/80 space-y-0.5">
                            {item.missingFields.map((f, i) => (
                              <div key={i}>� {f}</div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 pr-3">
                        <StatusBadge status={item.status} />
                        {item.errorMessage && (
                          <div className="text-xs text-red-400 mt-1 max-w-[150px] truncate" title={item.errorMessage}>
                            {item.errorMessage}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {item.ebayListingId && (
                            <a
                              href={`https://www.ebay.com/itm/${item.ebayListingId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                              title="View on eBay"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {item.status !== 'published' && item.missingFields.length === 0 && (
                            <button
                              onClick={() => {
                                setSelected(new Set([item.id]));
                                handlePublish();
                              }}
                              className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                            >
                              Publish
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200 text-xs disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200 text-xs disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-slate-500 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Click "Load Inventory" to view your catalog listings.
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              You can validate, select, and publish listings to eBay directly from here.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
