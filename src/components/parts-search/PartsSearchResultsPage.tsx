/* ─── Parts Search results: every sellable option ──────────
 *  Groups (exact / superseded / equivalents / unverified, or
 *  fitment verdicts for text queries), live stock from
 *  PartsBazar360 and Omni Core warehouses, fitment against
 *  the selected vehicle, and a sourcing request when nothing
 *  can be sold. Falls back to the buyer-view results when the
 *  internal search is not configured on the server.
 * ────────────────────────────────────────────────────────── */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { rememberSearch } from '../../lib/partsSearchApi';
import {
  createSourcingRequest,
  isInternalUnavailable,
  optionsParamsFromUrl,
  optionsPath,
  rememberVehicle,
  searchOptions,
  type OptionDroppable,
  type OptionsParams,
  type OptionsResponse,
  type VehicleSelection,
} from '../../lib/partsSearchOptionsApi';
import OptionGroupSection from './options/OptionGroupSection';
import VehicleBar from './options/VehicleBar';
import PartsSearchClassicResults from './PartsSearchClassicResults';
import SearchBox from './SearchBox';

function useSecondsSince(iso: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  if (!iso) return null;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
}

function ageText(seconds: number | null): string {
  if (seconds == null) return '';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

function SourcingRequestCard({ data }: { data: OptionsResponse }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setState('saving');
    setError(null);
    try {
      await createSourcingRequest({
        query: data.query.original,
        numbers: data.query.numbers,
        vehicle: data.vehicle ? { label: data.vehicle.label, make: data.vehicle.make, model: data.vehicle.model, year: data.vehicle.year, engineLitres: data.vehicle.engineLitres ?? null } : undefined,
        note: note.trim() || undefined,
      });
      setState('done');
    } catch (e) {
      setState('error');
      setError((e as Error).message);
    }
  };
  if (state === 'done') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        Sourcing request logged. It appears under <a href="/parts-search/demand" className="font-medium underline">Demand</a> for procurement.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-medium">Nothing we can sell right now{data.summary.totalOptions ? ' — every option is out of stock' : ''}.</p>
      <p className="mt-0.5">This search is already in the demand log. Add a sourcing request so procurement follows it up.</p>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Buyer details, quantity, deadline… (optional)"
          className="min-w-[16rem] flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
        />
        <button type="button" onClick={() => void submit()} disabled={state === 'saving'} className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}>
          {state === 'saving' ? 'Saving…' : 'Create sourcing request'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

function Lightbox({ image, onClose }: { image: { url: string; alt: string } | null; onClose: () => void }) {
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [image, onClose]);
  if (!image) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4" role="dialog" aria-modal="true" aria-label={image.alt} onClick={onClose}>
      <img src={image.url} alt={image.alt} referrerPolicy="no-referrer" className="max-h-[85vh] max-w-[90vw] rounded-lg bg-white object-contain" onClick={(e) => e.stopPropagation()} />
      <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-800" aria-label="Close image">
        <X size={18} />
      </button>
    </div>
  );
}

export default function PartsSearchResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = useMemo(() => optionsParamsFromUrl(searchParams), [searchParams]);
  const [image, setImage] = useState<{ url: string; alt: string } | null>(null);

  useEffect(() => {
    if (params.q) rememberSearch(params.q);
  }, [params.q]);

  const search = useQuery({
    queryKey: ['parts-search', 'options', searchParams.toString()],
    queryFn: ({ signal }) => searchOptions(params, signal),
    placeholderData: keepPreviousData,
    // Stock must be current: always refetch on focus/remount, never serve old data as fresh.
    staleTime: 0,
    retry: (count, error) => !isInternalUnavailable(error) && count < 1,
  });
  const data = search.data;
  const checkedAgo = useSecondsSince(data?.meta.checkedAt);

  const update = (next: OptionsParams) => navigate(optionsPath(next));
  const setVehicle = (vehicle: VehicleSelection | undefined) => {
    if (vehicle) rememberVehicle(vehicle);
    update({ ...params, vehicle, page: undefined });
  };
  const drop = (key: OptionDroppable) => update({ ...params, drop: [...new Set([...(params.drop ?? []), key])], page: undefined });
  const undrop = (key: OptionDroppable) => update({ ...params, drop: (params.drop ?? []).filter((k) => k !== key), page: undefined });

  if (search.isError && isInternalUnavailable(search.error)) {
    return (
      <div>
        <p className="mx-auto mb-3 max-w-7xl rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Showing the buyer view — the internal “every option” search is not configured on this server yet.
        </p>
        <PartsSearchClassicResults />
      </div>
    );
  }

  const hasVehicle = Boolean(data?.vehicle);
  const sellableNow = data ? data.summary.inStock + (data.summary.omniInStock ?? 0) + data.summary.canSource : 0;
  const buildPath = (q: string) => optionsPath({ q: q || undefined, vehicle: params.vehicle, includeUnavailable: params.includeUnavailable });

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <SearchBox initialQuery={params.q ?? ''} buildPath={buildPath} />
      <VehicleBar resolved={data?.vehicle ?? null} selection={params.vehicle} onChange={setVehicle} onClearQueryVehicle={() => drop('year')} />

      {/* summary */}
      {data && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {data.summary.sentence}
            {search.isFetching && <Loader2 size={14} className="ml-2 inline animate-spin text-slate-400" aria-label="Updating" />}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Stock checked {ageText(checkedAgo)} · {data.meta.tookMs} ms
          </span>
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={Boolean(params.includeUnavailable)} onChange={() => update({ ...params, includeUnavailable: !params.includeUnavailable || undefined })} className="h-4 w-4 rounded border-slate-300" />
            Show not available ({data.summary.notAvailable})
          </label>
        </div>
      )}

      {/* interpretation chips */}
      {data && (data.query.interpreted.length > 0 || data.query.dropped.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Understood as</span>
          {data.query.interpreted.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400">{chip.label}:</span> {chip.value}
              {chip.key !== 'engine' && (
                <button type="button" onClick={() => drop(chip.key as OptionDroppable)} className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={`Ignore ${chip.label.toLowerCase()}`} title="Ignore this">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {data.query.dropped.map((key) => (
            <button key={key} type="button" onClick={() => undrop(key)} className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400" title="Use this again">
              + {key}
            </button>
          ))}
          {data.summary.excludedOtherMake > 0 && (
            <span className="text-slate-500 dark:text-slate-400">· {data.summary.excludedOtherMake} cross-references for other makes left out</span>
          )}
        </div>
      )}

      {data?.corrections.map((c) => (
        <p key={c.type + c.message} className={`rounded-lg px-3 py-2 text-sm ${c.type === 'relaxed' || c.type === 'partial' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300'}`}>
          {c.message}
        </p>
      ))}

      {data && data.didYouMean.length > 0 && (
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Did you mean{' '}
          {data.didYouMean.map((s, i) => (
            <span key={s.number}>
              {i > 0 && ', '}
              <button type="button" onClick={() => update({ ...params, q: s.number, drop: undefined, page: undefined })} className="font-mono font-semibold hover:underline" style={{ color: 'var(--brand-primary)' }}>
                {s.number}
              </button>
            </span>
          ))}
          ?
        </p>
      )}

      {search.isError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="flex-1">{(search.error as Error)?.message ?? 'Search failed.'}</p>
          <button type="button" onClick={() => void search.refetch()} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium dark:border-red-800">
            <RefreshCw size={12} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {!data && search.isLoading &&
        Array.from({ length: 3 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}

      {data && data.mode !== 'empty' && sellableNow === 0 && <SourcingRequestCard key={data.requestId} data={data} />}

      {data?.groups.map((group) => (
        <OptionGroupSection
          key={`${data.requestId}-${group.key}`}
          group={group}
          query={data.query.original}
          requestRef={data.requestId}
          hasVehicle={hasVehicle}
          showingUnavailable={Boolean(params.includeUnavailable)}
          onShowUnavailable={() => update({ ...params, includeUnavailable: true })}
          onImage={(url, alt) => setImage({ url, alt })}
        />
      ))}

      {data && data.mode === 'empty' && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Type a part number, OEM number or what the buyer needs, and choose their vehicle.
        </p>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={data.pagination.page <= 1} onClick={() => update({ ...params, page: data.pagination!.page - 1 })} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
            <ChevronLeft size={14} aria-hidden="true" /> Previous
          </button>
          <span className="tabular-nums text-slate-600 dark:text-slate-300">
            Page {data.pagination.page} of {Math.min(data.pagination.totalPages, 100)} · {data.pagination.totalResults.toLocaleString()} matches
          </span>
          <button type="button" disabled={data.pagination.page >= Math.min(data.pagination.totalPages, 100)} onClick={() => update({ ...params, page: data.pagination!.page + 1 })} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
            Next <ChevronRight size={14} aria-hidden="true" />
          </button>
        </nav>
      )}

      <Lightbox image={image} onClose={() => setImage(null)} />
    </div>
  );
}
