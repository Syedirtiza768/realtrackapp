import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Search,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Car,
  Workflow,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  useInventoryListings,
  useInventoryPartLookup,
  useInventoryBulkPartLookup,
  useSendToPipeline,
  type InventoryListingItem,
} from '../../lib/inventoryApi';
import { usePermissions } from '../../hooks/usePermissions';
import InventoryDetailModal from './InventoryDetailModal';

function StatusBadge({ status }: { status: InventoryListingItem['status'] }) {
  const config: Record<
    string,
    { variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary'; label: string }
  > = {
    draft: { variant: 'secondary', label: 'Draft' },
    ready: { variant: 'default', label: 'Ready' },
    publishing: { variant: 'warning', label: 'Publishing...' },
    published: { variant: 'success', label: 'Published' },
    error: { variant: 'destructive', label: 'Error' },
  };
  const cfg = config[status] ?? { variant: 'secondary', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function marketplaceSummary(item: InventoryListingItem): string {
  const mkts = (item.marketplaceVariants ?? [])
    .map((v) => v.marketplace)
    .filter((m): m is string => Boolean(m));
  if (mkts.length === 0) return '—';
  return [...new Set(mkts)].join(', ');
}

export default function InventoryManager() {
  const navigate = useNavigate();
  const { has: canEnrich } = usePermissions();
  const canFetchDetails = canEnrich('inventory.enrich');
  const canSendToPipeline = canFetchDetails;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [missingImagesFilter, setMissingImagesFilter] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lookupRowId, setLookupRowId] = useState<string | null>(null);
  const [requeueWarning, setRequeueWarning] = useState<string | null>(null);
  const [pendingSend, setPendingSend] = useState<string[] | null>(null);
  const limit = 25;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useInventoryListings({
    page,
    limit,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    missingImages: missingImagesFilter || undefined,
  });

  const sendMutation = useSendToPipeline();
  const partLookup = useInventoryPartLookup();
  const bulkPartLookup = useInventoryBulkPartLookup();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const selectedWithPriorJob = selectedItems.filter((i) => i.hasCompletedPipelineJob === true);

  const executeSendToPipeline = useCallback(
    async (listingIds: string[]) => {
      setActionError(null);
      setRequeueWarning(null);
      setPendingSend(null);
      try {
        const { job, warnings } = await sendMutation.mutateAsync(listingIds);
        setSelected(new Set());
        navigate(`/pipeline?job=${job.id}`);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to send to pipeline');
      }
    },
    [sendMutation, navigate],
  );

  const handleSendToPipeline = useCallback(() => {
    if (!canSendToPipeline || selected.size === 0) return;

    const ids = Array.from(selected);
    if (selectedWithPriorJob.length > 0) {
      const skus = selectedWithPriorJob.map((i) => i.sku || i.id).join(', ');
      setRequeueWarning(
        `${selectedWithPriorJob.length} selected part(s) were previously enriched (${skus}). A new pipeline job will be created.`,
      );
      setPendingSend(ids);
      return;
    }

    void executeSendToPipeline(ids);
  }, [canSendToPipeline, selected, selectedWithPriorJob, executeSendToPipeline]);

  const confirmRequeue = useCallback(() => {
    if (pendingSend) void executeSendToPipeline(pendingSend);
  }, [pendingSend, executeSendToPipeline]);

  const handleFetchDetails = useCallback(
    async (listingId: string) => {
      if (!canFetchDetails) return;
      setActionError(null);
      setLookupRowId(listingId);
      try {
        await partLookup.mutateAsync(listingId);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Fetch details failed');
      } finally {
        setLookupRowId(null);
      }
    },
    [canFetchDetails, partLookup],
  );

  const handleBulkFetchDetails = useCallback(async () => {
    if (!canFetchDetails || selected.size === 0) return;
    setActionError(null);
    try {
      const result = await bulkPartLookup.mutateAsync(Array.from(selected));
      const failed = result.results.filter((r) => !r.success);
      if (failed.length > 0) {
        setActionError(
          `${failed.length} fetch failed: ${failed.map((f) => f.error).filter(Boolean).join('; ')}`,
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Bulk fetch details failed');
    }
  }, [canFetchDetails, selected, bulkPartLookup]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
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
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-400" />
            Inventory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fetch details from OEM, brand, and photos — then send to the enrichment pipeline (US / AU / DE)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canFetchDetails && selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleBulkFetchDetails}
                disabled={bulkPartLookup.isPending || sendMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors disabled:opacity-50"
              >
                {bulkPartLookup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Fetch details ({selected.size})
              </button>
              <button
                type="button"
                onClick={handleSendToPipeline}
                disabled={sendMutation.isPending || bulkPartLookup.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to pipeline ({selected.size})
              </button>
            </>
          )}
        </div>
      </div>

      {requeueWarning && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-300 font-medium">Re-queue enrichment?</p>
                  <p className="text-xs text-amber-400/90 mt-1">{requeueWarning}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setRequeueWarning(null);
                    setPendingSend(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRequeue}
                  disabled={sendMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search by SKU, title, brand, OEM..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="published">Published</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={missingImagesFilter}
                onChange={(e) => {
                  setMissingImagesFilter(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
              />
              <ImageIcon className="h-4 w-4 text-amber-400" />
              Missing Images Only
            </label>
          </div>
        </CardContent>
      </Card>

      {(actionError || loadError) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/50">
          <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
          <p className="text-red-400 text-sm">
            {actionError ??
              (loadError instanceof Error ? loadError.message : 'Failed to load inventory')}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-300">
                {total} part{total !== 1 ? 's' : ''} (one row per SKU)
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
                    <th className="pb-3 pr-3">Marketplaces</th>
                    <th className="pb-3 pr-3">
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" /> Fitments
                      </span>
                    </th>
                    <th className="pb-3 pr-3">Validation</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Pipeline</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setDetailId(item.id)}
                    >
                      <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        {item.imageUrl ? (
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
                      <td className="py-3 pr-3 max-w-[300px]">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {item.sku}
                          {item.intakeSource && (
                            <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                              Intake
                            </Badge>
                          )}
                          {item.hasCompletedPipelineJob && (
                            <Badge variant="warning" className="ml-2 text-[10px] py-0">
                              Enriched
                            </Badge>
                          )}
                        </div>
                        <div
                          className="text-slate-600 dark:text-slate-200 truncate"
                          title={item.title}
                        >
                          {item.title}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={
                            item.brand === 'Generic'
                              ? 'text-amber-400'
                              : 'text-slate-600 dark:text-slate-200'
                          }
                        >
                          {item.brand}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-500 dark:text-slate-400">
                        {marketplaceSummary(item)}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                            item.fitmentCount > 0
                              ? 'bg-blue-900/30 text-blue-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <Car className="h-3 w-3" />
                          {item.fitmentCount}
                        </span>
                      </td>
                      <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                        {item.missingFields.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedErrors((prev) => {
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
                            {item.missingFields.map((f) => (
                              <div key={f}>{f}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                        {item.pipelineJobId ? (
                          <Link
                            to={`/pipeline?job=${item.pipelineJobId}`}
                            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-mono"
                          >
                            <Workflow className="h-3 w-3" />
                            {item.pipelineJobId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3" onClick={(e) => e.stopPropagation()}>
                        {canFetchDetails && (
                          <button
                            type="button"
                            onClick={() => handleFetchDetails(item.id)}
                            disabled={
                              lookupRowId === item.id ||
                              partLookup.isPending ||
                              bulkPartLookup.isPending
                            }
                            className="text-xs px-2 py-1 rounded bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-50"
                            title="Vision lookup: OEM + brand + photos"
                          >
                            {lookupRowId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin inline" />
                            ) : (
                              'Fetch'
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200 text-xs disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      {!isLoading && items.length === 0 && !loadError && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-slate-500 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">No parts in inventory yet.</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Use{' '}
              <Link to="/listings/new" className="text-blue-400 hover:underline">
                Add Part
              </Link>{' '}
              for warehouse intake, then send parts to the pipeline from here.
            </p>
          </CardContent>
        </Card>
      )}

      <InventoryDetailModal
        listingId={detailId}
        onClose={() => setDetailId(null)}
        canFetchDetails={canFetchDetails}
      />
    </div>
  );
}
