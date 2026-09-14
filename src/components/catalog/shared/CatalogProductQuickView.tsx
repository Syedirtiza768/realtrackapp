import { ExternalLink, ImagePlus, Save, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ImageUploadZone from '../../listings/ImageUploadZone';
import FashionPhotoSet from '../../fashion/FashionPhotoSet';
import ImageZoom from '../../ui/ImageZoom';
import OptimizedImage from '../../ui/OptimizedImage';
import CatalogImageGallery from './CatalogImageGallery';
import { getCatalogProduct, patchCatalogProduct } from './catalogApi';
import type { CatalogConfig, CatalogItem } from './catalogTypes';

type Props = {
  config: CatalogConfig;
  item: CatalogItem | null;
  organizationId: string | null;
  canPublish?: boolean;
  onClose: () => void;
  onSaved: (item: CatalogItem) => void;
  onPublish?: (item: CatalogItem) => void;
};

type Draft = {
  title: string;
  description: string;
  brand: string;
  mpn: string;
  price: string;
  quantity: string;
  categoryName: string;
  imageUrls: string[];
  verticalAttributes: Record<string, unknown>;
};

function makeDraft(item: CatalogItem): Draft {
  return {
    title: item.title || '',
    description: item.description || '',
    brand: item.brand || '',
    mpn: item.mpn || '',
    price: item.price == null ? '' : String(item.price),
    quantity: item.quantity == null ? '' : String(item.quantity),
    categoryName: item.categoryName || item.categoryId || '',
    imageUrls: [...new Set(item.imageUrls.filter(Boolean))].slice(0, 24),
    verticalAttributes: { ...item.verticalAttributes },
  };
}

function attributeText(value: unknown) {
  return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
}

function statusClass(status: string) {
  if (status === 'published' || status === 'active') return 'text-emerald-700 dark:text-emerald-300';
  if (status === 'failed' || status === 'blocked') return 'text-red-700 dark:text-red-300';
  return 'text-slate-600 dark:text-slate-300';
}

export default function CatalogProductQuickView({ config, item, organizationId, canPublish = false, onClose, onSaved, onPublish }: Props) {
  const [detail, setDetail] = useState<CatalogItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(item ? makeDraft(item) : null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);
  const effectiveItem = detail || item;
  const images = useMemo(() => draft ? [...new Set(draft.imageUrls.filter(Boolean))].slice(0, 24) : [], [draft]);
  const readOnly = Boolean(effectiveItem?.manualReview || (effectiveItem && config.protectedStatuses.includes(effectiveItem.verticalValidationStatus)));

  useEffect(() => {
    setDetail(null);
    setDraft(item ? makeDraft(item) : null);
    setMessage('');
    setZoomIndex(null);
    setActiveImageIndex(0);
    setUploadZoneKey(0);
    if (!item) return undefined;
    let cancelled = false;
    void getCatalogProduct(config, item.id, organizationId).then((result) => {
      if (!cancelled) {
        setDetail(result);
        setDraft(makeDraft(result));
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [config, item, organizationId]);

  useEffect(() => {
    if (activeImageIndex >= images.length) setActiveImageIndex(Math.max(0, images.length - 1));
  }, [activeImageIndex, images.length]);

  if (!effectiveItem || !draft) return null;
  const update = (patch: Partial<Draft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const updateAttribute = (key: string, value: string) => update({ verticalAttributes: { ...draft.verticalAttributes, [key]: value } });
  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const saved = await patchCatalogProduct(config, effectiveItem.id, {
        title: draft.title.trim(),
        description: draft.description,
        brand: draft.brand.trim(),
        mpn: draft.mpn.trim(),
        price: draft.price === '' ? undefined : Number(draft.price),
        quantity: draft.quantity === '' ? undefined : Number(draft.quantity),
        categoryName: draft.categoryName.trim(),
        imageUrls: images,
        verticalAttributes: draft.verticalAttributes,
      }, organizationId);
      setDetail(saved);
      setDraft(makeDraft(saved));
      onSaved(saved);
      setMessage('Saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/50" role="dialog" aria-modal="true" aria-label="Catalog product quick view">
      <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900">
        <div className="mb-0 flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-800 sm:px-6"><div className="min-w-0"><p className="text-xs uppercase tracking-wide text-slate-500">{config.label} quick view</p><h2 className="mt-1 break-words text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">{effectiveItem.title || 'Untitled product'}</h2><p className="mt-1 text-xs text-slate-500">{effectiveItem.sku || 'No SKU'} · {effectiveItem.publicationStatus}{detail ? '' : ' · loading latest details…'}</p></div><button type="button" onClick={onClose} aria-label="Close quick view" className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {message ? <div className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200" role="status">{message}</div> : null}
        {readOnly ? <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">This product is on a review or quarantine hold. Editing and publishing are disabled until the vertical workflow releases it.</div> : null}
        <section className="mb-6" aria-label="Product images"><div className="mb-2 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Images ({images.length}/24)</h3><p className="text-xs text-slate-500">All stored images are available here. Select a thumbnail or open the viewer for full-screen navigation.</p></div><ImagePlus size={17} className="text-slate-400" /></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"><div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-slate-900 sm:min-h-[260px] lg:min-h-[330px]">{images.length ? <button type="button" className="h-full w-full" onClick={() => setZoomIndex(activeImageIndex)} aria-label={`Open image ${activeImageIndex + 1} of ${images.length}`}><OptimizedImage src={images[activeImageIndex]} alt={`${effectiveItem.title || 'Product'} image ${activeImageIndex + 1}`} variant="medium" className="h-full w-full [&>img]:h-full [&>img]:w-full [&>img]:object-contain" /></button> : <p className="text-sm text-slate-500">No images uploaded.</p>}</div>{images.length > 1 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="All product images">{images.map((url, index) => <button type="button" key={`${url}-${index}`} onClick={() => setActiveImageIndex(index)} className={'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white dark:bg-slate-900 ' + (index === activeImageIndex ? 'border-cyan-500' : 'border-transparent')} aria-label={`Select image ${index + 1} of ${images.length}`}><OptimizedImage src={url} alt={`${effectiveItem.title || 'Product'} thumbnail ${index + 1}`} variant="thumb" className="h-full w-full [&>img]:h-full [&>img]:w-full [&>img]:object-cover" /></button>)}</div> : null}</div></section>
        <section className="space-y-3" aria-label="Product fields"><label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Title<input disabled={readOnly} value={draft.title} onChange={(event) => update({ title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Brand<input disabled={readOnly} value={draft.brand} onChange={(event) => update({ brand: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label>{config.vertical === 'fashion' ? <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Department<input disabled={readOnly} value={attributeText(draft.verticalAttributes.department)} onChange={(event) => updateAttribute('department', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label> : <label className="text-sm font-medium text-slate-700 dark:text-slate-200">MPN<input disabled={readOnly} value={draft.mpn} onChange={(event) => update({ mpn: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label>}</div><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Price<input disabled={readOnly} type="number" min="0" step="0.01" value={draft.price} onChange={(event) => update({ price: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Quantity<input disabled={readOnly} type="number" min="0" value={draft.quantity} onChange={(event) => update({ quantity: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category<input disabled={readOnly} value={draft.categoryName} onChange={(event) => update({ categoryName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-800 dark:bg-slate-800" /></label></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><p className="text-xs font-medium text-slate-500">Condition</p><p className="mt-1 text-slate-800 dark:text-slate-100">{(effectiveItem.conditionLabel || effectiveItem.conditionId || '—').replace(/_/g, ' ')}</p></div><div className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><p className="text-xs font-medium text-slate-500">Images</p><p className="mt-1 text-slate-800 dark:text-slate-100">{images.length} available</p></div></div><label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Description<textarea disabled={readOnly} rows={5} value={draft.description} onChange={(event) => update({ description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label></section>
        <section className="mt-6" aria-label="Vertical attributes"><h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{config.label} attributes</h3><div className="grid gap-3 sm:grid-cols-2">{config.attributes.map((attribute) => <label key={attribute.key} className="text-xs font-medium text-slate-600 dark:text-slate-300">{attribute.label}<input disabled={readOnly} value={attributeText(draft.verticalAttributes[attribute.key])} onChange={(event) => updateAttribute(attribute.key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label>)}</div></section>
        <section className="mt-6" aria-label="Image management"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Manage image order</h3><span className="text-xs text-slate-500">First image is primary</span></div><CatalogImageGallery images={images} editable={!readOnly} onChange={(next) => { update({ imageUrls: next }); setActiveImageIndex(0); }} onZoom={(url) => setZoomIndex(Math.max(0, images.indexOf(url)))} />{!readOnly ? <div className="mt-3">{images.length < 24 ? (config.vertical === 'fashion' ? <FashionPhotoSet compact images={images} editable={!readOnly} organizationId={organizationId} onChange={(next) => { update({ imageUrls: next }); setActiveImageIndex(0); }} /> : <ImageUploadZone key={uploadZoneKey} maxImages={24 - images.length} onImagesChange={(uploaded) => { const next = [...new Set([...images, ...uploaded.map((image) => image.cdnUrl)])].slice(0, 24); update({ imageUrls: next }); setUploadZoneKey((key) => key + 1); }} />) : <p className="text-xs text-slate-500">Maximum of 24 images reached.</p>}<p className="mt-2 text-xs text-slate-500">{config.vertical === 'fashion' ? 'Fashion photos upload through the Fashion workspace and are added when you save.' : 'Uploaded assets are added when you save. Existing storage permissions still apply.'}</p></div> : null}</section>
        {effectiveItem.publications.length ? <section className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Marketplace publications"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Marketplace publications</h3><div className="mt-2 space-y-2">{effectiveItem.publications.map((publication) => <div key={publication.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-slate-700 dark:text-slate-200">{publication.storeName} · {publication.marketplaceId}</span><span className={statusClass(publication.listingStatus)}>{publication.listingStatus}</span></div>)}</div></section> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <a href={config.editorUrl(effectiveItem.id)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><ExternalLink size={15} /> Full editor</a>
            {canPublish && !readOnly && effectiveItem.publicationStatus !== 'blocked' && effectiveItem.verticalValidationStatus === 'approved' && onPublish ? <button type="button" onClick={() => onPublish(effectiveItem)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Send size={15} /> Validate &amp; publish</button> : null}
          </div>
          <button type="button" disabled={readOnly || saving} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</button>
        </div>
        </div>
      </div>
      {zoomIndex != null && images.length ? <ImageZoom images={images} index={zoomIndex} onClose={() => setZoomIndex(null)} /> : null}
    </div>
  );
}
