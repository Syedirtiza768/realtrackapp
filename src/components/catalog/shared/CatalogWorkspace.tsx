import { Download, Loader2, RefreshCw, Search, Send, SlidersHorizontal, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { fetchWithAuth } from '../../../lib/authApi';
import CatalogActiveFilterTags from './CatalogActiveFilterTags';
import CatalogFilterControls from './CatalogFilterControls';
import CatalogProductQuickView from './CatalogProductQuickView';
import CatalogResultsTable from './CatalogResultsTable';
import { bulkCatalog, downloadCatalogCsv, filtersToParams, getCatalog, getCatalogFacets, getCatalogSuggestions, paramsToFilters } from './catalogApi';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogFacets, CatalogFilters, CatalogItem, CatalogResponse, CatalogSort, FacetBucket, ProductVertical } from './catalogTypes';
import { EMPTY_CATALOG_FILTERS } from './catalogTypes';

type Props = { config: CatalogConfig };
type Account = { id: string; storeId: string; storeName: string; status?: string; connectionStatus?: string; marketplaceId?: string | null };
type Job = { id: string; status: string; targets?: Array<{ id?: string; status?: string; errorMessage?: string; lastErrorMessage?: string }> };
type WorkspaceState = { q: string; input: string; page: number; pageSize: number; sort: CatalogSort; filters: CatalogFilters };

const PAGE_SIZES = [25, 50, 100, 250, 500];
const TERMINAL_JOB_STATES = new Set(['completed', 'failed', 'partial', 'cancelled']);
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';
const verticalSlug = (vertical: ProductVertical) => vertical === 'business_industrial' ? 'business-industrial' : vertical;

function readState(config: CatalogConfig, searchParams: URLSearchParams): WorkspaceState {
  const urlFilters = paramsToFilters(searchParams);
  let stored: Partial<WorkspaceState> = {};
  try {
    const raw = sessionStorage.getItem('catalog-workspace:' + config.vertical);
    stored = raw ? JSON.parse(raw) as Partial<WorkspaceState> : {};
  } catch { /* ignore stale session state */ }
  const hasUrl = Array.from(searchParams.keys()).length > 0;
  const filters = hasUrl ? { ...EMPTY_CATALOG_FILTERS, ...urlFilters } : { ...EMPTY_CATALOG_FILTERS, ...(stored.filters || {}) };
  return {
    q: searchParams.get('q') ?? (hasUrl ? '' : stored.q ?? ''),
    input: searchParams.get('q') ?? (hasUrl ? '' : stored.input ?? stored.q ?? ''),
    page: Number(searchParams.get('page') || (!hasUrl ? stored.page : 0) || 0),
    pageSize: Number(searchParams.get('pageSize') || (!hasUrl ? stored.pageSize : 25) || 25),
    sort: (searchParams.get('sort') || (!hasUrl ? stored.sort : 'newest') || 'newest') as CatalogSort,
    filters,
  };
}

function queryForExport(state: WorkspaceState) {
  return { q: state.q || undefined, sort: state.sort, ...filtersToParams(state.filters) };
}

function updateItem(response: CatalogResponse | null, item: CatalogItem) {
  if (!response) return response;
  return { ...response, items: response.items.map((current) => current.id === item.id ? item : current) };
}

export default function CatalogWorkspace({ config }: Props) {
  const { activeOrganizationId, permissions } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialState = useRef<WorkspaceState | null>(null);
  if (!initialState.current) initialState.current = readState(config, searchParams);
  const [state, setState] = useState<WorkspaceState>(initialState.current);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ label: string; value: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [publishStore, setPublishStore] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [teamTarget, setTeamTarget] = useState('');
  const [shippingProfile, setShippingProfile] = useState('');
  const [paymentProfile, setPaymentProfile] = useState('');
  const [returnProfile, setReturnProfile] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const filtersSignature = JSON.stringify(state.filters);
  const canPublish = permissions.includes(config.vertical + '.publish');
  const canExport = permissions.includes(config.vertical + '.catalog.export');
  const canDelete = permissions.includes(config.vertical + '.catalog.delete');
  const canAssignTeam = permissions.includes(config.vertical + '.catalog.assign_team');
  const canManagePolicies = permissions.includes(config.vertical + '.catalog.manage_policies');
  const activeStores = accounts.filter((account) => (account.status || account.connectionStatus) === 'active');
  const selectedCount = selected.size;

  useEffect(() => {
    try { sessionStorage.setItem('catalog-workspace:' + config.vertical, JSON.stringify(state)); } catch { /* ignore storage quota */ }
    const next = new URLSearchParams();
    if (state.q) next.set('q', state.q);
    if (state.page) next.set('page', String(state.page));
    if (state.pageSize !== 25) next.set('pageSize', String(state.pageSize));
    if (state.sort !== 'newest') next.set('sort', state.sort);
    for (const [key, value] of Object.entries(filtersToParams(state.filters))) if (value !== undefined && value !== '') next.set(key, String(value));
    setSearchParams(next, { replace: true });
  }, [config.vertical, filtersSignature, state.q, state.page, state.pageSize, state.sort, setSearchParams]);

  useEffect(() => {
    setSelected(new Set());
  }, [filtersSignature, state.q, state.sort, state.pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void getCatalog(config, { q: state.q, page: state.page, pageSize: state.pageSize, sort: state.sort, filters: state.filters }, controller.signal)
      .then(setData)
      .catch((reason: unknown) => { if ((reason as Error)?.name !== 'AbortError') setError(messageOf(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [config, state.q, state.page, state.pageSize, state.sort, filtersSignature]);

  useEffect(() => {
    const controller = new AbortController();
    void getCatalogFacets(config, { q: state.q, sort: state.sort, filters: state.filters }, controller.signal).then(setFacets).catch(() => undefined);
    return () => controller.abort();
  }, [config, state.q, state.sort, filtersSignature]);

  useEffect(() => {
    const value = state.input.trim();
    if (!value) { setSuggestions([]); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void getCatalogSuggestions(config, value, controller.signal).then((result) => setSuggestions(result.suggestions)).catch(() => undefined); }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [config, state.input]);

  useEffect(() => {
    const endpoint = '/api/' + verticalSlug(config.vertical) + '/ebay/accounts' + (activeOrganizationId ? '?organizationId=' + encodeURIComponent(activeOrganizationId) : '');
    void fetchWithAuth<Account[] | { items?: Account[]; accounts?: Account[] }>(endpoint)
      .then((result) => {
        const next = Array.isArray(result) ? result : result.accounts || result.items || [];
        setAccounts(next);
        setPublishStore((current) => current && next.some((account) => account.storeId === current) ? current : next.find((account) => (account.status || account.connectionStatus) === 'active')?.storeId || '');
      })
      .catch(() => setAccounts([]));
  }, [config.vertical, activeOrganizationId]);

  useEffect(() => {
    if (!job || TERMINAL_JOB_STATES.has(job.status)) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await fetchWithAuth<Job>('/api/' + verticalSlug(config.vertical) + '/ebay/listing-jobs/' + job.id + (activeOrganizationId ? '?organizationId=' + encodeURIComponent(activeOrganizationId) : ''));
        if (!cancelled) setJob(result);
      } catch (reason) { if (!cancelled) setMessage(messageOf(reason)); }
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 2500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [job?.id, job?.status, config.vertical, activeOrganizationId]);

  const setFilters = (patch: Partial<CatalogFilters>) => setState((current) => ({ ...current, page: 0, filters: { ...current.filters, ...patch } }));
  const submitSearch = (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    const value = state.input.trim();
    setState((current) => ({ ...current, q: value, page: 0, sort: value ? 'relevance' : 'newest' }));
    if (value) {
      try {
        const key = 'catalog-recent-searches:' + config.vertical;
        const recent = JSON.parse(sessionStorage.getItem(key) || '[]') as string[];
        sessionStorage.setItem(key, JSON.stringify([value, ...recent.filter((item) => item !== value)].slice(0, 8)));
      } catch { /* ignore storage errors */ }
    }
  };
  const resetFilters = () => setState((current) => ({ ...current, page: 0, q: '', input: '', sort: 'newest', filters: { ...EMPTY_CATALOG_FILTERS } }));
  const toggleSelected = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const togglePage = () => setSelected((current) => { const next = new Set(current); const ids = data?.items.map((item) => item.id) || []; if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id)); return next; });
  const refresh = () => setState((current) => ({ ...current }));
  const editItem = (item: CatalogItem) => navigate(config.editorUrl(item.id));
  const saveItem = (item: CatalogItem) => { setData((current) => updateItem(current, item)); setActiveItem(item); };

  const runBulk = async (action: 'team' | 'policies' | 'delete') => {
    if (!selected.size) return;
    if (action === 'delete' && !window.confirm('Delete the selected catalog records? Marketplace publications must be withdrawn first.')) return;
    setMessage('');
    try {
      const body: Record<string, unknown> = { organizationId: activeOrganizationId || undefined, productIds: [...selected] };
      if (action === 'team') body.teamId = teamTarget || null;
      if (action === 'policies') { if (shippingProfile) body.shippingProfile = shippingProfile; if (paymentProfile) body.paymentProfile = paymentProfile; if (returnProfile) body.returnProfile = returnProfile; }
      const result = await bulkCatalog(config, action, body);
      setMessage(result.failed ? result.succeeded + ' succeeded, ' + result.failed + ' failed.' : result.succeeded + ' record(s) updated.');
      setSelected(new Set());
      refresh();
    } catch (reason) { setMessage(messageOf(reason)); }
  };

  const startPublish = async (ids: string[]) => {
    if (!publishStore) { setMessage('Choose an active eBay store before publishing.'); return; }
    setMessage('');
    try {
      const result = await fetchWithAuth<{ jobId: string; status: string }>('/api/' + verticalSlug(config.vertical) + '/ebay/listings/publish-bulk', { method: 'POST', body: JSON.stringify({ organizationId: activeOrganizationId || undefined, listingIds: ids, storeIds: [publishStore], idempotencyKey: config.vertical + '-catalog-' + Date.now() }) });
      setJob({ id: result.jobId, status: result.status });
      setMessage('Publish job submitted. Progress will update here.');
    } catch (reason) { setMessage(messageOf(reason)); }
  };

  const exportRecords = async () => {
    if (!canExport) return;
    try {
      const blob = await downloadCatalogCsv(config, queryForExport(state), selected.size ? [...selected] : undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = verticalSlug(config.vertical) + '-catalog.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setMessage(messageOf(reason)); }
  };

  const recentSearches = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('catalog-recent-searches:' + config.vertical) || '[]') as string[]; } catch { return []; }
  }, [config.vertical, state.q]);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const teamBuckets = (facets?.teams || []) as FacetBucket[];
  const hasNext = Boolean(data?.nextCursor);

  return (
    <div className="min-h-full space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{config.label}</p><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Catalog</h1><p className="mt-1 text-sm text-slate-500">Search, review, edit, publish, and export the complete server-side catalog.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowFilters((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 lg:hidden"><SlidersHorizontal size={16} /> Filters</button><button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><RefreshCw size={16} /> Refresh</button>{canExport ? <button type="button" onClick={() => void exportRecords()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"><Download size={16} /> Export {selectedCount ? 'selected' : 'filtered'}</button> : null}</div></div>
      <form onSubmit={submitSearch} className="relative flex max-w-3xl gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} placeholder="Search SKU, title, brand, MPN, category, attributes…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white" aria-label="Search catalog" list="catalog-suggestions" /><datalist id="catalog-suggestions">{suggestions.map((suggestion) => <option key={suggestion.label} value={suggestion.value}>{suggestion.label}</option>)}</datalist></div><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Search</button></form>
      {recentSearches.length && !state.q ? <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Recent:</span>{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => setState((current) => ({ ...current, input: recent, q: recent, sort: 'relevance', page: 0 }))} className="rounded-full bg-slate-100 px-2.5 py-1 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">{recent}</button>)}</div> : null}
      <CatalogActiveFilterTags config={config} filters={state.filters} onChange={setFilters} />
      {message ? <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss message"><X size={16} /></button></div> : null}
      {job ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">{!TERMINAL_JOB_STATES.has(job.status) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Publish job: {job.status}</div><button type="button" onClick={() => setJob(null)} className="text-slate-400 hover:text-slate-700" aria-label="Close publish progress"><X size={16} /></button></div>{job.targets?.length ? <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">{job.targets.map((target, index) => <div key={target.id || index} className="flex justify-between rounded bg-slate-50 px-2 py-1 dark:bg-slate-800"><span>Target {index + 1}</span><span>{target.status || 'pending'}{target.errorMessage || target.lastErrorMessage ? ': ' + (target.errorMessage || target.lastErrorMessage) : ''}</span></div>)}</div> : null}</div> : null}
      <div className="flex items-start gap-4">
        <div className={showFilters ? 'block lg:block' : 'hidden lg:block'}><CatalogFilterControls config={config} filters={state.filters} facets={facets} onChange={setFilters} onReset={resetFilters} /></div>
        <main className="min-w-0 flex-1 space-y-3">
          {selectedCount ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/20"><span className="mr-2 text-sm font-medium text-blue-900 dark:text-blue-100">{selectedCount} selected</span>{canAssignTeam ? <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><Users size={14} /><select value={teamTarget} onChange={(event) => setTeamTarget(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"><option value="">Unassigned</option>{teamBuckets.map((bucket) => <option key={bucket.value} value={bucket.value}>{bucket.label || bucket.value}</option>)}</select><button type="button" onClick={() => void runBulk('team')} className="rounded bg-white px-2 py-1.5 font-medium text-slate-700 shadow-sm">Assign</button></label> : null}{canManagePolicies ? <details className="text-xs"><summary className="cursor-pointer rounded bg-white px-2 py-1.5 font-medium text-slate-700 shadow-sm">Policies</summary><div className="mt-2 flex flex-wrap gap-1 rounded bg-white p-2 shadow"><input value={shippingProfile} onChange={(event) => setShippingProfile(event.target.value)} placeholder="Shipping" className="w-24 rounded border px-2 py-1" /><input value={paymentProfile} onChange={(event) => setPaymentProfile(event.target.value)} placeholder="Payment" className="w-24 rounded border px-2 py-1" /><input value={returnProfile} onChange={(event) => setReturnProfile(event.target.value)} placeholder="Returns" className="w-24 rounded border px-2 py-1" /><button type="button" onClick={() => void runBulk('policies')} className="rounded bg-slate-900 px-2 py-1 text-white">Apply</button></div></details> : null}{canPublish ? <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><Send size={14} /><select value={publishStore} onChange={(event) => setPublishStore(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"><option value="">Choose store</option>{activeStores.map((account) => <option key={account.storeId} value={account.storeId}>{account.storeName}</option>)}</select><button type="button" onClick={() => void startPublish([...selected])} className="rounded bg-emerald-600 px-2 py-1.5 font-medium text-white">Publish</button></label> : null}{canExport ? <button type="button" onClick={() => void exportRecords()} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm"><Download size={14} /> Export</button> : null}{canDelete ? <button type="button" onClick={() => void runBulk('delete')} className="rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white">Delete</button> : null}<button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded p-1 text-slate-500" aria-label="Clear selection"><X size={16} /></button></div> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{loading ? 'Loading…' : (data?.total ?? 0).toLocaleString() + ' result(s)'}{facets ? ' · facets from ' + facets.totalFiltered.toLocaleString() + ' matched records' : ''}</span><div className="flex items-center gap-2"><label>Sort <select value={state.sort} onChange={(event) => setState((current) => ({ ...current, page: 0, sort: event.target.value as CatalogSort }))} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="updated">Updated</option><option value="title_asc">Title A–Z</option><option value="title_desc">Title Z–A</option><option value="sku_asc">SKU</option><option value="price_asc">Price low</option><option value="price_desc">Price high</option></select></label><label>Rows <select value={state.pageSize} onChange={(event) => setState((current) => ({ ...current, page: 0, pageSize: Number(event.target.value) }))} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div></div>
          <CatalogResultsTable config={config} items={data?.items || []} selected={selected} loading={loading} error={error} canPublish={canPublish} onRetry={refresh} onToggle={toggleSelected} onTogglePage={togglePage} onView={setActiveItem} onEdit={editItem} onPublish={(item) => void startPublish([item.id])} />
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><button type="button" disabled={state.page === 0 || loading} onClick={() => setState((current) => ({ ...current, page: Math.max(0, current.page - 1) }))} className="rounded px-3 py-1.5 font-medium text-slate-600 disabled:opacity-40 dark:text-slate-300">Previous</button><span className="text-xs text-slate-500">Page {state.page + 1} of {pageCount}</span><button type="button" disabled={!hasNext || loading} onClick={() => setState((current) => ({ ...current, page: current.page + 1 }))} className="rounded px-3 py-1.5 font-medium text-slate-600 disabled:opacity-40 dark:text-slate-300">Next</button></div>
        </main>
      </div>
      <CatalogProductQuickView config={config} item={activeItem} onClose={() => setActiveItem(null)} onSaved={saveItem} />
    </div>
  );
}
