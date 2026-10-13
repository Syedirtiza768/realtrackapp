import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  createFashionIntake,
  createFashionSizeChart,
  fashionError,
  listFashionBatches,
  listFashionWarehouses,
  nextFashionSku,
  type FashionBatch,
  type FashionWarehouse,
  type FashionIntakePayload,
} from '../../lib/fashionListingsApi';
import { FASHION_FAMILIES, type FashionFamily } from '../../lib/fashionFields';
import { countFashionPhotos, emptyFashionPhotoSlots, missingFashionPhotoSlots, type FashionPhotoSlots } from '../../lib/fashionPhotoSlots';
import FashionPhotoSet from './FashionPhotoSet';
import type { PhotoUploadState } from './useFashionPhotoQueue';
import { FASHION_SIZES, fashionSkuWithSize } from '../../lib/fashionCaptureMedia';
import FashionMeasurementChart, { isFashionMeasurementValue, useFashionMeasurementTemplates, type FashionMeasurementState } from './FashionMeasurementChart';

const SESSION_KEY = 'fashion.capture.session.v2';
const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800';
const card = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900';

/** eBay apparel condition IDs. Category support is still checked by validation before publishing. */
const CONDITIONS = [
  { id: '1000', label: 'New with tags' },
  { id: '1500', label: 'New without tags' },
  { id: '2990', label: 'Pre-owned – Excellent' },
  { id: '3000', label: 'Pre-owned – Good' },
  { id: '3010', label: 'Pre-owned – Fair' },
];
/** eBay "Department" item-specific values. */
const DEPARTMENTS = ['Men', 'Women', 'Unisex Adults', 'Boys', 'Girls', 'Unisex Kids'];

type Session = {
  warehouseCode: string;
  batch: string;
  conditionId: string;
  department: string;
  family: FashionFamily;
  templateId: string;
  unit: 'cm' | 'in';
  addChart: boolean;
  identify: boolean;
};
const defaultSession: Session = { warehouseCode: '', batch: 'AVP', conditionId: '', department: '', family: 'clothing', templateId: '', unit: 'in', addChart: false, identify: true };

function readSession(key: string): Session {
  try {
    const raw = localStorage.getItem(key);
    const next = raw ? { ...defaultSession, ...(JSON.parse(raw) as Partial<Session>) } : defaultSession;
    return { ...next, batch: /^[A-Z0-9]{1,20}$/.test(next.batch) ? next.batch : 'AVP' };
  } catch { return defaultSession; }
}

type Recent = { id: string; sku: string; identify: boolean };

/**
 * Phone-first Fashion quick capture. Session settings (warehouse, batch,
 * condition, department, chart) stay between garments; each save creates a draft
 * and queues photo identification in the background so the next garment can start.
 */
export default function FashionCapturePage() {
  const { activeOrganizationId, user } = useAuth();
  const scope = `${user?.id ?? 'viewer'}:${activeOrganizationId ?? 'default'}`;
  return <FashionCapture key={scope} sessionKey={`${SESSION_KEY}:${scope}`} />;
}

function FashionCapture({ sessionKey }: { sessionKey: string }) {
  const { permissions, activeOrganizationId } = useAuth();
  const canCreate = permissions.includes('fashion.listings.create');
  const [session, setSession] = useState<Session>(() => readSession(sessionKey));
  const [prefixDraft, setPrefixDraft] = useState(session.batch);
  const [warehouses, setWarehouses] = useState<FashionWarehouse[]>([]);
  const [batches, setBatches] = useState<FashionBatch[]>([]);
  const [loadError, setLoadError] = useState('');
  const { templates, error: templatesError } = useFashionMeasurementTemplates(activeOrganizationId);

  const [skuBase, setSkuBase] = useState('');
  const [skuError, setSkuError] = useState('');
  const [skuAttempt, setSkuAttempt] = useState(0);
  const [captureId, setCaptureId] = useState(() => crypto.randomUUID());
  const [uploads, setUploads] = useState<PhotoUploadState>({ pending: 0, failed: 0 });
  const [chartBusy, setChartBusy] = useState(false);
  const [retryPayload, setRetryPayload] = useState<FashionIntakePayload>();
  const saveLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [sizeSuffix, setSizeSuffix] = useState('');
  const [slots, setSlots] = useState<FashionPhotoSlots>(emptyFashionPhotoSlots);
  const [values, setValues] = useState<Record<string, string>>({});
  const [skuBusy, setSkuBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recent, setRecent] = useState<Recent[]>([]);

  const photoCount = countFashionPhotos(slots);
  const sku = fashionSkuWithSize(skuBase, sizeSuffix);
  const editable = !saving && !retryPayload;
  const familyTemplates = useMemo(() => templates.filter((template) => template.family === session.family), [templates, session.family]);
  const template = familyTemplates.find((item) => item.id === session.templateId);
  const measurement: FashionMeasurementState = { templateId: template?.id ?? '', unit: session.unit, values };

  useEffect(() => {
    try { localStorage.setItem(sessionKey, JSON.stringify(session)); } catch { /* per-viewer convenience only */ }
  }, [session, sessionKey]);
  useEffect(() => {
    if (!canCreate) return;
    const controller = new AbortController();
    setSkuBusy(true); setSkuBase(''); setSkuError('');
    nextFashionSku(session.batch, undefined, activeOrganizationId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setSkuBase(result.sku); })
      .catch((err) => { if (!controller.signal.aborted) setSkuError(fashionError(err)); })
      .finally(() => { if (!controller.signal.aborted) setSkuBusy(false); });
    return () => controller.abort();
  }, [session.batch, captureId, skuAttempt, activeOrganizationId, canCreate]);
  useEffect(() => {
    if (!photoCount && !uploads.pending && !uploads.failed && !sizeSuffix && !retryPayload) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [photoCount, uploads.pending, uploads.failed, sizeSuffix, retryPayload]);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError('');
    Promise.all([
      listFashionWarehouses(controller.signal, activeOrganizationId),
      listFashionBatches(controller.signal, activeOrganizationId),
    ]).then(([nextWarehouses, nextBatches]) => {
      setWarehouses(nextWarehouses); setBatches(nextBatches);
    }).catch((err) => { if (!controller.signal.aborted) setLoadError(fashionError(err)); });
    return () => controller.abort();
  }, [activeOrganizationId]);
  // Keep the chosen chart valid for the selected family.
  useEffect(() => {
    if (!familyTemplates.length || familyTemplates.some((item) => item.id === session.templateId)) return;
    setSession((previous) => ({ ...previous, templateId: familyTemplates[0].id }));
  }, [familyTemplates, session.templateId]);

  function update<K extends keyof Session>(key: K, value: Session[K]) {
    setSession((previous) => ({ ...previous, [key]: value }));
  }

  function changeSize(size: string) {
    setSizeSuffix(size.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8));
    if (slots.sizeChart.length) setSlots((previous) => ({ ...previous, sizeChart: [] }));
  }
  function applyPrefix() {
    const prefix = prefixDraft.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,20}$/.test(prefix)) { setError('Use 1–20 letters or numbers for the prefix.'); return; }
    update('batch', prefix); setPrefixDraft(prefix); setError('');
    if (slots.sizeChart.length) setSlots((previous) => ({ ...previous, sizeChart: [] }));
  }

  function validate(): string | null {
    if (!skuBase || skuBusy) return 'Wait for the automatic SKU, or retry SKU generation.';
    if (!sizeSuffix.trim()) return 'Choose the label size to complete the SKU.';
    if (chartBusy) return 'The measurement chart is still being created. You can keep entering details.';
    if (uploads.pending) return 'Photos are still uploading. You can keep entering details.';
    if (uploads.failed) return 'Retry or remove the failed photo uploads before saving.';
    const missing = missingFashionPhotoSlots(slots);
    if (missing.length) return `Add the required photos: ${missing.join(', ')}.`;
    if (session.addChart) {
      if (!template) return 'Choose a measurement chart, or turn off "Add measurement chart".';
      const empty = template.points.filter((point) => !isFashionMeasurementValue(values[point.key]));
      if (empty.length) return `Enter every measurement: ${empty.map((point) => `${point.letter} ${point.label}`).join(', ')}.`;
    }
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saveLock.current) return;
    setMessage('');
    const problem = retryPayload ? null : validate();
    if (problem) { setError(problem); return; }
    saveLock.current = true;
    setError(''); setSaving(true);
    try {
      let chartUrl = slots.sizeChart[0];
      const measurementValues: Record<string, string> = {};
      if (!retryPayload && session.addChart && template) {
        for (const point of template.points) measurementValues[point.key] = values[point.key].trim().replace(',', '.');
        if (!chartUrl) {
          const chart = await createFashionSizeChart({ template: template.id, unit: session.unit, values: measurementValues, sku: sku.trim() }, activeOrganizationId);
          chartUrl = chart.url;
          setSlots((previous) => ({ ...previous, sizeChart: [chart.url] }));
        }
      }
      const payload: FashionIntakePayload = retryPayload ?? {
        captureId,
        sku: sku.trim(),
        batch: session.batch.trim() || undefined,
        warehouseCode: session.warehouseCode || undefined,
        conditionId: session.conditionId || undefined,
        department: session.department || undefined,
        categoryFamily: session.family,
        labelSize: sizeSuffix.trim() || undefined,
        frontImageUrl: slots.front[0],
        backImageUrl: slots.back[0],
        tagImageUrls: slots.tag,
        additionalImageUrls: slots.additional,
        sizeChartImageUrl: chartUrl,
        ...(session.addChart && template ? { sizeChartTemplate: template.id, measurementsUnit: session.unit, measurementValues } : {}),
        identify: session.identify,
      };
      setRetryPayload(payload);
      const created = await createFashionIntake(payload, activeOrganizationId);
      setRecent((previous) => [{ id: created.id, sku: created.sku ?? sku.trim(), identify: session.identify }, ...previous].slice(0, 8));
      setMessage(`${created.sku ?? sku.trim()} saved${session.identify ? ' — identifying in the background' : ''}. Ready for the next garment.`);
      setRetryPayload(undefined); setSlots(emptyFashionPhotoSlots()); setValues({}); setSizeSuffix(''); setSkuBase('');
      setUploads({ pending: 0, failed: 0 }); setCaptureId(crypto.randomUUID());
      formRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (session.batch.trim()) {
        listFashionBatches(undefined, activeOrganizationId).then(setBatches).catch(() => undefined);
      }
    } catch (err) {
      setError(fashionError(err));
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500) setRetryPayload(undefined);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  if (!canCreate) return <p role="alert">You do not have permission to capture Fashion items.</p>;

  return (
    <form ref={formRef} onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-5 pb-20">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Quick capture</h1>
        <p className="mt-1 text-sm text-slate-500">Photograph, choose a size, and save. Identification runs in the background. <Link to="/fashion/intake" className="text-pink-600">Intake history →</Link></p>
      </div>
      {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
      {message && <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {message}</p>}

      <details className={`${card} order-3`}>
        <summary className="cursor-pointer font-semibold">Session settings <span className="text-xs font-normal text-slate-500">{session.batch} · kept for the next garment</span></summary>
        <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Warehouse
            <select className={input} value={session.warehouseCode} onChange={(event) => update('warehouseCode', event.target.value)}>
              <option value="">Not set</option>
              {warehouses.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.name}</option>)}
            </select>
            {!warehouses.length && <span className="text-xs text-slate-500">Add warehouses in <Link to="/fashion/settings" className="text-pink-600">Fashion settings</Link>.</span>}
          </label>
          <label className="text-sm">SKU prefix
            <input className={input} list="fashion-batches" autoCapitalize="characters" maxLength={20} value={prefixDraft} onChange={(event) => setPrefixDraft(event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} placeholder="AVP" />
            <datalist id="fashion-batches">{batches.map((item) => <option key={item.batch} value={item.batch}>{`${item.itemCount} items`}</option>)}</datalist>
            <button type="button" disabled={skuBusy || prefixDraft === session.batch} onClick={applyPrefix} className="mt-2 min-h-10 text-pink-700 underline disabled:opacity-40">Apply prefix</button>
          </label>
          <label className="text-sm">Condition
            <select className={input} value={session.conditionId} onChange={(event) => update('conditionId', event.target.value)}>
              <option value="">Not set</option>
              {CONDITIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Department
            <select className={input} value={session.department} onChange={(event) => update('department', event.target.value)}>
              <option value="">Not set</option>
              {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">Category family
            <select className={input} value={session.family} onChange={(event) => update('family', event.target.value as FashionFamily)}>
              {FASHION_FAMILIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </fieldset>
      </details>

      <section className={`${card} order-1`} aria-labelledby="capture-sku">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="capture-sku" className="font-semibold">Label size & automatic SKU</h2><output aria-label="Generated SKU" className="rounded-lg bg-pink-50 px-3 py-2 font-mono text-sm font-semibold text-pink-800 dark:bg-pink-950 dark:text-pink-200">{skuBusy ? 'Preparing SKU…' : skuBase ? sku : 'SKU unavailable'}</output></div>
        <p className="text-sm text-slate-500">Choose the size printed on the label. Changing it keeps the same garment number and photos.</p>
        <fieldset disabled={!editable}>
          <legend className="sr-only">Label size</legend>
          <div className="flex gap-2">{['S', 'M', 'L'].map((size) => <button key={size} type="button" aria-pressed={sizeSuffix === size} onClick={() => changeSize(size)} className={`min-h-11 flex-1 rounded-lg border px-3 font-semibold disabled:opacity-40 ${sizeSuffix === size ? 'border-pink-600 bg-pink-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{size}</button>)}</div>
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-500">Other sizes{sizeSuffix && !['S', 'M', 'L'].includes(sizeSuffix) ? ` · ${sizeSuffix}` : ''}</summary>
            <div className="mt-2 flex flex-wrap gap-2">{FASHION_SIZES.filter((size) => !['S', 'M', 'L'].includes(size)).map((size) => <button key={size} type="button" aria-pressed={sizeSuffix === size} onClick={() => changeSize(size)} className={`min-h-11 rounded-lg border px-3 font-semibold ${sizeSuffix === size ? 'border-pink-600 bg-pink-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{size}</button>)}</div>
            <label className="mt-3 block">Other label size<input className={`${input} max-w-40`} maxLength={8} autoCapitalize="characters" value={sizeSuffix} onChange={(event) => changeSize(event.target.value)} placeholder="e.g. 32 or 10" /></label>
          </details>
        </fieldset>
        {skuError && <div role="alert" className="text-sm text-red-600"><p>{skuError}</p><button type="button" disabled={skuBusy || !editable} onClick={() => setSkuAttempt((value) => value + 1)} className="min-h-11 underline">Retry automatic SKU</button></div>}
      </section>

      <section className={`${card} order-2`} aria-labelledby="capture-photos">
        <h2 id="capture-photos" className="font-semibold">Photos</h2>
        <p className="text-sm text-slate-500">Front, back and one label photo. Capture continuously while uploads finish.</p>
        <FashionPhotoSet key={captureId} compact slots={slots} editable={editable} organizationId={activeOrganizationId} sku={skuBase || undefined} onChange={setSlots} onUploadStateChange={setUploads} />
      </section>

      <section className={`${card} order-4`} aria-labelledby="capture-measure">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="capture-measure" className="font-semibold">Measurements</h2>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} className="h-5 w-5" checked={session.addChart} onChange={(event) => update('addChart', event.target.checked)} /> Add measurement chart</label>
        </div>
        {templatesError && <p role="alert" className="text-sm text-red-600">{templatesError}</p>}
        {session.addChart && <FashionMeasurementChart
          templates={templates}
          family={session.family}
          state={measurement}
          onChange={(next) => { setSession((previous) => ({ ...previous, templateId: next.templateId, unit: next.unit })); setValues(next.values); if (slots.sizeChart.length) setSlots((previous) => ({ ...previous, sizeChart: [] })); }}
          editable={editable}
          onBusyChange={setChartBusy}
          organizationId={activeOrganizationId}
          brandName={undefined}
          sku={sku}
          requireAll
          hasChartImage={slots.sizeChart.length > 0}
          onChartImage={(url) => setSlots((previous) => ({ ...previous, sizeChart: [url] }))}
        />}
        {session.addChart && <p className="text-xs text-slate-500">Measure flat with a tape or ruler. A branded size-chart image is created on save if you have not created one.</p>}
      </section>

      {recent.length > 0 && <section className={`${card} order-5`} aria-labelledby="capture-recent">
        <h2 id="capture-recent" className="font-semibold">Saved this session</h2>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {recent.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-2"><span className="font-mono">{item.sku}</span><Link to={`/fashion/listings/${item.id}`} className="text-pink-600">{item.identify ? 'Open (identifying)' : 'Open'}</Link></li>)}
        </ul>
      </section>}

      <div className="sticky bottom-0 z-10 order-6 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border dark:border-slate-700 dark:bg-slate-900/95">
        {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          {retryPayload && !saving && <p className="w-full text-sm text-amber-700">Save confirmation was interrupted. Retry the same garment safely, or check <Link to="/fashion/intake" className="underline">Intake history</Link>.</p>}
          <button type="submit" disabled={saving || (!retryPayload && (skuBusy || !skuBase || chartBusy || uploads.pending > 0 || uploads.failed > 0))} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-pink-600 px-5 font-semibold text-white disabled:opacity-40 sm:flex-none">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} {saving ? 'Saving…' : retryPayload ? 'Retry save' : 'Save & next garment'}
          </button>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} className="h-5 w-5" checked={session.identify} onChange={(event) => update('identify', event.target.checked)} /> Identify in background</label>
          <span className="text-xs text-slate-500">{photoCount} photo{photoCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    </form>
  );
}
