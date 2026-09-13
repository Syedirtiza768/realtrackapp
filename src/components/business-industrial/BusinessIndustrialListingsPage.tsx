import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';
import { getCatalogProduct } from '../catalog/shared/catalogApi';
import { CATALOG_CONFIGS } from '../catalog/shared/catalogConfig';
import type { CatalogItem } from '../catalog/shared/catalogTypes';
import ConfirmDialog from '../ui/ConfirmDialog';
import FeedbackPanel from '../ui/FeedbackPanel';
import Field, { FIELD_CONTROL, fieldControlStyle } from '../ui/Field';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { ErrorState, LoadingPlaceholder } from '../ui/StatusBlock';

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

const SECTIONS = [
  { id: 'identity', title: 'Product identity' },
  { id: 'category', title: 'Category and marketplace' },
  { id: 'condition', title: 'Condition and evidence' },
  { id: 'specifications', title: 'Technical specifications' },
  { id: 'inventory', title: 'Inventory' },
  { id: 'shipping', title: 'Shipping' },
] as const;

const UNIT_OPTIONS: Record<string, string[]> = {
  voltageUnit: ['V', 'kV', 'mV'],
  frequencyUnit: ['Hz', 'kHz', 'MHz'],
  currentUnit: ['A', 'mA', 'kA'],
  powerUnit: ['W', 'kW', 'MW', 'VA', 'kVA', 'HP'],
  capacityUnit: ['L', 'mL', 'gal', 'kg', 't', 'A·h', 'Ah'],
  pressureUnit: ['Pa', 'kPa', 'MPa', 'bar', 'psi'],
  weightUnit: ['g', 'kg', 'lb', 'oz', 't'],
  dimensionsUnit: ['mm', 'cm', 'm', 'in', 'ft'],
  packedDimensionsUnit: ['mm', 'cm', 'm', 'in', 'ft'],
  packedWeightUnit: ['kg', 'lb', 'oz', 't'],
  palletWeightUnit: ['kg', 'lb', 'oz', 't'],
  crateWeightUnit: ['kg', 'lb', 'oz', 't'],
};

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

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';
const valueOf = (attributes: Record<string, unknown>, key: string) => {
  const value = attributes[key];
  return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
};
const withOrganization = (path: string, organizationId: string | null) => {
  if (!organizationId) return path;
  return path + (path.includes('?') ? '&' : '?') + 'organizationId=' + encodeURIComponent(organizationId);
};

function listingFromCatalog(item: CatalogItem): Listing {
  return {
    id: item.id,
    sku: item.sku,
    title: item.title,
    description: item.description,
    brand: item.brand,
    mpn: item.mpn,
    conditionId: item.conditionId,
    conditionLabel: item.conditionLabel,
    price: item.price,
    imageUrls: item.imageUrls,
    verticalValidationStatus: item.verticalValidationStatus,
    quantity: item.quantity,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    verticalAttributes: item.verticalAttributes,
    serializedUnitCount: 0,
  };
}

function controlProps(id: string, extra = '') {
  return {
    id,
    className: `${FIELD_CONTROL} ${extra}`,
    style: fieldControlStyle,
  };
}

export default function BusinessIndustrialListingsPage() {
  const { activeOrganizationId } = useAuth();
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [channels, setChannels] = useState<Record<string, Channel[]>>({});
  const [form, setForm] = useState(initialForm);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialForm));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordUnavailable, setRecordUnavailable] = useState('');
  const [activeSection, setActiveSection] = useState<string>('identity');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [categoryMetadata, setCategoryMetadata] = useState<CategoryMetadata | null>(null);
  const [aspectValues, setAspectValues] = useState<Record<string, string>>({});
  const [aspectBaseline, setAspectBaseline] = useState('{}');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const dirty = useMemo(
    () => JSON.stringify(form) !== baseline || JSON.stringify(aspectValues) !== aspectBaseline,
    [form, baseline, aspectValues, aspectBaseline],
  );
  const blocker = useBlocker(dirty && !saving);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const requestedEditId = searchParams.get('edit');
      const [items, categoryFamilies, sellers] = await Promise.all([
        fetchWithAuth<Listing[]>(withOrganization('/api/business-industrial/listings?limit=200', activeOrganizationId)),
        fetchWithAuth<Family[]>('/api/business-industrial/categories'),
        fetchWithAuth<Account[]>(withOrganization('/api/business-industrial/ebay/accounts', activeOrganizationId)),
      ]);
      setListings(items);
      setFamilies(categoryFamilies);
      setAccounts(sellers);
      setSelectedAccountId((current) => current || sellers[0]?.id || '');
      if (requestedEditId) {
        const fromList = items.find((item) => item.id === requestedEditId);
        if (fromList) {
          applyListing(fromList);
          setRecordUnavailable('');
        } else {
          try {
            const product = await getCatalogProduct(CATALOG_CONFIGS.business_industrial, requestedEditId, activeOrganizationId);
            applyListing(listingFromCatalog(product));
            setRecordUnavailable('');
          } catch {
            setRecordUnavailable('This listing is unavailable or is not in the current Business & Industrial workspace.');
          }
        }
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [activeOrganizationId, searchParams]);

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function reset() {
    setEditingId(null);
    setForm({ ...initialForm });
    setBaseline(JSON.stringify(initialForm));
    setCategoryMetadata(null);
    setCategorySuggestions([]);
    setAspectValues({});
    setAspectBaseline('{}');
    setRecordUnavailable('');
  }

  function applyListing(listing: Listing) {
    const attributes = listing.verticalAttributes ?? {};
    const next: Record<string, string> = {
      ...initialForm,
      sku: listing.sku ?? '',
      title: listing.title,
      description: listing.description ?? '',
      manufacturer: listing.brand ?? '',
      mpn: listing.mpn ?? '',
      conditionId: listing.conditionId ?? '',
      conditionLabel: listing.conditionLabel ?? '',
      price: listing.price == null ? '' : String(listing.price),
      quantity: listing.quantity == null ? '' : String(listing.quantity),
      imageUrls: (listing.imageUrls ?? []).join('\n'),
      categoryId: listing.categoryId ?? '',
      categoryName: listing.categoryName ?? '',
    };
    for (const key of Object.keys(next)) if (key in attributes) next[key] = valueOf(attributes, key);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setEditingId(listing.id);
    setSuccess('');
    setError('');
    setActiveSection('identity');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCategoryMetadata(null);
    const nextAspects = Object.fromEntries(Object.entries(attributes).filter(([key]) => !(key in next)).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value ?? '')]));
    setAspectValues(nextAspects);
    setAspectBaseline(JSON.stringify(nextAspects));
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
    if (!selectedAccount?.marketplaceId || !categoryQuery.trim()) { setError('Choose a connected B&I seller and enter a category search.'); return; }
    setCategoryBusy(true); setError('');
    try {
      const path = '/api/business-industrial/ebay/accounts/' + selectedAccount.id + '/categories?q=' + encodeURIComponent(categoryQuery.trim()) + '&marketplaceId=' + encodeURIComponent(selectedAccount.marketplaceId);
      setCategorySuggestions(await fetchWithAuth<CategorySuggestion[]>(withOrganization(path, activeOrganizationId)));
    } catch (err) { setError(messageOf(err)); }
    finally { setCategoryBusy(false); }
  }

  async function loadCategoryMetadata(categoryId = form.categoryId) {
    if (!selectedAccount?.marketplaceId || !categoryId.trim()) { setError('Choose a connected B&I seller and eBay leaf category first.'); return; }
    setCategoryBusy(true); setSuccess('Loading eBay category requirements…');
    try {
      const path = '/api/business-industrial/ebay/accounts/' + selectedAccount.id + '/categories/' + encodeURIComponent(categoryId.trim()) + '/metadata?marketplaceId=' + encodeURIComponent(selectedAccount.marketplaceId);
      const metadata = await fetchWithAuth<CategoryMetadata>(withOrganization(path, activeOrganizationId));
      setCategoryMetadata(metadata);
      setAspectValues((current) => {
        const next = { ...current };
        for (const aspect of metadata.aspects) if (next[aspect.localizedAspectName] === undefined) next[aspect.localizedAspectName] = '';
        return next;
      });
      setSuccess('eBay category requirements loaded. Complete every required item specific and select a supported condition. Completing these fields does not make the draft publishable until compliance review approves it.');
    } catch (err) { setError(messageOf(err)); setSuccess(''); }
    finally { setCategoryBusy(false); }
  }

  function chooseCategory(suggestion: CategorySuggestion) {
    const id = suggestion.category?.categoryId ?? '';
    update('categoryId', id);
    update('categoryName', suggestion.category?.categoryName ?? '');
    setCategorySuggestions([]);
    void loadCategoryMetadata(id);
  }

  function revealInvalid(event: FormEvent) {
    const field = event.target as HTMLElement;
    const section = field.closest('[data-editor-section]') as HTMLElement | null;
    if (!section?.id) return;
    setActiveSection(section.id);
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await fetchWithAuth(editingId ? '/api/business-industrial/listings/' + editingId : '/api/business-industrial/listings', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload()) });
      setSuccess(editingId ? 'B&I draft updated and returned to compliance review. Visible field completeness does not authorize publication.' : 'B&I draft created and queued for compliance review. Visible field completeness does not authorize publication.');
      reset();
      await load();
    } catch (err) { setError(messageOf(err)); }
    finally { setSaving(false); }
  }

  async function publish(listing: Listing) {
    const account = selectedAccount;
    if (!account?.marketplaceId) { setError('Connect an enabled B&I eBay seller before publishing.'); return; }
    setSuccess('Validating category requirements and seller policies…');
    setError('');
    try {
      const target = { ebayAccountId: account.id, marketplaceId: account.marketplaceId };
      const validation = await fetchWithAuth<{ results: Array<{ blockingErrors?: string[]; warnings?: string[] }> }>('/api/business-industrial/ebay/listings/validate', { method: 'POST', body: JSON.stringify({ catalogProductId: listing.id, targets: [target], organizationId: activeOrganizationId ?? undefined }) });
      const blockingErrors = validation.results.flatMap((item) => item.blockingErrors ?? []);
      if (blockingErrors.length) { setError('Publish blocked: ' + blockingErrors.join('; ')); setSuccess(''); return; }
      const result = await fetchWithAuth<{ jobId: string }>('/api/business-industrial/ebay/listings/publish', { method: 'POST', body: JSON.stringify({ catalogProductId: listing.id, targets: [target], organizationId: activeOrganizationId ?? undefined, idempotencyKey: 'bi-' + listing.id + '-' + Date.now() }) });
      setSuccess('B&I publish job ' + result.jobId + ' queued for ' + account.storeName + '. Tracking eBay result…');
      void watchPublishJob(result.jobId, listing.id, account.storeName);
    } catch (err) { setError(messageOf(err)); setSuccess(''); }
  }

  async function watchPublishJob(jobId: string, listingId: string, storeName: string, attempt = 0) {
    try {
      const job = await fetchWithAuth<{ status: string; targets: Array<{ status: string; errorPayload?: unknown }> }>(withOrganization('/api/business-industrial/ebay/listing-jobs/' + jobId, activeOrganizationId));
      if (['completed', 'partial', 'failed'].includes(job.status) || job.targets.every((target) => ['published', 'failed', 'skipped'].includes(target.status))) {
        const failed = job.targets.filter((target) => target.status === 'failed');
        if (failed.length) {
          setError('eBay publish failed for ' + storeName + ': ' + failed.map((item) => JSON.stringify(item.errorPayload ?? 'Unknown eBay error')).join('; '));
          setSuccess('');
        } else {
          setSuccess('Published successfully to ' + storeName + '.');
        }
        await inspectChannels(listingId);
        return;
      }
      if (attempt >= 40) { setSuccess('Publish is still processing. Use Publications to refresh its status. Closing this page does not cancel the job.'); return; }
      window.setTimeout(() => void watchPublishJob(jobId, listingId, storeName, attempt + 1), 3000);
    } catch (err) { setError(messageOf(err)); setSuccess(''); }
  }

  async function inspectChannels(listingId: string) {
    try {
      const result = await fetchWithAuth<{ items: Channel[] }>(withOrganization('/api/business-industrial/ebay/listings?catalogProductId=' + encodeURIComponent(listingId), activeOrganizationId));
      setChannels((current) => ({ ...current, [listingId]: result.items }));
    } catch (err) { setError(messageOf(err)); }
  }

  async function endChannel(channel: Channel, listingId: string) {
    try {
      await fetchWithAuth(withOrganization('/api/business-industrial/ebay/listings/' + channel.id + '/end', activeOrganizationId), { method: 'POST' });
      setSuccess('eBay publication ended and verified.');
      await inspectChannels(listingId);
    } catch (err) { setError(messageOf(err)); }
  }

  function goToSection(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function unitSelect(name: string, label: string) {
    const options = UNIT_OPTIONS[name] || [];
    return (
      <select aria-label={label} {...controlProps(name, 'w-28 shrink-0')} value={form[name]} onChange={(event) => update(name, event.target.value)}>
        {options.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        {form[name] && !options.includes(form[name]) ? <option value={form[name]}>{form[name]}</option> : null}
      </select>
    );
  }

  if (loading && !listings.length && !editingId) return <LoadingPlaceholder label="Loading Business and Industrial editor" rows={5} />;
  if (recordUnavailable) {
    return (
      <div className="space-y-4">
        <WorkspacePageHeader title="Listing unavailable" subtitle="The requested draft could not be opened in this workspace.">
          <Link className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" to="/business-industrial/catalog">Return to catalog</Link>
        </WorkspacePageHeader>
        <ErrorState message={recordUnavailable} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WorkspacePageHeader
        eyebrow="Business & Industrial catalog"
        title={editingId ? 'Edit B&I draft' : 'Create B&I draft'}
        subtitle="Capture identity, category, evidence, specifications, inventory, and shipping data. Saving a draft returns it to compliance review; completing visible fields does not authorize publication."
      >
        <Link className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600" to="/business-industrial/catalog">Return to catalog</Link>
        {editingId ? <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={reset}>New draft</button> : null}
      </WorkspacePageHeader>

      {error ? <FeedbackPanel tone="error">{error}</FeedbackPanel> : null}
      {success ? <FeedbackPanel tone="success">{success}</FeedbackPanel> : null}

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <nav aria-label="Editor sections" className="mb-4 lg:sticky lg:top-4 lg:mb-0 lg:self-start">
          <label className="mb-2 block text-sm font-medium lg:hidden" htmlFor="editor-section-index">Jump to section</label>
          <select id="editor-section-index" className={`${FIELD_CONTROL} lg:hidden`} value={activeSection} onChange={(event) => goToSection(event.target.value)}>
            {SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
          <ul className="hidden space-y-1 lg:block">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => goToSection(section.id)}
                  className={`flex min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm ${activeSection === section.id ? 'font-semibold' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  style={activeSection === section.id ? { backgroundColor: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)', color: 'var(--brand-primary)' } : undefined}
                >
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <form onSubmit={(event) => void save(event)} onInvalidCapture={revealInvalid} className="space-y-5">
          <section id="identity" data-editor-section className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-semibold">Product identity</h2>
            <p className="mt-1 text-xs text-slate-500">SKU, title, manufacturer, model, MPN, description, and public HTTPS images.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="SKU" htmlFor="sku" required><input required maxLength={160} {...controlProps('sku')} value={form.sku} disabled={!!editingId} onChange={(event) => update('sku', event.target.value)} /></Field>
              <Field label="Title" htmlFor="title" required><input required maxLength={200} {...controlProps('title')} value={form.title} onChange={(event) => update('title', event.target.value)} /></Field>
              <Field label="Manufacturer" htmlFor="manufacturer"><input maxLength={200} {...controlProps('manufacturer')} value={form.manufacturer} onChange={(event) => update('manufacturer', event.target.value)} /></Field>
              <Field label="Model" htmlFor="model"><input maxLength={200} {...controlProps('model')} value={form.model} onChange={(event) => update('model', event.target.value)} /></Field>
              <Field label="MPN" htmlFor="mpn"><input maxLength={200} {...controlProps('mpn')} value={form.mpn} onChange={(event) => update('mpn', event.target.value)} /></Field>
              <Field label="Price" htmlFor="price" required><input required type="number" min="0" step="0.01" {...controlProps('price')} value={form.price} onChange={(event) => update('price', event.target.value)} /></Field>
              <Field label="Description" htmlFor="description" className="sm:col-span-2"><textarea maxLength={20000} {...controlProps('description', 'min-h-20')} value={form.description} onChange={(event) => update('description', event.target.value)} /></Field>
              <Field label="Public HTTPS image URLs" htmlFor="imageUrls" required hint="One URL per line. Maximum 24 images." className="sm:col-span-2">
                <textarea required {...controlProps('imageUrls', 'min-h-24')} value={form.imageUrls} onChange={(event) => update('imageUrls', event.target.value)} placeholder="https://cdn.example.com/front.jpg" />
              </Field>
            </div>
          </section>

          <section id="category" data-editor-section className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-semibold">Category and marketplace</h2>
            <p className="mt-1 text-xs text-slate-500">Dedicated seller, category family, verified leaf category, and required eBay item specifics. Restricted medical/laboratory and hazardous-material families remain review-gated.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Target B&I seller" htmlFor="seller">
                <select id="seller" className={FIELD_CONTROL} style={fieldControlStyle} value={selectedAccount?.id ?? ''} onChange={(event) => { setSelectedAccountId(event.target.value); setCategoryMetadata(null); }}>
                  <option value="">Choose connected seller</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.storeName} · {account.marketplaceId || 'marketplace unavailable'} · {account.status}</option>)}
                </select>
              </Field>
              <Field label="Category family" htmlFor="categoryFamily" required>
                <select required {...controlProps('categoryFamily')} value={form.categoryFamily} onChange={(event) => update('categoryFamily', event.target.value)}>
                  <option value="">Select deliberate family</option>
                  {families.map((family) => <option key={family.id} value={family.id}>{family.label}{family.restricted ? ' (restricted)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Search eBay categories" htmlFor="categoryQuery" className="sm:col-span-2">
                <div className="flex gap-2">
                  <input id="categoryQuery" className={FIELD_CONTROL} style={fieldControlStyle} value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="e.g. industrial servo drive" />
                  <button type="button" disabled={categoryBusy} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => void searchCategories()}>Search</button>
                </div>
              </Field>
              {categorySuggestions.length > 0 ? (
                <div className="sm:col-span-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  {categorySuggestions.map((suggestion) => (
                    <button type="button" key={suggestion.category?.categoryId} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => chooseCategory(suggestion)}>
                      {suggestion.category?.categoryName || 'Unnamed category'} ({suggestion.category?.categoryId})
                    </button>
                  ))}
                </div>
              ) : null}
              <Field label="eBay leaf category ID" htmlFor="categoryId" required>
                <div className="flex gap-2">
                  <input required inputMode="numeric" pattern="[0-9]+" {...controlProps('categoryId')} value={form.categoryId} onChange={(event) => { update('categoryId', event.target.value); setCategoryMetadata(null); }} />
                  <button type="button" disabled={categoryBusy} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => void loadCategoryMetadata()}>Load</button>
                </div>
              </Field>
              <Field label="eBay category name" htmlFor="categoryName"><input {...controlProps('categoryName')} value={form.categoryName} onChange={(event) => update('categoryName', event.target.value)} /></Field>
              <Field label="eBay condition" htmlFor="conditionId" required>
                <select required {...controlProps('conditionId')} value={form.conditionId} onChange={(event) => { const id = event.target.value; update('conditionId', id); update('conditionLabel', CONDITION_LABELS[id] ?? form.conditionLabel); }}>
                  <option value="">Choose category-supported condition</option>
                  {(categoryMetadata?.supportedConditions.length ? categoryMetadata.supportedConditions : Object.keys(CONDITION_LABELS)).map((id) => <option key={id} value={id}>{CONDITION_LABELS[id] || 'Condition ' + id} ({id})</option>)}
                </select>
              </Field>
              <Field label="Condition description" htmlFor="conditionLabel" required><input required maxLength={100} {...controlProps('conditionLabel')} value={form.conditionLabel} onChange={(event) => update('conditionLabel', event.target.value)} placeholder="Describe actual tested condition" /></Field>
              {categoryMetadata ? (
                <div className="sm:col-span-2">
                  <h3 className="font-medium">eBay item specifics</h3>
                  <p className="mt-1 text-xs text-slate-500">Required fields are marked. Separate multiple values with commas.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {categoryMetadata.aspects.map((aspect) => (
                      <Field key={aspect.localizedAspectName} label={aspect.localizedAspectName} htmlFor={'aspect-' + aspect.localizedAspectName} required={Boolean(aspect.aspectConstraint?.aspectRequired)}>
                        <input required={Boolean(aspect.aspectConstraint?.aspectRequired)} id={'aspect-' + aspect.localizedAspectName} className={FIELD_CONTROL} style={fieldControlStyle} value={aspectValues[aspect.localizedAspectName] ?? ''} onChange={(event) => setAspectValues((current) => ({ ...current, [aspect.localizedAspectName]: event.target.value }))} placeholder={(aspect.aspectValues ?? []).map((item) => item.localizedValue).filter(Boolean).slice(0, 4).join(', ')} />
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section id="condition" data-editor-section className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-semibold">Condition and evidence</h2>
            <p className="mt-1 text-xs text-slate-500">Testing, calibration, certification, included components, and missing parts used during compliance review.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ['functionalStatus', 'Functional status', 'Tested / untested / repairable'],
                ['cosmeticCondition', 'Cosmetic condition'],
                ['testingScope', 'Testing scope'],
                ['operatingHours', 'Operating hours', '', 'number'],
                ['inspectionDate', 'Inspection date', '', 'date'],
                ['calibrationStatus', 'Calibration status'],
                ['calibrationDate', 'Calibration date', '', 'date'],
                ['certificationType', 'Certification type'],
                ['certificationEvidence', 'Certification evidence'],
              ] as Array<[string, string, string?, string?]>).map(([key, text, placeholder, type]) => (
                <Field key={key} label={text} htmlFor={key}>
                  <input type={type || 'text'} min={type === 'number' ? 0 : undefined} {...controlProps(key)} placeholder={placeholder} value={form[key]} onChange={(event) => update(key, event.target.value)} />
                </Field>
              ))}
              {(['testResults', 'includedComponents', 'accessories', 'manuals', 'missingParts', 'serviceHistory', 'warrantyTerms'] as const).map((key) => (
                <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())} htmlFor={key}>
                  <textarea {...controlProps(key, 'min-h-16')} value={form[key]} onChange={(event) => update(key, event.target.value)} />
                </Field>
              ))}
            </div>
          </section>

          <section id="specifications" data-editor-section className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-semibold">Technical specifications</h2>
            <p className="mt-1 text-xs text-slate-500">Pair each measurement with a supported unit. Value and unit must both be set when a measurement is provided.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {([
                ['voltage', 'Voltage', 'voltageUnit'],
                ['frequency', 'Frequency', 'frequencyUnit'],
                ['current', 'Current', 'currentUnit'],
                ['power', 'Power', 'powerUnit'],
                ['capacity', 'Capacity', 'capacityUnit'],
                ['pressure', 'Pressure', 'pressureUnit'],
                ['weight', 'Weight', 'weightUnit'],
              ] as const).map(([key, text, unitKey]) => (
                <Field key={key} label={text} htmlFor={key}>
                  <div className="flex gap-2">
                    <input type="number" min="0" step="any" {...controlProps(key)} value={form[key]} onChange={(event) => update(key, event.target.value)} />
                    {unitSelect(unitKey, text + ' unit')}
                  </div>
                </Field>
              ))}
              {(['phase', 'material', 'connectionSize', 'tolerance', 'compatibleEquipment'] as const).map((key) => (
                <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())} htmlFor={key}>
                  <input {...controlProps(key)} value={form[key]} onChange={(event) => update(key, event.target.value)} />
                </Field>
              ))}
              {(['dimensionsLength', 'dimensionsWidth', 'dimensionsHeight'] as const).map((key) => (
                <Field key={key} label={key.replace('dimensions', '')} htmlFor={key}>
                  <input type="number" min="0" step="any" {...controlProps(key)} value={form[key]} onChange={(event) => update(key, event.target.value)} />
                </Field>
              ))}
              <Field label="Dimensions unit" htmlFor="dimensionsUnit">{unitSelect('dimensionsUnit', 'Dimensions unit')}</Field>
            </div>
          </section>

          <section id="inventory" data-editor-section className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-semibold">Inventory</h2>
            <p className="mt-1 text-xs text-slate-500">Single-item, serialized, multipack, and lot semantics. Private serial numbers are not displayed after save; re-enter private records only when changing serialized units.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Quantity" htmlFor="quantity" required><input required type="number" min="0" step="1" {...controlProps('quantity')} value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></Field>
              <Field label="Inventory mode" htmlFor="inventoryMode">
                <select {...controlProps('inventoryMode')} value={form.inventoryMode} onChange={(event) => update('inventoryMode', event.target.value)}>
                  <option value="single">Single item</option>
                  <option value="serialized">Serialized units</option>
                  <option value="multipack">Multipack</option>
                  <option value="lot">Lot</option>
                </select>
              </Field>
              {form.inventoryMode === 'serialized' ? (
                <Field label="Private serial records" htmlFor="serialNumbers" required hint="One per line: PRIVATE_SERIAL | PUBLIC_SERIAL. The public value is optional." className="sm:col-span-2">
                  <textarea required {...controlProps('serialNumbers', 'min-h-24')} placeholder="One per line: PRIVATE_SERIAL | PUBLIC_SERIAL (public value optional)" value={form.serialNumbers} onChange={(event) => update('serialNumbers', event.target.value)} />
                </Field>
              ) : null}
              {form.inventoryMode === 'lot' || form.inventoryMode === 'multipack' ? (
                <>
                  <Field label="Sellable lots" htmlFor="sellableLots" required><input required type="number" min="1" {...controlProps('sellableLots')} value={form.sellableLots} onChange={(event) => update('sellableLots', event.target.value)} /></Field>
                  <Field label="Units per lot" htmlFor="unitsPerLot" required><input required type="number" min="1" {...controlProps('unitsPerLot')} value={form.unitsPerLot} onChange={(event) => update('unitsPerLot', event.target.value)} /></Field>
                  <Field label="Total physical units" htmlFor="totalPhysicalUnits" required hint="Must equal sellable lots × units per lot.">
                    <input required type="number" min="1" {...controlProps('totalPhysicalUnits')} value={form.totalPhysicalUnits} onChange={(event) => update('totalPhysicalUnits', event.target.value)} />
                  </Field>
                </>
              ) : null}
            </div>
          </section>

          <section id="shipping" data-editor-section className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-semibold">Shipping</h2>
            <p className="mt-1 text-xs text-slate-500">Dispatch location, coverage, packing details, and freight or local-pickup requirements. Switching modes keeps entered values.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Shipping mode" htmlFor="shippingMode">
                <select {...controlProps('shippingMode')} value={form.shippingMode} onChange={(event) => update('shippingMode', event.target.value)}>
                  <option value="parcel">Parcel</option>
                  <option value="freight">Freight</option>
                  <option value="local_pickup">Local pickup</option>
                </select>
              </Field>
              <Field label="Handling time" htmlFor="handlingTime"><input {...controlProps('handlingTime')} value={form.handlingTime} onChange={(event) => update('handlingTime', event.target.value)} /></Field>
              <Field label="Dispatch location" htmlFor="dispatchLocation" required><input required {...controlProps('dispatchLocation')} value={form.dispatchLocation} onChange={(event) => update('dispatchLocation', event.target.value)} /></Field>
              <Field label="Shipping coverage" htmlFor="shippingCoverage" required><input required {...controlProps('shippingCoverage')} value={form.shippingCoverage} onChange={(event) => update('shippingCoverage', event.target.value)} /></Field>
              {form.shippingMode !== 'local_pickup' ? (
                <>
                  <Field label="Packed weight" htmlFor="packedWeight" required>
                    <div className="flex gap-2">
                      <input required type="number" min="0" step="any" {...controlProps('packedWeight')} value={form.packedWeight} onChange={(event) => update('packedWeight', event.target.value)} />
                      {unitSelect('packedWeightUnit', 'Packed weight unit')}
                    </div>
                  </Field>
                  <Field label="Packed dimensions (L × W × H)" htmlFor="packedLength" required>
                    <div className="grid grid-cols-3 gap-2">
                      {(['packedLength', 'packedWidth', 'packedHeight'] as const).map((key) => (
                        <input required type="number" min="0" step="any" key={key} {...controlProps(key)} value={form[key]} aria-label={key} onChange={(event) => update(key, event.target.value)} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Packed dimensions unit" htmlFor="packedDimensionsUnit">{unitSelect('packedDimensionsUnit', 'Packed dimensions unit')}</Field>
                </>
              ) : null}
              <Field label="Pallet weight" htmlFor="palletWeight">
                <div className="flex gap-2">
                  <input type="number" min="0" step="any" {...controlProps('palletWeight')} value={form.palletWeight} onChange={(event) => update('palletWeight', event.target.value)} />
                  {unitSelect('palletWeightUnit', 'Pallet weight unit')}
                </div>
              </Field>
              <Field label="Crate weight" htmlFor="crateWeight">
                <div className="flex gap-2">
                  <input type="number" min="0" step="any" {...controlProps('crateWeight')} value={form.crateWeight} onChange={(event) => update('crateWeight', event.target.value)} />
                  {unitSelect('crateWeightUnit', 'Crate weight unit')}
                </div>
              </Field>
              {form.shippingMode === 'freight' ? (
                <>
                  <Field label="Freight loading facilities" htmlFor="freightLoadingFacilities" required><input required {...controlProps('freightLoadingFacilities')} value={form.freightLoadingFacilities} onChange={(event) => update('freightLoadingFacilities', event.target.value)} /></Field>
                  <Field label="Liftgate requirements" htmlFor="liftgate"><input {...controlProps('liftgate')} value={form.liftgate} onChange={(event) => update('liftgate', event.target.value)} /></Field>
                  <Field label="Residential delivery" htmlFor="residentialDelivery"><input {...controlProps('residentialDelivery')} value={form.residentialDelivery} onChange={(event) => update('residentialDelivery', event.target.value)} /></Field>
                </>
              ) : null}
            </div>
          </section>

          <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <p className="text-xs text-slate-500">Editing an existing draft can return it to compliance review. The backend remains authoritative for publication eligibility.</p>
            <button disabled={saving} className="min-h-11 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }} type="submit">
              {saving ? 'Saving…' : editingId ? 'Update B&I draft' : 'Save B&I draft'}
            </button>
          </div>
        </form>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="font-semibold">Recent catalog records</h2>
          <p className="mt-1 text-xs text-slate-500">Publish uses the selected dedicated B&I seller; category metadata and required aspects are validated server-side.</p>
        </div>
        {loading ? <p className="p-4 text-sm text-slate-500">Loading listings…</p> : null}
        {!loading && listings.map((listing) => (
          <div className="border-b border-slate-100 p-4 dark:border-slate-800" key={listing.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{listing.title}</p>
                <p className="text-sm text-slate-500">{listing.sku} · {listing.categoryName || listing.categoryId || 'Category pending'} · {listing.verticalValidationStatus} · qty {listing.quantity ?? 0}{listing.serializedUnitCount ? ' · ' + listing.serializedUnitCount + ' serialized unit(s)' : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => applyListing(listing)}>Edit</button>
                {listing.verticalValidationStatus === 'approved' ? <button className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void publish(listing)}>Validate &amp; publish</button> : null}
                <button className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => void inspectChannels(listing.id)}>Publications</button>
              </div>
            </div>
            {channels[listing.id] ? (
              <div className="mt-3 space-y-2">
                {channels[listing.id].map((channel) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800" key={channel.id}>
                    <span>{channel.storeName} · {channel.marketplaceId} · {channel.listingStatus}{channel.listingUrl ? ' · ' + channel.listingUrl : ''}</span>
                    {channel.listingStatus === 'published' ? <button className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => void endChannel(channel, listing.id)}>End publication</button> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {!loading && !listings.length ? <p className="p-4 text-sm text-slate-500">No Business &amp; Industrial listings yet.</p> : null}
      </section>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard unsaved changes?"
        description="You have unsaved listing changes. Leave this page only if you intend to discard them."
        confirmLabel="Leave without saving"
        tone="danger"
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
