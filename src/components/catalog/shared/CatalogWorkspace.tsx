import { Download, Loader2, PlusCircle, RefreshCw, Search, Send, Shield, SlidersHorizontal, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { fetchWithAuth } from '../../../lib/authApi';
import CatalogActiveFilterTags from './CatalogActiveFilterTags';
import CatalogFilterControls from './CatalogFilterControls';
import CatalogProductQuickView from './CatalogProductQuickView';
import BusinessIndustrialPublishModal, { type BusinessIndustrialAccount } from './BusinessIndustrialPublishModal';
import CatalogResultsTable from './CatalogResultsTable';
import { bulkCatalog, downloadCatalogCsv, filtersToParams, getCatalog, getCatalogFacets, getCatalogSuggestions, getCatalogSummary, paramsToFilters } from './catalogApi';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogFacets, CatalogFilters, CatalogItem, CatalogResponse, CatalogSort, CatalogSummary, FacetBucket, ProductVertical } from './catalogTypes';
import { EMPTY_CATALOG_FILTERS } from './catalogTypes';

type Props = { config: CatalogConfig };
type Account = BusinessIndustrialAccount;
type PublishTarget = { id?: string; status?: string; errorMessage?: string; lastErrorMessage?: string; errorPayload?: { message?: unknown; errors?: unknown } | null };
type Job = { id: string; status: string; targets?: PublishTarget[]; targetCount?: number; dailyRemaining?: number };
type WorkspaceState = { q: string; input: string; page: number; pageSize: number; sort: CatalogSort; filters: CatalogFilters };

const PAGE_SIZES = [25, 50, 100, 250, 500];
const TERMINAL_JOB_STATES = new Set(['completed', 'completed_with_errors', 'failed', 'partial', 'cancelled']);
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';
const verticalSlug = (vertical: ProductVertical) => vertical === 'business_industrial' ? 'business-industrial' : vertical;
function targetError(target: PublishTarget) {
  if (target.errorMessage || target.lastErrorMessage) return target.errorMessage || target.lastErrorMessage || '';
  const payload = target.errorPayload;
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
  if (Array.isArray(payload?.errors)) return payload.errors.map((error) => typeof error === 'string' ? error : (error as { message?: unknown })?.message).filter((error): error is string => typeof error === 'string' && error.trim().length > 0).join('; ');
  return '';
}

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
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
 const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [facetsError, setFacetsError] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ label: string; value: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [publishSelection, setPublishSelection] = useState<{ ids: string[]; item?: CatalogItem } | null>(null);
  const [teamTarget, setTeamTarget] = useState('');
  const [shippingProfile, setShippingProfile] = useState('');
  const [paymentProfile, setPaymentProfile] = useState('');
  const [returnProfile, setReturnProfile] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refreshedJobs = useRef<Set<string>>(new Set());
  const filtersSignature = JSON.stringify(state.filters);
  const canPublish = permissions.includes(config.vertical + '.publish');
  const canExport = permissions.includes(config.vertical + '.catalog.export');
  const canDelete = permissions.includes(config.vertical + '.catalog.delete');
  const canAssignTeam = permissions.includes(config.vertical + '.catalog.assign_team');
  const canManagePolicies = permissions.includes(config.vertical + '.catalog.manage_policies');
  const selectedCount = selected.size;
  const isBusinessIndustrial = config.vertical === 'business_industrial';
  const catalogDescription = isBusinessIndustrial
    ? 'Search, review, assign teams, and manage Business & Industrial inventory.'
    : `Search, review, assign teams, and manage ${config.label.toLowerCase()} inventory.`;
  const addLabel = isBusinessIndustrial ? 'Add Equipment' : `Add ${config.label} item`;

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
  }, [activeOrganizationId, filtersSignature, state.q, state.sort, state.page, state.pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void getCatalog(config, { q: state.q, page: state.page, pageSize: state.pageSize, sort: state.sort, filters: state.filters, organizationId: activeOrganizationId }, controller.signal)
      .then(setData)
      .catch((reason: unknown) => { if ((reason as Error)?.name !== 'AbortError') setError(messageOf(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeOrganizationId, config, state.q, state.page, state.pageSize, state.sort, filtersSignature, refreshNonce]);

  useEffect(() => {
    const controller = new AbortController();
    void getCatalogSummary(config, activeOrganizationId, controller.signal).then(setSummary).catch(() => setSummary(null));
    return () => controller.abort();
  }, [activeOrganizationId, config, refreshNonce]);

 useEffect(() => {
   const controller = new AbortController();
    setFacetsError('');
    void getCatalogFacets(config, { q: state.q, sort: state.sort, filters: state.filters, organizationId: activeOrganizationId }, controller.signal).then((result) => { setFacets(result); setFacetsError(''); }).catch((reason: unknown) => { if ((reason as Error)?.name !== 'AbortError') setFacetsError('Filter options are unavailable. Try Refresh to reload them.'); });
   return () => controller.abort();
  }, [activeOrganizationId, config, state.q, state.sort, filtersSignature, refreshNonce]);

  useEffect(() => {
    const value = state.input.trim();
    if (!value) { setSuggestions([]); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void getCatalogSuggestions(config, value, activeOrganizationId, controller.signal).then((result) => setSuggestions(result.suggestions)).catch(() => undefined); }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeOrganizationId, config, state.input]);

  useEffect(() => {
    const endpoint = '/api/' + verticalSlug(config.vertical) + '/ebay/accounts' + (activeOrganizationId ? '?organizationId=' + encodeURIComponent(activeOrganizationId) : '');
    void fetchWithAuth<Account[] | { items?: Account[]; accounts?: Account[] }>(endpoint)
      .then((result) => {
        const next = Array.isArray(result) ? result : result.accounts || result.items || [];
        setAccounts(next);
      })
      .catch(() => setAccounts([]));
  }, [config.vertical, activeOrganizationId]);

  useEffect(() => {
    if (!job || TERMINAL_JOB_STATES.has(job.status)) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await fetchWithAuth<Job>('/api/' + verticalSlug(config.vertical) + '/ebay/listing-jobs/' + job.id + (activeOrganizationId ? '?organizationId=' + encodeURIComponent(activeOrganizationId) : ''));
        if (!cancelled) {
          if (TERMINAL_JOB_STATES.has(result.status) && !refreshedJobs.current.has(job.id)) {
            refreshedJobs.current.add(job.id);
            setRefreshNonce((current) => current + 1);
          }
          setJob(result);
        }
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
  const refresh = () => setRefreshNonce((current) => current + 1);
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

  const openPublish = (ids: string[], item?: CatalogItem) => {
    if (!ids.length) return;
    const blocked = data?.items.filter((item) => ids.includes(item.id) && (item.publicationStatus === 'blocked' || item.verticalValidationStatus !== 'approved')) ?? [];
    if (blocked.length) {
      setMessage(`${blocked.length} selected record(s) still need compliance approval before publishing.`);
      return;
    }
    setMessage('');
    setPublishSelection({ ids, item: item || data?.items.find((current) => current.id === ids[0]) });
  };

  const handlePublishSubmitted = (result: { jobId: string; status: string; targetCount?: number; dailyRemaining?: number }) => {
    setJob({ id: result.jobId, status: result.status, targetCount: result.targetCount, dailyRemaining: result.dailyRemaining });
    setPublishSelection(null);
    setSelected(new Set());
    setMessage('Publish job submitted. Progress will update here.');
  };

  const exportRecords = async () => {
    if (!canExport) return;
    try {
      const blob = await downloadCatalogCsv(config, queryForExport(state), selected.size ? [...selected] : undefined, activeOrganizationId);
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
    <div className="mx-auto min-h-full max-w-[1920px] space-y-4 px-2 pb-12 sm:px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Catalog</h1><p className="mt-1 text-sm text-slate-500">{catalogDescription}</p>{summary ? <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{summary.total.toLocaleString()} products · {summary.withImages.toLocaleString()} with images · {summary.published.toLocaleString()} published</p> : null}</div><div className="flex shrink-0 flex-wrap items-center gap-2"><button type="button" onClick={() => setShowFilters((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"><SlidersHorizontal size={14} /> Filters</button><button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>{canExport ? <button type="button" onClick={() => void exportRecords()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Download size={14} /> Export {selectedCount ? 'selected' : 'CSV'}</button> : null}{canManagePolicies ? <button type="button" disabled={!selectedCount} onClick={() => selectedCount && void runBulk('policies')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Shield size={14} /> Edit Policies</button> : null}<button type="button" onClick={() => navigate(config.editorUrl())} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white ${isBusinessIndustrial ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-blue-600 hover:bg-blue-700'}`}><PlusCircle size={14} /> {addLabel}</button></div></div>
      <form onSubmit={submitSearch} className="relative flex max-w-3xl gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={state.input} onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))} placeholder="Search SKU, title, brand, MPN, category, attributes…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white" aria-label="Search catalog" list="catalog-suggestions" /><datalist id="catalog-suggestions">{suggestions.map((suggestion) => <option key={suggestion.label} value={suggestion.value}>{suggestion.label}</option>)}</datalist></div><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Search</button></form>
      {recentSearches.length && !state.q ? <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Recent:</span>{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => setState((current) => ({ ...current, input: recent, q: recent, sort: 'relevance', page: 0 }))} className="rounded-full bg-slate-100 px-2.5 py-1 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">{recent}</button>)}</div> : null}
      <CatalogActiveFilterTags config={config} filters={state.filters} facets={facets} onChange={setFilters} />
      {(state.q || JSON.stringify(state.filters) !== JSON.stringify(EMPTY_CATALOG_FILTERS)) && summary ? <div className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs dark:border-cyan-900 dark:bg-cyan-950/30"><span className="font-medium text-cyan-700 dark:text-cyan-300">{(data?.total ?? 0).toLocaleString()}</span><span className="text-cyan-700/80 dark:text-cyan-300/80">of {summary.total.toLocaleString()} products match your filters</span><span className="ml-auto text-[10px] text-cyan-600/70">{data?.queryTimeMs != null ? data.queryTimeMs + 'ms' : null}</span></div> : null}
      {message ? <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss message"><X size={16} /></button></div> : null}
      {job ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">{!TERMINAL_JOB_STATES.has(job.status) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Publish job: {job.status.replace(/_/g, ' ')}{job.targetCount ? <span className="text-xs font-normal text-slate-500">· {job.targetCount} target(s)</span> : null}</div><button type="button" onClick={() => setJob(null)} className="text-slate-400 hover:text-slate-700" aria-label="Close publish progress"><X size={16} /></button></div>{job.dailyRemaining != null ? <p className="mt-1 text-xs text-slate-500">Daily publish capacity remaining: {job.dailyRemaining}</p> : null}{job.targets?.length ? <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">{job.targets.map((target, index) => { const error = targetError(target); const status = target.status || 'pending'; return <div key={target.id || index} className="rounded bg-slate-50 px-2 py-1 dark:bg-slate-800"><div className="flex justify-between gap-2"><span>Target {index + 1}</span><span className={error || status === 'failed' ? 'text-red-600 dark:text-red-300' : status === 'published' ? 'text-emerald-600 dark:text-emerald-300' : status === 'skipped' ? 'text-amber-600 dark:text-amber-300' : undefined}>{status}</span></div>{error ? <p className="mt-1 line-clamp-3 text-red-600 dark:text-red-300" role="alert">{error}</p> : null}</div>; })}</div> : null}</div> : null}
      <div className="flex items-start gap-4">
        <div className={showFilters ? 'block lg:block' : 'hidden lg:block'}><CatalogFilterControls config={config} filters={state.filters} facets={facets} facetsError={facetsError} onChange={setFilters} onReset={resetFilters} /></div>
        <main className="min-w-0 flex-1 space-y-3">
          {selectedCount ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/20"><span className="mr-2 text-sm font-medium text-blue-900 dark:text-blue-100">{selectedCount} selected</span>{canAssignTeam ? <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><Users size={14} /><select value={teamTarget} onChange={(event) => setTeamTarget(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"><option value="">Unassigned</option>{teamBuckets.map((bucket) => <option key={bucket.value} value={bucket.value}>{bucket.label || bucket.value}</option>)}</select><button type="button" onClick={() => void runBulk('team')} className="rounded bg-white px-2 py-1.5 font-medium text-slate-700 shadow-sm">Assign</button></label> : null}{canManagePolicies ? <details className="text-xs"><summary className="cursor-pointer rounded bg-white px-2 py-1.5 font-medium text-slate-700 shadow-sm">Policies</summary><div className="mt-2 flex flex-wrap gap-1 rounded bg-white p-2 shadow"><input value={shippingProfile} onChange={(event) => setShippingProfile(event.target.value)} placeholder="Shipping" className="w-24 rounded border px-2 py-1" /><input value={paymentProfile} onChange={(event) => setPaymentProfile(event.target.value)} placeholder="Payment" className="w-24 rounded border px-2 py-1" /><input value={returnProfile} onChange={(event) => setReturnProfile(event.target.value)} placeholder="Returns" className="w-24 rounded border px-2 py-1" /><button type="button" onClick={() => void runBulk('policies')} className="rounded bg-slate-900 px-2 py-1 text-white">Apply</button></div></details> : null}{canPublish ? <button type="button" onClick={() => openPublish([...selected])} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white"><Send size={14} /> Validate &amp; publish</button> : null}{canExport ? <button type="button" onClick={() => void exportRecords()} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm"><Download size={14} /> Export</button> : null}{canDelete ? <button type="button" onClick={() => void runBulk('delete')} className="rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white">Delete</button> : null}<button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded p-1 text-slate-500" aria-label="Clear selection"><X size={16} /></button></div> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{loading ? 'Loading…' : (data?.total ?? 0).toLocaleString() + ' result(s)'}{facets ? ' · facets from ' + facets.totalFiltered.toLocaleString() + ' matched records' : ''}</span><div className="flex items-center gap-2"><label>Sort <select value={state.sort} onChange={(event) => setState((current) => ({ ...current, page: 0, sort: event.target.value as CatalogSort }))} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="updated">Updated</option><option value="title_asc">Title A–Z</option><option value="title_desc">Title Z–A</option><option value="sku_asc">SKU</option><option value="price_asc">Price low</option><option value="price_desc">Price high</option></select></label><label>Rows <select value={state.pageSize} onChange={(event) => setState((current) => ({ ...current, page: 0, pageSize: Number(event.target.value) }))} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div></div>
          <CatalogResultsTable config={config} items={data?.items || []} selected={selected} loading={loading} error={error} canPublish={canPublish} onRetry={refresh} onToggle={toggleSelected} onTogglePage={togglePage} onView={setActiveItem} onEdit={editItem} onPublish={(item) => openPublish([item.id], item)} />
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><button type="button" disabled={state.page === 0 || loading} onClick={() => setState((current) => ({ ...current, page: Math.max(0, current.page - 1) }))} className="rounded px-3 py-1.5 font-medium text-slate-600 disabled:opacity-40 dark:text-slate-300">Previous</button><span className="text-xs text-slate-500">Page {state.page + 1} of {pageCount}</span><button type="button" disabled={!hasNext || loading} onClick={() => setState((current) => ({ ...current, page: current.page + 1 }))} className="rounded px-3 py-1.5 font-medium text-slate-600 disabled:opacity-40 dark:text-slate-300">Next</button></div>
        </main>
      </div>
          <CatalogProductQuickView config={config} item={activeItem} organizationId={activeOrganizationId} canPublish={canPublish} onClose={() => setActiveItem(null)} onSaved={saveItem} onPublish={(item) => openPublish([item.id], item)} />
      {isBusinessIndustrial ? <BusinessIndustrialPublishModal open={Boolean(publishSelection)} item={publishSelection?.item} listingIds={publishSelection?.ids || []} accounts={accounts} organizationId={activeOrganizationId} onClose={() => setPublishSelection(null)} onSubmitted={handlePublishSubmitted} /> : null}
    </div>
  );
}
