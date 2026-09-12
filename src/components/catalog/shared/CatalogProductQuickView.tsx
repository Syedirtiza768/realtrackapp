import { ArrowDown, ArrowUp, Copy, ExternalLink, ImagePlus, Save, Trash2, X, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import ImageUploadZone from '../../listings/ImageUploadZone';
import OptimizedImage from '../../ui/OptimizedImage';
import { patchCatalogProduct } from './catalogApi';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogItem } from './catalogTypes';

type Props = {
  config: CatalogConfig;
  item: CatalogItem | null;
  onClose: () => void;
  onSaved: (item: CatalogItem) => void;
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
    imageUrls: [...item.imageUrls],
    verticalAttributes: { ...item.verticalAttributes },
  };
}

function attributeText(value: unknown) {
  return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
}

export default function CatalogProductQuickView({ config, item, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft | null>(item ? makeDraft(item) : null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const readOnly = Boolean(item?.manualReview || (item && config.protectedStatuses.includes(item.verticalValidationStatus)));

  useEffect(() => {
    setDraft(item ? makeDraft(item) : null);
    setMessage('');
  }, [item]);

  if (!item || !draft) return null;
  const update = (patch: Partial<Draft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const updateAttribute = (key: string, value: string) => update({ verticalAttributes: { ...draft.verticalAttributes, [key]: value } });
  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const saved = await patchCatalogProduct(config, item.id, {
        title: draft.title.trim(),
        description: draft.description,
        brand: draft.brand.trim(),
        mpn: draft.mpn.trim(),
        price: draft.price === '' ? undefined : Number(draft.price),
        quantity: draft.quantity === '' ? undefined : Number(draft.quantity),
        categoryName: draft.categoryName.trim(),
        imageUrls: draft.imageUrls,
        verticalAttributes: draft.verticalAttributes,
      });
      onSaved(saved);
      setMessage('Saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  };
  const moveImage = (index: number, direction: -1 | 1) => {
    const next = [...draft.imageUrls];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ imageUrls: next });
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" role="dialog" aria-modal="true" aria-label="Catalog product quick view">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">{config.label} quick view</p><h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{item.title || 'Untitled product'}</h2><p className="mt-1 text-xs text-slate-500">{item.sku || 'No SKU'} · {item.publicationStatus}</p></div><button type="button" onClick={onClose} aria-label="Close quick view" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X /></button></div>
        {message ? <div className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200" role="status">{message}</div> : null}
        {readOnly ? <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">This product is on a review or quarantine hold. Editing and publishing are disabled until the vertical workflow releases it.</div> : null}
        <section className="space-y-3" aria-label="Product fields">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Title<input disabled={readOnly} value={draft.title} onChange={(event) => update({ title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Brand<input disabled={readOnly} value={draft.brand} onChange={(event) => update({ brand: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-200">MPN<input disabled={readOnly} value={draft.mpn} onChange={(event) => update({ mpn: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label></div>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Price<input disabled={readOnly} type="number" min="0" step="0.01" value={draft.price} onChange={(event) => update({ price: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Quantity<input disabled={readOnly} type="number" min="0" value={draft.quantity} onChange={(event) => update({ quantity: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category<input disabled={readOnly} value={draft.categoryName} onChange={(event) => update({ categoryName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label></div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Description<textarea disabled={readOnly} rows={5} value={draft.description} onChange={(event) => update({ description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-800" /></label>
        </section>
        <section className="mt-6" aria-label="Vertical attributes"><h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Vertical attributes</h3><div className="grid gap-3 sm:grid-cols-2">{config.quickAttributes.map((key) => <label key={key} className="text-xs font-medium text-slate-600 dark:text-slate-300">{config.attributes.find((attribute) => attribute.key === key)?.label || key}<input disabled={readOnly} value={attributeText(draft.verticalAttributes[key])} onChange={(event) => updateAttribute(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label>)}</div></section>
        <section className="mt-6" aria-label="Image management"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Images ({draft.imageUrls.length}/24)</h3><ImagePlus size={17} className="text-slate-400" /></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{draft.imageUrls.map((url, index) => <div key={url + index} className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><button type="button" onClick={() => setZoom(url)} className="block h-24 w-full" aria-label="Zoom image"><OptimizedImage src={url} alt="" variant="small" className="h-full w-full object-cover" /></button>{!readOnly ? <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100"><button type="button" onClick={() => moveImage(index, -1)} className="rounded bg-white/90 p-1" title="Move left"><ArrowUp size={13} /></button><button type="button" onClick={() => moveImage(index, 1)} className="rounded bg-white/90 p-1" title="Move right"><ArrowDown size={13} /></button><button type="button" onClick={() => update({ imageUrls: draft.imageUrls.filter((_, imageIndex) => imageIndex !== index) })} className="rounded bg-white/90 p-1 text-red-600" title="Remove image"><Trash2 size={13} /></button><button type="button" onClick={() => void navigator.clipboard?.writeText(url)} className="rounded bg-white/90 p-1" title="Copy image URL"><Copy size={13} /></button></div> : null}</div>)}</div>{!readOnly ? <div className="mt-3"><ImageUploadZone maxImages={Math.max(0, 24 - draft.imageUrls.length)} onImagesChange={(images) => update({ imageUrls: [...draft.imageUrls, ...images.map((image) => image.cdnUrl)] })} /><p className="mt-2 text-xs text-slate-500">Uploaded assets are added to this product when you save. The existing storage permission still applies.</p></div> : null}</section>
        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"><a href={config.editorUrl(item.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><ExternalLink size={15} /> Full editor</a><button type="button" disabled={readOnly || saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</button></div>
      </div>
      {zoom ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" onClick={() => setZoom(null)}><OptimizedImage src={zoom} alt="Catalog product" variant="large" className="max-h-full max-w-full object-contain" /><ZoomIn className="absolute right-5 top-5 text-white" /></div> : null}
    </div>
  );
}
