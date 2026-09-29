import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  createFashionIntake,
  createFashionSizeChart,
  fashionError,
  listFashionAccounts,
  listFashionBatches,
  listFashionWarehouses,
  nextFashionSku,
  type FashionAccount,
  type FashionBatch,
  type FashionWarehouse,
} from '../../lib/fashionListingsApi';
import { FASHION_FAMILIES, type FashionFamily } from '../../lib/fashionFields';
import { countFashionPhotos, emptyFashionPhotoSlots, missingFashionPhotoSlots, type FashionPhotoSlots } from '../../lib/fashionPhotoSlots';
import FashionPhotoSet from './FashionPhotoSet';
import FashionMeasurementChart, { isFashionMeasurementValue, useFashionMeasurementTemplates, type FashionMeasurementState } from './FashionMeasurementChart';

const SESSION_KEY = 'fashion.capture.session';
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
  accountKey: string;
  batch: string;
  conditionId: string;
  department: string;
  family: FashionFamily;
  templateId: string;
  unit: 'cm' | 'in';
  addChart: boolean;
  identify: boolean;
};
const defaultSession: Session = { warehouseCode: '', accountKey: '', batch: '', conditionId: '', department: '', family: 'clothing', templateId: '', unit: 'in', addChart: true, identify: true };

function readSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? { ...defaultSession, ...(JSON.parse(raw) as Partial<Session>) } : defaultSession;
  } catch { return defaultSession; }
}

type Recent = { id: string; sku: string; identify: boolean };

/**
 * Phone-first Fashion quick capture. Session settings (warehouse, seller, batch,
 * condition, department, chart) stay between garments; each save creates a draft
 * and queues photo identification in the background so the next garment can start.
 */
export default function FashionCapturePage() {
  const { permissions, activeOrganizationId } = useAuth();
  const canCreate = permissions.includes('fashion.listings.create');
  const [session, setSession] = useState<Session>(readSession);
  const [accounts, setAccounts] = useState<FashionAccount[]>([]);
  const [warehouses, setWarehouses] = useState<FashionWarehouse[]>([]);
  const [batches, setBatches] = useState<FashionBatch[]>([]);
  const [loadError, setLoadError] = useState('');
  const { templates, error: templatesError } = useFashionMeasurementTemplates(activeOrganizationId);

  const [sku, setSku] = useState('');
  const [sizeSuffix, setSizeSuffix] = useState('');
  const [slots, setSlots] = useState<FashionPhotoSlots>(emptyFashionPhotoSlots);
  const [values, setValues] = useState<Record<string, string>>({});
  const [skuBusy, setSkuBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recent, setRecent] = useState<Recent[]>([]);

  const account = accounts.find((item) => `${item.id}:${item.marketplaceId}` === session.accountKey);
  const photoCount = countFashionPhotos(slots);
  const skuLocked = photoCount > 0;
  const familyTemplates = useMemo(() => templates.filter((template) => template.family === session.family), [templates, session.family]);
  const template = familyTemplates.find((item) => item.id === session.templateId);
  const measurement: FashionMeasurementState = { templateId: template?.id ?? '', unit: session.unit, values };

  useEffect(() => {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* per-viewer convenience only */ }
  }, [session]);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError('');
    Promise.all([
      listFashionAccounts(controller.signal, activeOrganizationId),
      listFashionWarehouses(controller.signal, activeOrganizationId),
      listFashionBatches(controller.signal, activeOrganizationId),
    ]).then(([nextAccounts, nextWarehouses, nextBatches]) => {
      setAccounts(nextAccounts); setWarehouses(nextWarehouses); setBatches(nextBatches);
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

  async function generateSku(batchOverride?: string, suffixOverride?: string) {
    const batch = (batchOverride ?? session.batch).trim();
    const suffix = (suffixOverride ?? sizeSuffix).trim();
    if (!batch) { setError('Enter a batch to generate a SKU.'); return; }
    setSkuBusy(true); setError('');
    try {
      const result = await nextFashionSku(batch, suffix || undefined, activeOrganizationId);
      setSku(result.sku);
    } catch (err) { setError(fashionError(err)); }
    finally { setSkuBusy(false); }
  }

  function validate(): string | null {
    if (!sku.trim()) return 'Enter or generate a SKU first.';
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
    if (saving) return;
    setMessage('');
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError(''); setSaving(true);
    try {
      let chartUrl = slots.sizeChart[0];
      const measurementValues: Record<string, string> = {};
      if (session.addChart && template) {
        for (const point of template.points) measurementValues[point.key] = values[point.key].trim().replace(',', '.');
        if (!chartUrl) {
          const chart = await createFashionSizeChart({ template: template.id, unit: session.unit, values: measurementValues, brandName: account?.storeName || account?.accountName || undefined, sku: sku.trim() }, activeOrganizationId);
          chartUrl = chart.url;
          setSlots((previous) => ({ ...previous, sizeChart: [chart.url] }));
        }
      }
      const created = await createFashionIntake({
        sku: sku.trim(),
        batch: session.batch.trim() || undefined,
        warehouseCode: session.warehouseCode || undefined,
        ebayAccountId: account?.id,
        marketplaceId: account?.marketplaceId,
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
      }, activeOrganizationId);
      setRecent((previous) => [{ id: created.id, sku: created.sku ?? sku.trim(), identify: session.identify }, ...previous].slice(0, 8));
      setMessage(`${created.sku ?? sku.trim()} saved${session.identify ? ' — identifying in the background' : ''}. Ready for the next garment.`);
      setSlots(emptyFashionPhotoSlots()); setValues({}); setSizeSuffix(''); setSku('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (session.batch.trim()) {
        listFashionBatches(undefined, activeOrganizationId).then(setBatches).catch(() => undefined);
        void generateSku(session.batch, '');
      }
    } catch (err) {
      setError(fashionError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!canCreate) return <p role="alert">You do not have permission to capture Fashion items.</p>;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 pb-28">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Quick capture</h1>
        <p className="mt-1 text-sm text-slate-500">Photograph a garment, add measurements and save. Identification runs in the background while you move on. <Link to="/fashion/intake" className="text-pink-600">Intake history →</Link></p>
      </div>
      {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
      {message && <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {message}</p>}

      <section className={card} aria-labelledby="capture-session">
        <h2 id="capture-session" className="font-semibold">Session <span className="text-xs font-normal text-slate-500">kept for the next garment</span></h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Warehouse
            <select className={input} value={session.warehouseCode} onChange={(event) => update('warehouseCode', event.target.value)}>
              <option value="">Not set</option>
              {warehouses.map((item) => <option key={item.id} value={item.code}>{item.code} — {item.name}</option>)}
            </select>
            {!warehouses.length && <span className="text-xs text-slate-500">Add warehouses in <Link to="/fashion/settings" className="text-pink-600">Fashion settings</Link>.</span>}
          </label>
          <label className="text-sm">eBay seller
            <select className={input} value={session.accountKey} onChange={(event) => update('accountKey', event.target.value)}>
              <option value="">Not set</option>
              {accounts.map((item) => <option key={`${item.id}:${item.marketplaceId}`} value={`${item.id}:${item.marketplaceId}`}>{item.storeName || item.accountName} · {item.marketplaceId}</option>)}
            </select>
          </label>
          <label className="text-sm">Batch
            <input className={input} list="fashion-batches" autoCapitalize="characters" maxLength={20} value={session.batch} onChange={(event) => update('batch', event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} placeholder="For example AVP" />
            <datalist id="fashion-batches">{batches.map((item) => <option key={item.batch} value={item.batch}>{`${item.itemCount} items`}</option>)}</datalist>
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
        </div>
      </section>

      <section className={card} aria-labelledby="capture-sku">
        <h2 id="capture-sku" className="font-semibold">SKU</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <label className="text-sm">SKU *
            <input className={input} required maxLength={160} readOnly={skuLocked} value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Generate from the batch or type one" />
          </label>
          <label className="text-sm">Label size
            <input className={input} maxLength={8} autoCapitalize="characters" value={sizeSuffix} onChange={(event) => setSizeSuffix(event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} placeholder="M" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={skuBusy || skuLocked || !session.batch.trim()} onClick={() => void generateSku()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-pink-300 px-4 text-sm font-semibold text-pink-700 disabled:opacity-40 dark:border-pink-800 dark:text-pink-300">
            {skuBusy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Generate SKU
          </button>
          <p className="text-xs text-slate-500">{skuLocked ? 'Locked — photos are saved as <SKU>-<time>-<id>. Remove all photos to change it.' : 'Format: BATCH-0001, plus the label size when entered.'}</p>
        </div>
      </section>

      <section className={card} aria-labelledby="capture-photos">
        <h2 id="capture-photos" className="font-semibold">Photos</h2>
        <FashionPhotoSet compact slots={slots} editable={!saving && !!sku.trim()} organizationId={activeOrganizationId} sku={sku} onChange={setSlots} />
        {!sku.trim() && <p className="text-sm text-slate-500">Set the SKU first; photos are named after it.</p>}
      </section>

      <section className={card} aria-labelledby="capture-measure">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="capture-measure" className="font-semibold">Measurements</h2>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={session.addChart} onChange={(event) => update('addChart', event.target.checked)} /> Add measurement chart</label>
        </div>
        {templatesError && <p role="alert" className="text-sm text-red-600">{templatesError}</p>}
        {session.addChart && <FashionMeasurementChart
          templates={templates}
          family={session.family}
          state={measurement}
          onChange={(next) => { setSession((previous) => ({ ...previous, templateId: next.templateId, unit: next.unit })); setValues(next.values); if (slots.sizeChart.length) setSlots((previous) => ({ ...previous, sizeChart: [] })); }}
          editable={!saving}
          organizationId={activeOrganizationId}
          brandName={account?.storeName || account?.accountName}
          sku={sku}
          requireAll
          hasChartImage={slots.sizeChart.length > 0}
          onChartImage={(url) => setSlots((previous) => ({ ...previous, sizeChart: [url] }))}
        />}
        {session.addChart && <p className="text-xs text-slate-500">Measure flat with a tape or ruler. A branded size-chart image is created on save if you have not created one.</p>}
      </section>

      {recent.length > 0 && <section className={card} aria-labelledby="capture-recent">
        <h2 id="capture-recent" className="font-semibold">Saved this session</h2>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {recent.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-2"><span className="font-mono">{item.sku}</span><Link to={`/fashion/listings/${item.id}`} className="text-pink-600">{item.identify ? 'Open (identifying)' : 'Open'}</Link></li>)}
        </ul>
      </section>}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border dark:border-slate-700 dark:bg-slate-900/95">
        {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-pink-600 px-5 font-semibold text-white disabled:opacity-40 sm:flex-none">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} {saving ? 'Saving…' : 'Save & next garment'}
          </button>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={session.identify} onChange={(event) => update('identify', event.target.checked)} /> Identify in background</label>
          <span className="text-xs text-slate-500">{photoCount} photo{photoCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    </form>
  );
}
