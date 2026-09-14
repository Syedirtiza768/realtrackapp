import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  analyzeFashionImages,
  fashionAttributeKey,
  fashionAttributeText,
  fashionError,
  generateFashionListingContent,
  getFashionListing,
  getFashionMetadata,
  isFashionImageUrl,
  listFashionAccounts,
  saveFashionListing,
  searchFashionCategories,
  type FashionAccount,
  type FashionAttributes,
  type FashionCategory,
  type FashionDraft,
  type FashionListing,
  type FashionMetadata,
} from '../../lib/fashionListingsApi';
import { FASHION_FAMILIES, FASHION_FIELD_GROUPS, fashionFieldsForFamily, isFashionMetaKey, normalizeFashionFamily, type FashionFamily } from '../../lib/fashionFields';
import { sanitizeHtml } from '../../lib/sanitize';
import { toProxyUrl } from '../../lib/imageUrl';
import FashionListingPublishPanel from './FashionListingPublishPanel';
import FashionPhotoSet from './FashionPhotoSet';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800';
const panel = 'space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900';
type Form = { sku: string; title: string; description: string; brand: string; conditionId: string; price: string; quantity: string; images: string[]; categoryId: string; categoryName: string; verticalAttributes: FashionAttributes };
const empty: Form = { sku: '', title: '', description: '', brand: '', conditionId: '', price: '', quantity: '1', images: [], categoryId: '', categoryName: '', verticalAttributes: { categoryFamily: 'clothing' } };
function toForm(item: FashionListing): Form {
  return {
    sku: item.sku ?? '',
    title: item.title ?? '',
    description: item.description ?? '',
    brand: item.brand ?? fashionAttributeText(item.verticalAttributes?.brand),
    conditionId: item.conditionId ?? '',
    price: item.price == null ? '' : String(item.price),
    quantity: String(item.quantity ?? 0),
    images: (item.imageUrls ?? []).filter(Boolean),
    categoryId: item.categoryId ?? '',
    categoryName: item.categoryName ?? '',
    verticalAttributes: { categoryFamily: 'clothing', ...(item.verticalAttributes ?? {}) },
  };
}
function conditionFromLabel(value: string | null) {
  const label = (value ?? '').toUpperCase();
  if (label === 'NEW') return '1000';
  if (label === 'USED') return '3000';
  return '';
}
function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return typeof value === 'string' && value.trim() ? [value.trim()] : [];
}
function isTrue(value: unknown) {
  return value === true || value === 'true';
}

export default function FashionListingEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <FashionListingEditor key={id ?? 'new'} listingId={id} />;
}

function FashionListingEditor({ listingId }: { listingId?: string }) {
  const navigate = useNavigate();
  const { permissions, activeOrganizationId } = useAuth();
  const [listing, setListing] = useState<FashionListing>();
  const [form, setForm] = useState<Form>(empty);
  const [saved, setSaved] = useState(JSON.stringify(empty));
  const [loading, setLoading] = useState(!!listingId);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState<FashionAccount[]>([]);
  const [accountKey, setAccountKey] = useState('');
  const [accountError, setAccountError] = useState('');
  const [metadata, setMetadata] = useState<FashionMetadata>();
  const [metadataError, setMetadataError] = useState('');
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categories, setCategories] = useState<FashionCategory[]>([]);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState(false);
  const [confirmedKeys, setConfirmedKeys] = useState<string[]>([]);
  const [titleConfirmed, setTitleConfirmed] = useState(false);
  const [descriptionConfirmed, setDescriptionConfirmed] = useState(false);
  const [suggestedKeys, setSuggestedKeys] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<Array<{ key: string; current: string; suggested: string }>>([]);
  const [reviewPhotoSet, setReviewPhotoSet] = useState(false);
  const analyzeLock = useRef(false);
  const categoryRequest = useRef(0);
  const account = accounts.find((item) => `${item.id}:${item.marketplaceId}` === accountKey);
  const canView = !listingId || permissions.includes('fashion.listings.view');
  const locked = listing?.verticalValidationStatus === 'quarantined' || !!listing?.manualReview;
  const canEdit = permissions.includes(listingId ? 'fashion.listings.update' : 'fashion.listings.create') && !locked;
  const dirty = JSON.stringify(form) !== saved;
  const family = normalizeFashionFamily(form.verticalAttributes.categoryFamily);
  const visibleFields = useMemo(() => fashionFieldsForFamily(family), [family]);

  useEffect(() => {
    if (!listingId || !canView) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setLoadError('');
    getFashionListing(listingId, controller.signal, activeOrganizationId).then((item) => {
      setListing(item);
      const next = toForm(item);
      setForm(next);
      setSaved(JSON.stringify(next));
      const suggested = stringList(item.verticalAttributes?._suggestedKeys);
      const confirmed = stringList(item.verticalAttributes?._confirmedKeys);
      setSuggestedKeys(suggested);
      setConfirmedKeys(confirmed);
      setTitleConfirmed(isTrue(item.verticalAttributes?._titleConfirmed));
      setDescriptionConfirmed(isTrue(item.verticalAttributes?._descriptionConfirmed));
      setWarnings(stringList(item.verticalAttributes?._warnings));
      setReviewPhotoSet(isTrue(item.verticalAttributes?._multipleItems));
    }).catch((err) => { if (!controller.signal.aborted) setLoadError(fashionError(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [listingId, canView, reload, activeOrganizationId]);
  useEffect(() => {
    const controller = new AbortController(); setAccountError('');
    listFashionAccounts(controller.signal, activeOrganizationId).then(setAccounts).catch((err) => { if (!controller.signal.aborted) setAccountError(fashionError(err)); });
    return () => controller.abort();
  }, [reload, activeOrganizationId]);
  useEffect(() => {
    const controller = new AbortController(); setMetadata(undefined); setMetadataError(''); setMetadataBusy(false);
    if (!account || !form.categoryId.trim()) return () => controller.abort();
    setMetadataBusy(true);
    const timer = window.setTimeout(() => { getFashionMetadata(account.id, account.marketplaceId, form.categoryId.trim(), controller.signal, activeOrganizationId).then(setMetadata).catch((err) => { if (!controller.signal.aborted) setMetadataError(fashionError(err)); }).finally(() => { if (!controller.signal.aborted) setMetadataBusy(false); }); }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [account, form.categoryId, activeOrganizationId]);
  useEffect(() => { categoryRequest.current += 1; setCategories([]); setCategoryMessage(''); setCategoryBusy(false); }, [accountKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setMessage('');
    if (key === 'title') setTitleConfirmed(true);
    if (key === 'description') setDescriptionConfirmed(true);
    if (key === 'brand') confirmKey('brand');
  }
  function confirmKey(key: string) {
    setConfirmedKeys((previous) => previous.includes(key) ? previous : [...previous, key]);
    setSuggestedKeys((previous) => previous.filter((item) => item !== key));
  }
  function setAttribute(key: string, value: string, multiple = false) {
    confirmKey(key);
    change('verticalAttributes', { ...form.verticalAttributes, [key]: multiple ? value.split('|').map((item) => item.trim()).filter(Boolean) : value });
  }
  function changeFamily(next: FashionFamily) {
    const allowed = new Set(fashionFieldsForFamily(next).map((field) => field.key));
    const kept: FashionAttributes = { categoryFamily: next };
    for (const [key, value] of Object.entries(form.verticalAttributes)) {
      if (isFashionMetaKey(key) || allowed.has(key) || key === 'brand') kept[key] = value;
    }
    setForm((previous) => ({ ...previous, verticalAttributes: kept }));
    confirmKey('categoryFamily');
    setMessage('Category changed. Photos were kept. Review the remaining Fashion fields; values that do not apply to this category were not kept as valid attributes.');
  }
  async function searchCategories() {
    if (!account || !categoryQuery.trim()) return;
    const request = ++categoryRequest.current; setCategoryBusy(true); setCategoryMessage('');
    try {
      const items = await searchFashionCategories(account.id, account.marketplaceId, categoryQuery.trim(), undefined, activeOrganizationId);
      if (request === categoryRequest.current) { setCategories(items); if (!items.length) setCategoryMessage('No matching Fashion categories. Try a more specific garment name.'); }
    } catch (err) { if (request === categoryRequest.current) setCategoryMessage(fashionError(err)); }
    finally { if (request === categoryRequest.current) setCategoryBusy(false); }
  }
  async function analyzePhotos() {
    if (!canEdit || analyzing || analyzeLock.current) return;
    if (!form.images.length) { setError('Add photos of this garment before identification, or continue manually.'); return; }
    analyzeLock.current = true;
    setAnalyzing(true); setError(''); setMessage('');
    try {
      const result = await analyzeFashionImages({
        imageUrls: form.images,
        currentAttributes: form.verticalAttributes,
        confirmedKeys,
        sku: form.sku,
        currentTitle: form.title,
        currentDescription: form.description,
        currentBrand: form.brand,
        titleConfirmed,
        descriptionConfirmed,
        marketplaceId: account?.marketplaceId,
      }, activeOrganizationId);
      setForm((previous) => ({
        ...previous,
        sku: previous.sku.trim() || result.suggestedSku,
        title: titleConfirmed && previous.title.trim() ? previous.title : result.title,
        description: descriptionConfirmed && previous.description.trim() ? previous.description : result.description,
        brand: previous.brand.trim() || result.brand || '',
        conditionId: previous.conditionId || conditionFromLabel(result.conditionLabel),
        categoryId: previous.categoryId || result.category.categoryId || '',
        categoryName: previous.categoryName || result.category.categoryName || '',
        verticalAttributes: { ...result.attributes, brand: previous.brand.trim() || result.brand || '' },
        images: previous.images,
      }));
      if (result.category.query) setCategoryQuery(result.category.query);
      setSuggestedKeys(result.suggestedKeys);
      setConflicts(result.conflicts);
      setWarnings(result.warnings);
      setReviewPhotoSet(result.reviewPhotoSet);
      setMessage(result.status === 'failed' ? 'Identification did not complete. Photos and entered values are still here. Continue manually or retry.' : 'Suggestions are ready for review. Nothing is saved until you confirm and save this item.');
    } catch (err) {
      setError(fashionError(err));
      setWarnings(['Identification did not complete. Photos and entered values are preserved.']);
    } finally {
      setAnalyzing(false);
      analyzeLock.current = false;
    }
  }
  async function generateContent() {
    if (!canEdit || generating) return;
    setGenerating(true); setError('');
    try {
      const result = await generateFashionListingContent({
        verticalAttributes: form.verticalAttributes,
        brand: form.brand,
        title: form.title,
        description: form.description,
        titleConfirmed,
        descriptionConfirmed,
      }, activeOrganizationId);
      setForm((previous) => ({ ...previous, title: result.title, description: result.description }));
      setMessage('Listing text was generated from confirmed Fashion details. Unknown information was left out.');
      if (result.errors.length) setError(result.errors.join(' '));
      if (result.warnings.length) setWarnings(result.warnings);
    } catch (err) { setError(fashionError(err)); }
    finally { setGenerating(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!canEdit || saving) return;
    setError(''); setMessage('');
    if (!form.sku.trim() || !form.title.trim()) { setError('SKU and title cannot be blank.'); return; }
    if (form.price !== '' && (!Number.isFinite(Number(form.price)) || Number(form.price) < 0)) { setError('Price must be a non-negative number.'); return; }
    if (!/^\d+$/.test(form.quantity) || !Number.isSafeInteger(Number(form.quantity))) { setError('Quantity must be a non-negative whole number.'); return; }
    if (form.images.some((url) => !isFashionImageUrl(url))) { setError('Every image must use a valid HTTP or HTTPS URL.'); return; }
    if (listing?.price != null && form.price === '') { setError('Enter a price; an existing price cannot be cleared by the draft API.'); return; }
    const filledKeys = Object.entries(form.verticalAttributes)
      .filter(([key, value]) => !isFashionMetaKey(key) && fashionAttributeText(value))
      .map(([key]) => key);
    if (form.brand.trim()) filledKeys.push('brand');
    const savedConfirmed = [...new Set([...confirmedKeys, ...filledKeys])];
    const payload: FashionDraft = {
      sku: form.sku.trim(),
      title: form.title.trim(),
      description: form.description,
      brand: form.brand.trim(),
      conditionId: form.conditionId.trim(),
      ...(form.price !== '' ? { price: Number(form.price) } : {}),
      quantity: Number(form.quantity),
      imageUrls: form.images,
      categoryId: form.categoryId.trim(),
      categoryName: form.categoryName.trim(),
      verticalAttributes: {
        ...form.verticalAttributes,
        brand: form.brand.trim(),
        categoryFamily: family,
        _confirmedKeys: savedConfirmed,
        _suggestedKeys: suggestedKeys.filter((key) => !savedConfirmed.includes(key)),
        _titleConfirmed: Boolean(form.title.trim()),
        _descriptionConfirmed: descriptionConfirmed || Boolean(form.description.trim()),
      },
    };
    setSaving(true);
    try {
      const result = await saveFashionListing(payload, listingId, activeOrganizationId);
      const next = toForm(result);
      setListing(result); setForm(next); setSaved(JSON.stringify(next));
      setMessage('Saved. This Fashion item can be reopened and edited. Authenticity review is required before publishing.');
      if (!listingId) navigate(`/fashion/listings/${result.id}`, { replace: true });
      setConfirmedKeys(savedConfirmed);
      setSuggestedKeys(suggestedKeys.filter((key) => !savedConfirmed.includes(key)));
      setTitleConfirmed(Boolean(form.title.trim()));
    } catch (err) { setError(fashionError(err)); }
    finally { setSaving(false); }
  }
  function leave(event: React.MouseEvent<HTMLAnchorElement>) { if (dirty && !window.confirm('Discard unsaved Fashion item changes?')) event.preventDefault(); }
  if (!canView || (!listingId && !canEdit)) return <p role="alert">You do not have permission to open this Fashion editor.</p>;
  if (loading) return <p role="status">Loading Fashion item…</p>;
  if (loadError) return <div role="alert" className={panel}><p>{loadError}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Retry loading</button><Link to="/fashion/catalog">Back to catalog</Link></div>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link to="/fashion/catalog" onClick={leave} className="text-sm text-pink-600">← Fashion catalog</Link>
        <h1 className="mt-2 text-3xl font-semibold">{listingId ? 'Fashion item' : 'Add Item'}</h1>
        <p className="mt-2 text-sm text-slate-500">{listing ? `Review: ${listing.verticalValidationStatus.replace(/_/g, ' ')}` : 'Photos-first Fashion draft'}{dirty ? ' · Unsaved changes' : ''}</p>
      </div>
      <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setPreview((value) => !value)}>{preview ? 'Close preview' : 'Preview listing'}</button>
    </div>
    {locked && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">This listing is quarantined or on manual hold. Editing and publishing are unavailable.</p>}
    {!canEdit && !locked && <p className="text-sm text-slate-500">Read-only access. Your role cannot save this item.</p>}
    <FashionPhotoSet images={form.images} editable={canEdit && !saving} organizationId={activeOrganizationId} onChange={(images) => change('images', images)} />
    {canEdit && <div className="flex flex-wrap gap-3">
      <button type="button" disabled={analyzing || saving || !form.images.length} onClick={() => void analyzePhotos()} className="rounded-lg bg-pink-600 px-5 py-2 font-semibold text-white disabled:opacity-40">{analyzing ? 'Analyzing photos…' : 'Identify from photos'}</button>
      <button type="button" disabled={analyzing || saving} onClick={() => setMessage('Continue manually. Choose a Fashion category and complete the fields that apply.')} className="rounded-lg border px-5 py-2 text-sm">Continue without identification</button>
    </div>}
    {reviewPhotoSet && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">These photos may show more than one garment. Review the photo set. They will stay on this one item and will not be split automatically.</p>}
    {warnings.map((warning) => <p key={warning} className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>)}
    {conflicts.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30"><p className="font-semibold">Review conflicting suggestions</p><ul className="mt-2 list-disc pl-5">{conflicts.map((item) => <li key={item.key}>{item.key}: kept “{item.current}”; analysis suggested “{item.suggested}”.</li>)}</ul></div>}
    <section className={panel}><h2 className="text-lg font-semibold">Seller and marketplace</h2><label className="block text-sm">Fashion eBay seller<select className={input} value={accountKey} onChange={(e) => setAccountKey(e.target.value)}><option value="">Choose a seller to load category requirements</option>{accounts.map((item) => <option key={`${item.id}:${item.marketplaceId}`} value={`${item.id}:${item.marketplaceId}`}>{item.storeName || item.accountName} · {item.marketplaceId} · {item.status}</option>)}</select></label><p className="text-xs text-slate-500">Seller selection controls Fashion category metadata and publishing. Prices use the selected marketplace currency.</p>{accountError && <p role="alert" className="text-sm text-red-600">{accountError}</p>}{!accountError && !accounts.length && <p className="text-sm text-slate-500">No Fashion seller accounts available. You can still save a draft.</p>}</section>
    <form onSubmit={save} className="space-y-5">
      <fieldset disabled={!canEdit || saving} className="space-y-5">
        <section className={panel}><h2 className="text-lg font-semibold">Item details</h2><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">SKU *<input className={input} required maxLength={160} readOnly={!!listingId} value={form.sku} onChange={(e) => change('sku', e.target.value)} />{listingId && <span className="text-xs text-slate-500">SKU is immutable after creation.</span>}</label><label className="text-sm">Brand<input className={input} value={form.brand} onChange={(e) => change('brand', e.target.value)} />{suggestedKeys.includes('brand') && <span className="text-xs text-pink-700">Suggested from photos</span>}</label><label className="text-sm sm:col-span-2">Title *<input className={input} required maxLength={200} value={form.title} onChange={(e) => change('title', e.target.value)} /><span className="text-xs text-slate-500">{form.title.length}/200 draft characters. eBay titles allow 80; validation checks publishing readiness.</span></label><label className="text-sm">Price<input className={input} type="number" min="0" step="any" value={form.price} onChange={(e) => change('price', e.target.value)} placeholder="Not set" /></label><label className="text-sm">Quantity *<input className={input} type="number" min="0" step="1" required value={form.quantity} onChange={(e) => change('quantity', e.target.value)} /></label><label className="text-sm sm:col-span-2">Description<textarea className={input} rows={7} value={form.description} onChange={(e) => change('description', e.target.value)} /><span className="text-xs text-slate-500">Use confirmed Fashion details. Reported defects should remain visible. Preview sanitizes HTML.</span></label></div><button type="button" disabled={generating} onClick={() => void generateContent()} className="rounded-lg border px-4 py-2 text-sm">{generating ? 'Generating…' : 'Generate listing text from confirmed details'}</button></section>
        <section className={panel}><h2 className="text-lg font-semibold">Fashion category and condition</h2>
          <label className="block text-sm">Fashion category family<select className={input} value={family} onChange={(e) => changeFamily(e.target.value as FashionFamily)}>{FASHION_FAMILIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Find an eBay Fashion category<input className={input} value={categoryQuery} onChange={(e) => setCategoryQuery(e.target.value)} placeholder="For example, women's linen shirt" /></label><button type="button" disabled={!account || !categoryQuery.trim() || categoryBusy} onClick={searchCategories} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{categoryBusy ? 'Searching…' : 'Search categories'}</button></div>
          {categoryMessage && <p role="status" className="text-sm">{categoryMessage}</p>}
          {categories.length > 0 && <div className="max-h-60 space-y-1 overflow-y-auto">{categories.map((item) => <button type="button" key={item.category.categoryId} className="block w-full rounded-lg bg-slate-50 p-3 text-left text-sm hover:bg-pink-50 dark:bg-slate-800" onClick={() => { setForm((previous) => ({ ...previous, categoryId: item.category.categoryId, categoryName: item.category.categoryName })); setCategories([]); }}>{item.category.categoryName} · {item.category.categoryId}</button>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">eBay leaf category ID<input className={input} value={form.categoryId} onChange={(e) => { setForm((previous) => ({ ...previous, categoryId: e.target.value, categoryName: '' })); }} /></label><label className="text-sm">Category name<input className={input} value={form.categoryName} onChange={(e) => change('categoryName', e.target.value)} /></label><label className="text-sm sm:col-span-2">Condition ID or enum<input className={input} list="fashion-conditions" value={form.conditionId} onChange={(e) => change('conditionId', e.target.value)} placeholder="Select a category to see supported conditions" /><datalist id="fashion-conditions">{metadata?.supportedConditions.map((condition) => <option key={condition} value={condition} />)}</datalist></label></div>
          {metadataBusy && <p role="status" className="text-sm">Loading Fashion category requirements…</p>}
          {metadataError && <p role="alert" className="text-sm text-red-600">Category requirements unavailable: {metadataError}</p>}
          {metadata && <p className="text-xs text-slate-500">Supported conditions: {metadata.supportedConditions.join(', ') || 'Not returned; validate before publishing'}. Variation support: {metadata.supportsVariations == null ? 'unknown' : metadata.supportsVariations ? 'yes' : 'no'}. This editor creates one SKU.</p>}
        </section>
        <section className={panel}><h2 className="text-lg font-semibold">Fashion attributes</h2><p className="text-xs text-slate-500">Only fields that apply to {FASHION_FAMILIES.find((item) => item.id === family)?.label.toLowerCase()} are shown. Suggestions are editable. Confirmed values are kept if you re-run identification.</p>
          {FASHION_FIELD_GROUPS.map((group) => {
            const fields = group.fields.filter((field) => field.families.includes(family));
            if (!fields.length) return null;
            return <div key={group.id} className="space-y-3"><h3 className="font-semibold">{group.label}</h3><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <label className={`text-sm ${field.input === 'textarea' ? 'sm:col-span-2' : ''}`} key={field.key}>{field.label}{suggestedKeys.includes(field.key) ? <span className="ml-2 text-xs font-normal text-pink-700">Suggested</span> : null}{field.input === 'textarea' ? <textarea className={input} rows={3} value={fashionAttributeText(form.verticalAttributes[field.key])} onChange={(e) => setAttribute(field.key, e.target.value)} /> : <input className={input} value={fashionAttributeText(form.verticalAttributes[field.key])} onChange={(e) => setAttribute(field.key, e.target.value)} />}{field.help ? <span className="text-xs text-slate-500">{field.help}</span> : null}</label>)}</div></div>;
          })}
          {!!metadata?.aspects.length && <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">eBay item specifics</h3><p className="text-xs text-slate-500">Required specifics are marked *. For multiple values, separate entries with |.</p><div className="grid gap-4 sm:grid-cols-2">{metadata.aspects.map((aspect, index) => {
            const normalized = fashionAttributeKey(aspect.localizedAspectName);
            const key = Object.keys(form.verticalAttributes).find((candidate) => candidate.toLowerCase() === normalized.toLowerCase()) ?? visibleFields.find((attribute) => attribute.key.toLowerCase() === normalized.toLowerCase())?.key ?? normalized;
            const isBrand = key.toLowerCase() === 'brand';
            const value = isBrand ? form.brand : fashionAttributeText(form.verticalAttributes[key]);
            return <label className="text-sm" key={aspect.localizedAspectName}>{aspect.localizedAspectName}{aspect.aspectConstraint?.aspectRequired ? ' *' : ''}{suggestedKeys.includes(key) ? <span className="ml-2 text-xs text-pink-700">Suggested</span> : null}<input className={input} list={`fashion-aspect-${index}`} value={value} onChange={(e) => isBrand ? change('brand', e.target.value) : setAttribute(key, e.target.value, aspect.aspectConstraint?.itemToAspectCardinality === 'MULTI')} /><datalist id={`fashion-aspect-${index}`}>{aspect.aspectValues?.map((option) => <option key={option.localizedValue} value={option.localizedValue} />)}</datalist></label>;
          })}</div></div>}
        </section>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <div className="flex flex-wrap items-center gap-4">{canEdit && <button type="submit" disabled={saving || analyzing || (!!listingId && !dirty)} className="rounded-lg bg-pink-600 px-5 py-2 font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : listingId ? 'Save changes' : 'Save item'}</button>}<Link to="/fashion/catalog" onClick={leave} className="text-sm">Back to catalog</Link>{permissions.includes('fashion.review') && listing && <Link to="/fashion/review" onClick={leave} className="text-sm text-pink-600">Open authenticity review</Link>}<span className="text-xs text-slate-500">Saving changes resets approval and requires review. Identification is optional.</span></div>
    </form>
    {preview && <section className={panel} aria-label="Listing preview"><h2 className="text-lg font-semibold">Listing preview</h2><p className="text-xs text-slate-500">Preview of current form values. Actual eBay appearance may vary.</p><div className="grid gap-5 md:grid-cols-2">{form.images[0] && isFashionImageUrl(form.images[0]) && <img src={toProxyUrl(form.images[0])} alt={form.title || 'Fashion listing preview'} className="max-h-96 w-full rounded-lg object-contain" />}<div><h3 className="text-2xl font-semibold">{form.title || 'Untitled Fashion item'}</h3><p className="mt-3 text-xl">{form.price || 'Price not set'} <span className="text-sm text-slate-500">{account?.marketplaceId}</span></p><p className="mt-2 text-sm">{form.brand} · Quantity {form.quantity} · {form.conditionId || 'Condition not set'}</p><p className="mt-2 text-sm text-slate-500">{form.categoryName || form.categoryId || 'Category not set'}</p><dl className="mt-4 grid grid-cols-2 gap-2 text-sm">{Object.entries(form.verticalAttributes).filter(([key, value]) => !isFashionMetaKey(key) && fashionAttributeText(value)).map(([key, value]) => <div key={key}><dt className="text-slate-500">{key}</dt><dd>{fashionAttributeText(value)}</dd></div>)}</dl></div></div><div className="break-words whitespace-pre-wrap text-sm [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.description) }} /></section>}
    {listing && <FashionListingPublishPanel listings={[listing]} account={account} dirty={dirty || saving} />}
  </div>;
}
