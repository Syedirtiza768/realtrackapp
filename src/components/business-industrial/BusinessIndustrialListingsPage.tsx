import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';

type Listing = {
  id: string;
  sku: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  mpn: string | null;
  conditionId: string | null;
  conditionLabel: string | null;
  price: string | number | null;
  imageUrls: string[];
  verticalValidationStatus: string;
  quantity: number | null;
  categoryId: string | null;
  categoryName: string | null;
  verticalAttributes: Record<string, unknown>;
  serializedUnitCount: number;
};
type Family = { id: string; label: string; restricted: boolean };
type Account = { id: string; accountDisplayName: string; storeName: string; marketplaceId: string | null; status: string };
type Channel = { id: string; listingStatus: string; listingUrl: string | null; storeName: string; marketplaceId: string; offerId: string | null };
type CategorySuggestion = { category?: { categoryId?: string; categoryName?: string } };
type EbayAspect = { localizedAspectName: string; aspectConstraint?: { aspectRequired?: boolean; aspectMaxValues?: number }; aspectValues?: Array<{ localizedValue?: string }> };
type CategoryMetadata = { aspects: EbayAspect[]; supportedConditions: string[] };

const initialForm: Record<string, string> = {
  sku: '', title: '', description: '', manufacturer: '', model: '', mpn: '', price: '', quantity: '1',
  categoryFamily: '', categoryId: '', categoryName: '', inventoryMode: 'single', serialNumbers: '',
  shippingMode: 'parcel', dispatchLocation: '', shippingCoverage: '', packedWeight: '', packedWeightUnit: 'kg',
  packedLength: '', packedWidth: '', packedHeight: '', packedDimensionsUnit: 'cm',
  voltage: '', voltageUnit: 'V', power: '', powerUnit: 'W', capacity: '', capacityUnit: 'L',
  frequency: '', frequencyUnit: 'Hz', current: '', currentUnit: 'A', pressure: '', pressureUnit: 'bar',
  phase: '', material: '', connectionSize: '', tolerance: '', compatibleEquipment: '',
  dimensionsLength: '', dimensionsWidth: '', dimensionsHeight: '', dimensionsUnit: 'cm',
  weight: '', weightUnit: 'kg', functionalStatus: '', cosmeticCondition: '', testingScope: '',
  testResults: '', calibrationStatus: '', calibrationDate: '', serviceHistory: '', includedComponents: '',
  accessories: '', manuals: '', operatingHours: '', inspectionDate: '', certificationType: '', certificationEvidence: '',
  conditionId: '', conditionLabel: '', imageUrls: '',
  missingParts: '', warrantyTerms: '', handlingTime: '', freightLoadingFacilities: '',
  sellableLots: '', unitsPerLot: '', totalPhysicalUnits: '', palletWeight: '', palletWeightUnit: 'kg',
  crateWeight: '', crateWeightUnit: 'kg',
  liftgate: '', residentialDelivery: '',
};
const field = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';
const label = 'text-sm';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';
const CONDITION_LABELS: Record<string, string> = {
  '1000': 'New',
  '1500': 'New other / open box',
  '2000': 'Certified refurbished',
  '2500': 'Seller refurbished',
  '3000': 'Used',
  '4000': 'Used - very good',
  '5000': 'Used - good',
  '6000': 'Used - acceptable',
  '7000': 'For parts or not working',
};
const valueOf = (attributes: Record<string, unknown>, key: string) => {
  const value = attributes[key];
  return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
};

const withOrganization = (path: string, organizationId: string | null) => {
  if (!organizationId) return path;
  return path + (path.includes('?') ? '&' : '?') + 'organizationId=' + encodeURIComponent(organizationId);
};

export default function BusinessIndustrialListingsPage() {
  const { activeOrganizationId } = useAuth();
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [channels, setChannels] = useState<Record<string, Channel[]>>({});
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [categoryMetadata, setCategoryMetadata] = useState<CategoryMetadata | null>(null);
  const [aspectValues, setAspectValues] = useState<Record<string, string>>({});
  const [categoryBusy, setCategoryBusy] = useState(false);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];

  async function load() {
    setLoading(true);
    try {
      const [items, categoryFamilies, sellers] = await Promise.all([
        fetchWithAuth<Listing[]>(withOrganization('/api/business-industrial/listings', activeOrganizationId)),
        fetchWithAuth<Family[]>('/api/business-industrial/categories'),
        fetchWithAuth<Account[]>(withOrganization('/api/business-industrial/ebay/accounts', activeOrganizationId)),
      ]);
      setListings(items); setFamilies(categoryFamilies); setAccounts(sellers);
      const requestedEditId = searchParams.get('edit');
      const requestedListing = requestedEditId ? items.find((item) => item.id === requestedEditId) : null;
      if (requestedListing) edit(requestedListing);
      setSelectedAccountId((current) => current || sellers[0]?.id || '');
    } catch (err) { setMessage(messageOf(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [activeOrganizationId, searchParams]);
  function update(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function reset() { setEditingId(null); setForm({ ...initialForm }); setCategoryMetadata(null); setCategorySuggestions([]); setAspectValues({}); }
  function edit(listing: Listing) {
    const attributes = listing.verticalAttributes ?? {};
    const next: Record<string, string> = { ...initialForm, sku: listing.sku ?? '', title: listing.title, description: listing.description ?? '', manufacturer: listing.brand ?? '', mpn: listing.mpn ?? '',
      conditionId: listing.conditionId ?? '', conditionLabel: listing.conditionLabel ?? '', price: listing.price == null ? '' : String(listing.price), quantity: listing.quantity == null ? '' : String(listing.quantity),
      imageUrls: (listing.imageUrls ?? []).join('\n'), categoryId: listing.categoryId ?? '', categoryName: listing.categoryName ?? '' };
    for (const key of Object.keys(next)) if (key in attributes) next[key] = valueOf(attributes, key);
    setForm(next); setEditingId(listing.id); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCategoryMetadata(null);
    setAspectValues(Object.fromEntries(Object.entries(attributes).filter(([key]) => !(key in next)).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value ?? '')])));
  }
  function payload() {
    const attributes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (!['sku', 'title', 'description', 'manufacturer', 'model', 'mpn', 'conditionId', 'conditionLabel', 'imageUrls', 'price', 'quantity', 'categoryId', 'categoryName', 'serialNumbers'].includes(key) && value.trim() !== '') attributes[key] = value.trim();
    }
    const units = form.inventoryMode === 'serialized'
      ? form.serialNumbers.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
        const [serialNumberPrivate, serialNumberPublic] = line.split('|').map((part) => part.trim());
        return { serialNumberPrivate, ...(serialNumberPublic ? { serialNumberPublic } : {}) };
      })
      : undefined;
    for (const [name, value] of Object.entries(aspectValues)) if (value.trim()) attributes[name] = value.split(',').map((item) => item.trim()).filter(Boolean);
    return {
      sku: form.sku.trim(), title: form.title.trim(), description: form.description.trim() || undefined,
      manufacturer: form.manufacturer.trim() || undefined, model: form.model.trim() || undefined, mpn: form.mpn.trim() || undefined,
      price: form.price === '' ? undefined : Number(form.price), quantity: form.quantity === '' ? undefined : Number(form.quantity),
      categoryId: form.categoryId.trim() || undefined, categoryName: form.categoryName.trim() || undefined,
      verticalAttributes: { ...attributes, categoryFamily: form.categoryFamily, inventoryMode: form.inventoryMode, shippingMode: form.shippingMode },
      conditionId: form.conditionId.trim() || undefined, conditionLabel: form.conditionLabel.trim() || undefined,
      imageUrls: form.imageUrls.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      ...(units?.length ? { units } : {}),
    };
  }
  async function searchCategories() {
    if (!selectedAccount?.marketplaceId || !categoryQuery.trim()) { setMessage('Choose a connected B&I seller and enter a category search.'); return; }
    setCategoryBusy(true); setMessage('');
    try {
      const path = '/api/business-industrial/ebay/accounts/' + selectedAccount.id + '/categories?q=' + encodeURIComponent(categoryQuery.trim()) + '&marketplaceId=' + encodeURIComponent(selectedAccount.marketplaceId);
      setCategorySuggestions(await fetchWithAuth<CategorySuggestion[]>(withOrganization(path, activeOrganizationId)));
    } catch (err) { setMessage(messageOf(err)); }
    finally { setCategoryBusy(false); }
  }
  async function loadCategoryMetadata(categoryId = form.categoryId) {
    if (!selectedAccount?.marketplaceId || !categoryId.trim()) { setMessage('Choose a connected B&I seller and eBay leaf category first.'); return; }
    setCategoryBusy(true); setMessage('Loading eBay category requirements…');
    try {
      const path = '/api/business-industrial/ebay/accounts/' + selectedAccount.id + '/categories/' + encodeURIComponent(categoryId.trim()) + '/metadata?marketplaceId=' + encodeURIComponent(selectedAccount.marketplaceId);
      const metadata = await fetchWithAuth<CategoryMetadata>(withOrganization(path, activeOrganizationId));
      setCategoryMetadata(metadata);
      setAspectValues((current) => {
        const next = { ...current };
        for (const aspect of metadata.aspects) if (next[aspect.localizedAspectName] === undefined) next[aspect.localizedAspectName] = '';
        return next;
      });
      setMessage('eBay category requirements loaded. Complete every required item specific and select a supported condition.');
    } catch (err) { setMessage(messageOf(err)); }
    finally { setCategoryBusy(false); }
  }
  function chooseCategory(suggestion: CategorySuggestion) {
    const id = suggestion.category?.categoryId ?? '';
    update('categoryId', id);
    update('categoryName', suggestion.category?.categoryName ?? '');
    setCategorySuggestions([]);
    void loadCategoryMetadata(id);
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      await fetchWithAuth(editingId ? '/api/business-industrial/listings/' + editingId : '/api/business-industrial/listings', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload()) });
      setMessage(editingId ? 'B&I draft updated and returned to compliance review.' : 'B&I draft created and queued for compliance review.');
      reset(); await load();
    } catch (err) { setMessage(messageOf(err)); }
    finally { setSaving(false); }
  }
  async function publish(listing: Listing) {
    const account = selectedAccount;
    if (!account?.marketplaceId) { setMessage('Connect an enabled B&I eBay seller before publishing.'); return; }
    setMessage('Validating category requirements and seller policies…');
    try {
      const target = { ebayAccountId: account.id, marketplaceId: account.marketplaceId };
      const validation = await fetchWithAuth<{ results: Array<{ blockingErrors?: string[]; warnings?: string[] }> }>('/api/business-industrial/ebay/listings/validate', { method: 'POST', body: JSON.stringify({ catalogProductId: listing.id, targets: [target], organizationId: activeOrganizationId ?? undefined }) });
      const blockingErrors = validation.results.flatMap((item) => item.blockingErrors ?? []);
      if (blockingErrors.length) { setMessage('Publish blocked: ' + blockingErrors.join('; ')); return; }
      const result = await fetchWithAuth<{ jobId: string }>('/api/business-industrial/ebay/listings/publish', { method: 'POST', body: JSON.stringify({ catalogProductId: listing.id, targets: [target], organizationId: activeOrganizationId ?? undefined, idempotencyKey: 'bi-' + listing.id + '-' + Date.now() }) });
      setMessage('B&I publish job ' + result.jobId + ' queued for ' + account.storeName + '. Tracking eBay result…');
      void watchPublishJob(result.jobId, listing.id, account.storeName);
    } catch (err) { setMessage(messageOf(err)); }
  }
  async function watchPublishJob(jobId: string, listingId: string, storeName: string, attempt = 0) {
    try {
      const job = await fetchWithAuth<{ status: string; targets: Array<{ status: string; errorPayload?: unknown }> }>(withOrganization('/api/business-industrial/ebay/listing-jobs/' + jobId, activeOrganizationId));
      if (['completed', 'partial', 'failed'].includes(job.status) || job.targets.every((target) => ['published', 'failed', 'skipped'].includes(target.status))) {
        const failed = job.targets.filter((target) => target.status === 'failed');
        setMessage(failed.length ? 'eBay publish failed for ' + storeName + ': ' + failed.map((item) => JSON.stringify(item.errorPayload ?? 'Unknown eBay error')).join('; ') : 'Published successfully to ' + storeName + '.');
        await inspectChannels(listingId);
        return;
      }
      if (attempt >= 40) { setMessage('Publish is still processing. Use Publications to refresh its status.'); return; }
      window.setTimeout(() => void watchPublishJob(jobId, listingId, storeName, attempt + 1), 3000);
    } catch (err) { setMessage(messageOf(err)); }
  }
  async function inspectChannels(listingId: string) {
    try {
      const result = await fetchWithAuth<{ items: Channel[] }>(withOrganization('/api/business-industrial/ebay/listings?catalogProductId=' + encodeURIComponent(listingId), activeOrganizationId));
      setChannels((current) => ({ ...current, [listingId]: result.items }));
    } catch (err) { setMessage(messageOf(err)); }
  }
  async function endChannel(channel: Channel, listingId: string) {
    try {
      await fetchWithAuth(withOrganization('/api/business-industrial/ebay/listings/' + channel.id + '/end', activeOrganizationId), { method: 'POST' });
      setMessage('eBay publication ended and verified.'); await inspectChannels(listingId);
    } catch (err) { setMessage(messageOf(err)); }
  }

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-cyan-600">Business &amp; Industrial catalog</p><h1 className="text-3xl font-semibold">{editingId ? 'Edit B&I draft' : 'Listings'}</h1><p className="mt-2 text-slate-500">Capture traceable technical specifications, physical-unit identity, condition, testing, and shipping data before publishing.</p></div>{editingId && <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={reset}>New draft</button>}</div>
    <form onSubmit={(event) => void save(event)} className="mt-6 space-y-5 rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900">
      <section><h2 className="font-semibold">Identity, seller, and eBay category</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={label}>Target B&amp;I seller<select className={field + ' mt-1 w-full'} value={selectedAccount?.id ?? ''} onChange={(event) => { setSelectedAccountId(event.target.value); setCategoryMetadata(null); }}><option value="">Choose connected seller</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.storeName} · {account.marketplaceId || 'marketplace unavailable'} · {account.status}</option>)}</select></label><label className={label}>SKU<input required maxLength={160} className={field + ' mt-1 w-full'} value={form.sku} disabled={!!editingId} onChange={(event) => update('sku', event.target.value)} /></label><label className={label}>Title<input required maxLength={200} className={field + ' mt-1 w-full'} value={form.title} onChange={(event) => update('title', event.target.value)} /></label><label className={label}>Manufacturer<input maxLength={200} className={field + ' mt-1 w-full'} value={form.manufacturer} onChange={(event) => update('manufacturer', event.target.value)} /></label><label className={label}>Model<input maxLength={200} className={field + ' mt-1 w-full'} value={form.model} onChange={(event) => update('model', event.target.value)} /></label><label className={label}>MPN<input maxLength={200} className={field + ' mt-1 w-full'} value={form.mpn} onChange={(event) => update('mpn', event.target.value)} /></label><label className={label}>Category family<select required className={field + ' mt-1 w-full'} value={form.categoryFamily} onChange={(event) => update('categoryFamily', event.target.value)}><option value="">Select deliberate family</option>{families.map((family) => <option key={family.id} value={family.id}>{family.label}{family.restricted ? ' (restricted)' : ''}</option>)}</select></label><label className={label}>Search eBay categories<div className="mt-1 flex gap-2"><input className={field + ' min-w-0 flex-1'} value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="e.g. industrial servo drive" /><button type="button" disabled={categoryBusy} className="rounded-lg border border-cyan-500 px-3 py-2 text-sm font-semibold text-cyan-700" onClick={() => void searchCategories()}>Search</button></div></label>{categorySuggestions.length > 0 && <div className="sm:col-span-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">{categorySuggestions.map((suggestion) => <button type="button" key={suggestion.category?.categoryId} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-cyan-50 dark:hover:bg-slate-800" onClick={() => chooseCategory(suggestion)}>{suggestion.category?.categoryName || 'Unnamed category'} ({suggestion.category?.categoryId})</button>)}</div>}<label className={label}>eBay leaf category ID<div className="mt-1 flex gap-2"><input required inputMode="numeric" pattern="[0-9]+" className={field + ' min-w-0 flex-1'} value={form.categoryId} onChange={(event) => { update('categoryId', event.target.value); setCategoryMetadata(null); }} /><button type="button" disabled={categoryBusy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => void loadCategoryMetadata()}>Load</button></div></label><label className={label}>eBay category name<input className={field + ' mt-1 w-full'} value={form.categoryName} onChange={(event) => update('categoryName', event.target.value)} /></label><label className={label}>eBay condition<select required className={field + ' mt-1 w-full'} value={form.conditionId} onChange={(event) => { const id = event.target.value; update('conditionId', id); update('conditionLabel', CONDITION_LABELS[id] ?? form.conditionLabel); }}><option value="">Choose category-supported condition</option>{(categoryMetadata?.supportedConditions.length ? categoryMetadata.supportedConditions : Object.keys(CONDITION_LABELS)).map((id) => <option key={id} value={id}>{CONDITION_LABELS[id] || 'Condition ' + id} ({id})</option>)}</select></label><label className={label}>Condition description<input required maxLength={100} className={field + ' mt-1 w-full'} value={form.conditionLabel} onChange={(event) => update('conditionLabel', event.target.value)} placeholder="Describe actual tested condition" /></label><label className={label}>Price<input required type="number" min="0" step="0.01" className={field + ' mt-1 w-full'} value={form.price} onChange={(event) => update('price', event.target.value)} /></label><label className={label}>Quantity<input required type="number" min="0" step="1" className={field + ' mt-1 w-full'} value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></label><label className={label + ' sm:col-span-2'}>Description<textarea maxLength={20000} className={field + ' mt-1 min-h-20 w-full'} value={form.description} onChange={(event) => update('description', event.target.value)} /></label><label className={label + ' sm:col-span-2'}>Public HTTPS image URLs (one per line)<textarea required className={field + ' mt-1 min-h-24 w-full'} value={form.imageUrls} onChange={(event) => update('imageUrls', event.target.value)} placeholder="https://cdn.example.com/front.jpg" /></label></div>{categoryMetadata && <div className="mt-5"><h3 className="font-medium">eBay item specifics</h3><p className="mt-1 text-xs text-slate-500">Required fields are marked. Separate multiple values with commas.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{categoryMetadata.aspects.map((aspect) => <label key={aspect.localizedAspectName} className={label}>{aspect.localizedAspectName}{aspect.aspectConstraint?.aspectRequired ? ' *' : ''}<input required={Boolean(aspect.aspectConstraint?.aspectRequired)} className={field + ' mt-1 w-full'} value={aspectValues[aspect.localizedAspectName] ?? ''} onChange={(event) => setAspectValues((current) => ({ ...current, [aspect.localizedAspectName]: event.target.value }))} placeholder={(aspect.aspectValues ?? []).map((item) => item.localizedValue).filter(Boolean).slice(0, 4).join(', ')} /></label>)}</div></div>}</section>
      <section><h2 className="font-semibold">Condition, testing, certification, and completeness</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={label}>Functional status<input className={field + ' mt-1 w-full'} placeholder="Tested / untested / repairable" value={form.functionalStatus} onChange={(event) => update('functionalStatus', event.target.value)} /></label><label className={label}>Cosmetic condition<input className={field + ' mt-1 w-full'} value={form.cosmeticCondition} onChange={(event) => update('cosmeticCondition', event.target.value)} /></label><label className={label}>Testing scope<input className={field + ' mt-1 w-full'} value={form.testingScope} onChange={(event) => update('testingScope', event.target.value)} /></label><label className={label}>Test results<textarea className={field + ' mt-1 min-h-16 w-full'} value={form.testResults} onChange={(event) => update('testResults', event.target.value)} /></label><label className={label}>Operating hours<input type="number" min="0" className={field + ' mt-1 w-full'} value={form.operatingHours} onChange={(event) => update('operatingHours', event.target.value)} /></label><label className={label}>Inspection date<input type="date" className={field + ' mt-1 w-full'} value={form.inspectionDate} onChange={(event) => update('inspectionDate', event.target.value)} /></label><label className={label}>Calibration status<input className={field + ' mt-1 w-full'} value={form.calibrationStatus} onChange={(event) => update('calibrationStatus', event.target.value)} /></label><label className={label}>Calibration date<input type="date" className={field + ' mt-1 w-full'} value={form.calibrationDate} onChange={(event) => update('calibrationDate', event.target.value)} /></label><label className={label}>Certification type<input className={field + ' mt-1 w-full'} value={form.certificationType} onChange={(event) => update('certificationType', event.target.value)} /></label><label className={label}>Certification evidence<input className={field + ' mt-1 w-full'} value={form.certificationEvidence} onChange={(event) => update('certificationEvidence', event.target.value)} /></label><label className={label}>Included components<textarea className={field + ' mt-1 min-h-16 w-full'} value={form.includedComponents} onChange={(event) => update('includedComponents', event.target.value)} /></label><label className={label}>Accessories<textarea className={field + ' mt-1 min-h-16 w-full'} value={form.accessories} onChange={(event) => update('accessories', event.target.value)} /></label><label className={label}>Manuals<textarea className={field + ' mt-1 min-h-16 w-full'} value={form.manuals} onChange={(event) => update('manuals', event.target.value)} /></label><label className={label}>Missing parts<textarea className={field + ' mt-1 min-h-16 w-full'} value={form.missingParts} onChange={(event) => update('missingParts', event.target.value)} /></label><label className={label}>Service history<textarea className={field + ' mt-1 min-h-16 w-full'} value={form.serviceHistory} onChange={(event) => update('serviceHistory', event.target.value)} /></label><label className={label}>Warranty terms<textarea className={field + ' mt-1 min-h-16 w-full'} value={form.warrantyTerms} onChange={(event) => update('warrantyTerms', event.target.value)} /></label></div></section>
      <section><h2 className="font-semibold">Technical specifications</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[['voltage', 'Voltage'], ['frequency', 'Frequency'], ['current', 'Current'], ['power', 'Power'], ['capacity', 'Capacity'], ['pressure', 'Pressure'], ['weight', 'Weight']].map(([key, text]) => <label className={label} key={key}>{text}<div className="mt-1 flex gap-2"><input type="number" min="0" step="any" className={field + ' min-w-0 flex-1'} value={form[key]} onChange={(event) => update(key, event.target.value)} /><input className={field + ' w-24'} aria-label={text + ' unit'} value={form[key + 'Unit']} onChange={(event) => update(key + 'Unit', event.target.value)} /></div></label>)}{[['phase', 'Phase'], ['material', 'Material'], ['connectionSize', 'Connection size'], ['tolerance', 'Tolerance'], ['compatibleEquipment', 'Compatible equipment']].map(([key, text]) => <label className={label} key={key}>{text}<input className={field + ' mt-1 w-full'} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>)}{[['dimensionsLength', 'Length'], ['dimensionsWidth', 'Width'], ['dimensionsHeight', 'Height']].map(([key, text]) => <label className={label} key={key}>{text}<input type="number" min="0" step="any" className={field + ' mt-1 w-full'} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>)}<label className={label}>Dimensions unit<input className={field + ' mt-1 w-full'} value={form.dimensionsUnit} onChange={(event) => update('dimensionsUnit', event.target.value)} /></label></div></section>
      <section><h2 className="font-semibold">Inventory and shipping</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={label}>Inventory mode<select className={field + ' mt-1 w-full'} value={form.inventoryMode} onChange={(event) => update('inventoryMode', event.target.value)}><option value="single">Single item</option><option value="serialized">Serialized units</option><option value="multipack">Multipack</option><option value="lot">Lot</option></select></label><label className={label}>Shipping mode<select className={field + ' mt-1 w-full'} value={form.shippingMode} onChange={(event) => update('shippingMode', event.target.value)}><option value="parcel">Parcel</option><option value="freight">Freight</option><option value="local_pickup">Local pickup</option></select></label>{form.inventoryMode === 'serialized' && <label className={label + ' sm:col-span-2'}>Private serial records<textarea required className={field + ' mt-1 min-h-24 w-full'} placeholder="One per line: PRIVATE_SERIAL | PUBLIC_SERIAL (public value optional)" value={form.serialNumbers} onChange={(event) => update('serialNumbers', event.target.value)} /></label>}{(form.inventoryMode === 'lot' || form.inventoryMode === 'multipack') && <><label className={label}>Sellable lots<input required type="number" min="1" className={field + ' mt-1 w-full'} value={form.sellableLots} onChange={(event) => update('sellableLots', event.target.value)} /></label><label className={label}>Units per lot<input required type="number" min="1" className={field + ' mt-1 w-full'} value={form.unitsPerLot} onChange={(event) => update('unitsPerLot', event.target.value)} /></label><label className={label}>Total physical units<input required type="number" min="1" className={field + ' mt-1 w-full'} value={form.totalPhysicalUnits} onChange={(event) => update('totalPhysicalUnits', event.target.value)} /></label></>}<label className={label}>Dispatch location<input required className={field + ' mt-1 w-full'} value={form.dispatchLocation} onChange={(event) => update('dispatchLocation', event.target.value)} /></label><label className={label}>Shipping coverage<input required className={field + ' mt-1 w-full'} value={form.shippingCoverage} onChange={(event) => update('shippingCoverage', event.target.value)} /></label>{form.shippingMode !== 'local_pickup' && <><label className={label}>Packed weight<div className="mt-1 flex gap-2"><input required type="number" min="0" step="any" className={field + ' min-w-0 flex-1'} value={form.packedWeight} onChange={(event) => update('packedWeight', event.target.value)} /><input className={field + ' w-24'} value={form.packedWeightUnit} onChange={(event) => update('packedWeightUnit', event.target.value)} /></div></label><label className={label}>Packed dimensions (L × W × H)<div className="mt-1 grid grid-cols-3 gap-2">{['packedLength', 'packedWidth', 'packedHeight'].map((key) => <input required type="number" min="0" step="any" key={key} className={field + ' w-full'} value={form[key]} aria-label={key} onChange={(event) => update(key, event.target.value)} />)}</div></label></>}<label className={label}>Handling time<input className={field + ' mt-1 w-full'} value={form.handlingTime} onChange={(event) => update('handlingTime', event.target.value)} /></label><label className={label}>Pallet weight<div className="mt-1 flex gap-2"><input type="number" min="0" step="any" className={field + ' min-w-0 flex-1'} value={form.palletWeight} onChange={(event) => update('palletWeight', event.target.value)} /><input className={field + ' w-24'} value={form.palletWeightUnit} onChange={(event) => update('palletWeightUnit', event.target.value)} /></div></label><label className={label}>Crate weight<div className="mt-1 flex gap-2"><input type="number" min="0" step="any" className={field + ' min-w-0 flex-1'} value={form.crateWeight} onChange={(event) => update('crateWeight', event.target.value)} /><input className={field + ' w-24'} value={form.crateWeightUnit} onChange={(event) => update('crateWeightUnit', event.target.value)} /></div></label>{form.shippingMode === 'freight' && <><label className={label}>Freight loading facilities<input required className={field + ' mt-1 w-full'} value={form.freightLoadingFacilities} onChange={(event) => update('freightLoadingFacilities', event.target.value)} /></label><label className={label}>Liftgate requirements<input className={field + ' mt-1 w-full'} value={form.liftgate} onChange={(event) => update('liftgate', event.target.value)} /></label><label className={label}>Residential delivery<input className={field + ' mt-1 w-full'} value={form.residentialDelivery} onChange={(event) => update('residentialDelivery', event.target.value)} /></label></>}</div></section>
      <button disabled={saving} className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50" type="submit">{saving ? 'Saving…' : editingId ? 'Update B&I draft' : 'Save B&I draft'}</button>{message && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
    </form>
    <section className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900"><div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h2 className="font-semibold">Catalog records</h2><p className="mt-1 text-xs text-slate-500">Publish uses the selected dedicated B&amp;I seller; category metadata and required aspects are validated server-side.</p></div>{loading && <p className="p-4 text-sm text-slate-500">Loading listings…</p>}{!loading && listings.map((listing) => <div className="border-b border-slate-100 p-4 dark:border-slate-800" key={listing.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{listing.title}</p><p className="text-sm text-slate-500">{listing.sku} · {listing.categoryName || listing.categoryId || 'Category pending'} · {listing.verticalValidationStatus} · qty {listing.quantity ?? 0}{listing.serializedUnitCount ? ' · ' + listing.serializedUnitCount + ' serialized unit(s)' : ''}</p></div><div className="flex flex-wrap gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => edit(listing)}>Edit</button>{listing.verticalValidationStatus === 'approved' && <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void publish(listing)}>Validate &amp; publish</button>}<button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => void inspectChannels(listing.id)}>Publications</button></div></div>{channels[listing.id] && <div className="mt-3 space-y-2">{channels[listing.id].map((channel) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800" key={channel.id}><span>{channel.storeName} · {channel.marketplaceId} · {channel.listingStatus}{channel.listingUrl ? ' · ' + channel.listingUrl : ''}</span>{channel.listingStatus === 'published' && <button className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => void endChannel(channel, listing.id)}>End publication</button>}</div>)}</div>}</div>)}{!loading && !listings.length && <p className="p-4 text-sm text-slate-500">No Business &amp; Industrial listings yet.</p>}</section>
  </div>;
}
