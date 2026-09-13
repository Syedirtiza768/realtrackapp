import { Download, Loader2, PlusCircle, RefreshCw, Search, Send, Shield, SlidersHorizontal, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { fetchWithAuth } from '../../../lib/authApi';
import FeedbackPanel from '../../ui/FeedbackPanel';
import CatalogActiveFilterTags from './CatalogActiveFilterTags';
import CatalogFilterControls, { activeFilterCount } from './CatalogFilterControls';
import CatalogMobileFilterDrawer from './CatalogMobileFilterDrawer';
import CatalogProductQuickView from './CatalogProductQuickView';
import CatalogPublishJobPanel, { isTerminalPublishJob, type CatalogPublishJob } from './CatalogPublishJobPanel';
import BusinessIndustrialPublishModal, { type BusinessIndustrialAccount } from './BusinessIndustrialPublishModal';
import CatalogResultsTable from './CatalogResultsTable';
import { bulkCatalog, downloadCatalogCsv, filtersToParams, getCatalog, getCatalogFacets, getCatalogSuggestions, getCatalogSummary, paramsToFilters } from './catalogApi';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogFacets, CatalogFilters, CatalogItem, CatalogResponse, CatalogSort, CatalogSummary, FacetBucket, ProductVertical } from './catalogTypes';
import { EMPTY_CATALOG_FILTERS } from './catalogTypes';

type Props = { config: CatalogConfig };
type Account = BusinessIndustrialAccount;
type WorkspaceState = { q: string; input: string; page: number; pageSize: number; sort: CatalogSort; filters: CatalogFilters };
type PendingAction = 'export' | 'team' | 'policies' | 'delete' | null;

const PAGE_SIZES = [25, 50, 100, 250, 500];
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

function primaryButtonClass(isBusinessIndustrial: boolean) {
  return isBusinessIndustrial ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-blue-600 hover:bg-blue-700';
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
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [bulkFailures, setBulkFailures] = useState<Array<{ id: string; error?: string }>>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [job, setJob] = useState<CatalogPublishJob | null>(null);
  const [publishSelection, setPublishSelection] = useState<{ ids: string[]; item?: CatalogItem } | null>(null);
  const [teamTarget, setTeamTarget] = useState('');
  const [shippingProfile, setShippingProfile] = useState('');
  const [paymentProfile, setPaymentProfile] = useState('');
  const [returnProfile, setReturnProfile] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
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
  const filterCount = activeFilterCount(state.filters);
  const hasActiveQuery = Boolean(state.q) || filtersSignature !== JSON.stringify(EMPTY_CATALOG_FILTERS);
  const notify = (text: string, tone: typeof messageTone = 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

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
    void getCatalogFacets(config, { q: state.q, sort: state.sort, filters: state.filters, organizationId: activeOrganizationId }, controller.signal)
      .then((result) => { setFacets(result); setFacetsError(''); })
      .catch((reason: unknown) => { if ((reason as Error)?.name !== 'AbortError') setFacetsError('Filter options are unavailable. Try Refresh to reload them.'); });
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
    if (!job || isTerminalPublishJob(job.status)) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await fetchWithAuth<CatalogPublishJob>('/api/' + verticalSlug(config.vertical) + '/ebay/listing-jobs/' + job.id + (activeOrganizationId ? '?organizationId=' + encodeURIComponent(activeOrganizationId) : ''));
        if (!cancelled) {
          if (isTerminalPublishJob(result.status) && !refreshedJobs.current.has(job.id)) {
            refreshedJobs.current.add(job.id);
            setRefreshNonce((current) => current + 1);
          }
          setJob(result);
        }
      } catch (reason) { if (!cancelled) notify(messageOf(reason), 'error'); }
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
    if (!selected.size || pendingAction) return;
    if (action === 'delete' && !window.confirm('Delete the selected catalog records? Marketplace publications must be withdrawn first.')) return;
    setBulkFailures([]);
    setPendingAction(action);
    notify('');
    try {
      const body: Record<string, unknown> = { organizationId: activeOrganizationId || undefined, productIds: [...selected] };
      if (action === 'team') body.teamId = teamTarget || null;
      if (action === 'policies') { if (shippingProfile) body.shippingProfile = shippingProfile; if (paymentProfile) body.paymentProfile = paymentProfile; if (returnProfile) body.returnProfile = returnProfile; }
      const result = await bulkCatalog(config, action, body);
      const failures = (result.results || []).filter((item) => !item.success);
      setBulkFailures(failures.map((item) => ({ id: item.id, error: item.error })));
      notify(
        result.failed ? result.succeeded + ' succeeded, ' + result.failed + ' failed.' : result.succeeded + ' record(s) updated.',
        result.failed ? 'warning' : 'success',
      );
      setSelected(new Set());
      refresh();
    } catch (reason) { notify(messageOf(reason), 'error'); }
    finally { setPendingAction(null); }
  };

  const openPublish = (ids: string[], item?: CatalogItem) => {
    if (!ids.length) return;
    const blocked = data?.items.filter((row) => ids.includes(row.id) && (row.publicationStatus === 'blocked' || row.verticalValidationStatus !== 'approved')) ?? [];
    if (blocked.length) {
      notify(`${blocked.length} selected record(s) still need compliance approval before publishing.`, 'warning');
      return;
    }
    notify('');
    setPublishSelection({ ids, item: item || data?.items.find((current) => current.id === ids[0]) });
  };

  const handlePublishSubmitted = (result: { jobId: string; status: string; targetCount?: number; dailyRemaining?: number }) => {
    setJob({ id: result.jobId, status: result.status, targetCount: result.targetCount, dailyRemaining: result.dailyRemaining });
    setPublishSelection(null);
    setSelected(new Set());
    notify('Publish job submitted. Progress will update here.', 'info');
  };

  const exportRecords = async () => {
    if (!canExport || pendingAction) return;
    setPendingAction('export');
    try {
      const blob = await downloadCatalogCsv(config, queryForExport(state), selected.size ? [...selected] : undefined, activeOrganizationId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = verticalSlug(config.vertical) + '-catalog.csv';
      link.click();
      URL.revokeObjectURL(url);
      notify(selected.size ? 'Exported the selected records.' : 'Exported the current catalog result set.', 'success');
    } catch (reason) { notify(messageOf(reason), 'error'); }
    finally { setPendingAction(null); }
  };

  const recentSearches = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('catalog-recent-searches:' + config.vertical) || '[]') as string[]; } catch { return []; }
  }, [config.vertical, state.q]);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const teamBuckets = (facets?.teams || []) as FacetBucket[];
  const hasNext = Boolean(data?.nextCursor);
  const showingFrom = data ? data.offset + (data.items.length ? 1 : 0) : 0;
  const showingTo = data ? data.offset + data.items.length : 0;
  const toolbarButton = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">{catalogDescription}</p>
          {summary ? <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{summary.total.toLocaleString()} products · {summary.withImages.toLocaleString()} with images · {summary.published.toLocaleString()} published</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowFilters(true)} className={toolbarButton + ' lg:hidden'} aria-expanded={showFilters} aria-controls="catalog-mobile-filters">
            <SlidersHorizontal size={14} aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ''}
          </button>
          <button type="button" onClick={refresh} disabled={loading} className={toolbarButton}>
            <RefreshCw size={14} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" /> Refresh
          </button>
          {canExport ? (
            <button type="button" onClick={() => void exportRecords()} disabled={pendingAction === 'export'} className={toolbarButton}>
              {pendingAction === 'export' ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
              {pendingAction === 'export' ? 'Exporting…' : `Export ${selectedCount ? 'selected' : 'CSV'}`}
            </button>
          ) : null}
          {canManagePolicies ? (
            <button type="button" disabled={!selectedCount || pendingAction === 'policies'} onClick={() => selectedCount && void runBulk('policies')} className={toolbarButton}>
              <Shield size={14} aria-hidden="true" /> {pendingAction === 'policies' ? 'Updating…' : 'Edit Policies'}
            </button>
          ) : null}
          <button type="button" onClick={() => navigate(config.editorUrl())} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white ${primaryButtonClass(isBusinessIndustrial)}`}>
            <PlusCircle size={14} aria-hidden="true" /> {addLabel}
          </button>
        </div>
      </div>

      <form onSubmit={submitSearch} className="relative flex max-w-3xl gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
          <input
            value={state.input}
            onChange={(event) => setState((current) => ({ ...current, input: event.target.value }))}
            placeholder="Search SKU, title, brand, MPN, category, attributes…"
            className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white ${isBusinessIndustrial ? 'focus:border-cyan-500' : 'focus:border-blue-500'}`}
            aria-label="Search catalog"
            list="catalog-suggestions"
          />
          <datalist id="catalog-suggestions">{suggestions.map((suggestion) => <option key={suggestion.label} value={suggestion.value}>{suggestion.label}</option>)}</datalist>
        </div>
        <button type="submit" className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium text-white ${primaryButtonClass(isBusinessIndustrial)}`}>Search</button>
      </form>

      {recentSearches.length && !state.q ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Recent:</span>
          {recentSearches.map((recent) => (
            <button key={recent} type="button" onClick={() => setState((current) => ({ ...current, input: recent, q: recent, sort: 'relevance', page: 0 }))} className="rounded-full bg-slate-100 px-2.5 py-1 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
              {recent}
            </button>
          ))}
        </div>
      ) : null}

      <CatalogActiveFilterTags config={config} filters={state.filters} facets={facets} onChange={setFilters} />

      {hasActiveQuery && summary ? (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs ${isBusinessIndustrial ? 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30' : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'}`}>
          <span className={`font-medium ${isBusinessIndustrial ? 'text-cyan-700 dark:text-cyan-300' : 'text-blue-700 dark:text-blue-300'}`}>{(data?.total ?? 0).toLocaleString()}</span>
          <span className={isBusinessIndustrial ? 'text-cyan-700/80 dark:text-cyan-300/80' : 'text-blue-700/80 dark:text-blue-300/80'}>of {summary.total.toLocaleString()} products match your filters</span>
          <span className={`ml-auto text-[10px] ${isBusinessIndustrial ? 'text-cyan-600/70' : 'text-blue-600/70'}`}>{data?.queryTimeMs != null ? data.queryTimeMs + 'ms' : null}</span>
        </div>
      ) : null}

      {message ? <FeedbackPanel tone={messageTone} onDismiss={() => setMessage('')}>{message}</FeedbackPanel> : null}
      {bulkFailures.length ? (
        <FeedbackPanel tone="warning">
          <p className="font-medium">Record-level bulk failures</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
            {bulkFailures.slice(0, 12).map((item) => (
              <li key={item.id}>{item.id}: {item.error || 'failed'}</li>
            ))}
          </ul>
        </FeedbackPanel>
      ) : null}
      {job ? <CatalogPublishJobPanel job={job} onClose={() => setJob(null)} /> : null}

      <div className="flex items-start gap-4">
        <CatalogFilterControls config={config} filters={state.filters} facets={facets} facetsError={facetsError} onChange={setFilters} onReset={resetFilters} />
        <div className="min-w-0 flex-1 space-y-3">
          {selectedCount ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
              <span className="mr-2 text-sm font-medium text-blue-900 dark:text-blue-100">{selectedCount} selected on this page</span>
              {canAssignTeam ? (
                <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <Users size={14} aria-hidden="true" />
                  <select value={teamTarget} onChange={(event) => setTeamTarget(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800">
                    <option value="">Unassigned</option>
                    {teamBuckets.map((bucket) => <option key={bucket.value} value={bucket.value}>{bucket.label || bucket.value}</option>)}
                  </select>
                  <button type="button" disabled={pendingAction === 'team'} onClick={() => void runBulk('team')} className="rounded bg-white px-2 py-1.5 font-medium text-slate-700 shadow-sm disabled:opacity-50">
                    {pendingAction === 'team' ? 'Assigning…' : 'Assign'}
                  </button>
                </label>
              ) : null}
              {canManagePolicies ? (
                <details className="text-xs">
                  <summary className="cursor-pointer rounded bg-white px-2 py-1.5 font-medium text-slate-700 shadow-sm">Policies</summary>
                  <div className="mt-2 flex flex-wrap gap-1 rounded bg-white p-2 shadow">
                    <input value={shippingProfile} onChange={(event) => setShippingProfile(event.target.value)} placeholder="Shipping" className="w-24 rounded border px-2 py-1" />
                    <input value={paymentProfile} onChange={(event) => setPaymentProfile(event.target.value)} placeholder="Payment" className="w-24 rounded border px-2 py-1" />
                    <input value={returnProfile} onChange={(event) => setReturnProfile(event.target.value)} placeholder="Returns" className="w-24 rounded border px-2 py-1" />
                    <button type="button" disabled={pendingAction === 'policies'} onClick={() => void runBulk('policies')} className="rounded bg-slate-900 px-2 py-1 text-white disabled:opacity-50">{pendingAction === 'policies' ? 'Applying…' : 'Apply'}</button>
                  </div>
                </details>
              ) : null}
              {canPublish ? <button type="button" onClick={() => openPublish([...selected])} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white"><Send size={14} aria-hidden="true" /> Validate &amp; publish</button> : null}
              {canExport ? <button type="button" disabled={pendingAction === 'export'} onClick={() => void exportRecords()} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm disabled:opacity-50"><Download size={14} aria-hidden="true" /> {pendingAction === 'export' ? 'Exporting…' : 'Export'}</button> : null}
              {canDelete ? <button type="button" disabled={pendingAction === 'delete'} onClick={() => void runBulk('delete')} className="rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50">{pendingAction === 'delete' ? 'Deleting…' : 'Delete'}</button> : null}
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded p-1 text-slate-500" aria-label="Clear selection"><X size={16} /></button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {loading ? 'Loading…' : `${(data?.total ?? 0).toLocaleString()} result(s)`}
              {facets ? ' · facets from ' + facets.totalFiltered.toLocaleString() + ' matched records' : ''}
              {selectedCount ? ` · ${selectedCount} selected on this page` : ''}
            </span>
            <div className="flex items-center gap-2">
              <label>Sort <select value={state.sort} onChange={(event) => setState((current) => ({ ...current, page: 0, sort: event.target.value as CatalogSort }))} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="updated">Updated</option><option value="title_asc">Title A–Z</option><option value="title_desc">Title Z–A</option><option value="sku_asc">SKU</option><option value="price_asc">Price low</option><option value="price_desc">Price high</option></select></label>
              <label>Rows <select value={state.pageSize} onChange={(event) => setState((current) => ({ ...current, page: 0, pageSize: Number(event.target.value) }))} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            </div>
          </div>

          <CatalogResultsTable
            config={config}
            items={data?.items || []}
            selected={selected}
            loading={loading}
            error={error}
            canPublish={canPublish}
            hasActiveQuery={hasActiveQuery}
            catalogTotal={summary?.total ?? null}
            emptyActionLabel={addLabel}
            onEmptyAction={() => navigate(config.editorUrl())}
            onRetry={refresh}
            onToggle={toggleSelected}
            onTogglePage={togglePage}
            onView={setActiveItem}
            onEdit={editItem}
            onPublish={(item) => openPublish([item.id], item)}
          />

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <button type="button" disabled={state.page === 0 || loading} onClick={() => setState((current) => ({ ...current, page: Math.max(0, current.page - 1) }))} className="min-h-11 rounded px-3 py-1.5 font-medium text-slate-600 disabled:opacity-40 dark:text-slate-300">Previous</button>
            <span className="text-xs text-slate-500">Page {state.page + 1} of {pageCount}{data ? ` · showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()}` : ''}</span>
            <button type="button" disabled={!hasNext || loading} onClick={() => setState((current) => ({ ...current, page: current.page + 1 }))} className="min-h-11 rounded px-3 py-1.5 font-medium text-slate-600 disabled:opacity-40 dark:text-slate-300">Next</button>
          </div>
        </div>
      </div>

      <CatalogMobileFilterDrawer open={showFilters} onClose={() => setShowFilters(false)} filterCount={filterCount}>
        <div id="catalog-mobile-filters">
          <CatalogFilterControls compact config={config} filters={state.filters} facets={facets} facetsError={facetsError} onChange={setFilters} onReset={resetFilters} />
        </div>
      </CatalogMobileFilterDrawer>

      <CatalogProductQuickView config={config} item={activeItem} organizationId={activeOrganizationId} canPublish={canPublish} onClose={() => setActiveItem(null)} onSaved={saveItem} onPublish={(item) => openPublish([item.id], item)} />
      {isBusinessIndustrial ? <BusinessIndustrialPublishModal open={Boolean(publishSelection)} item={publishSelection?.item} listingIds={publishSelection?.ids || []} accounts={accounts} organizationId={activeOrganizationId} onClose={() => setPublishSelection(null)} onSubmitted={handlePublishSubmitted} /> : null}
    </div>
  );
}
