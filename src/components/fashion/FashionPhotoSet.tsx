import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Loader2, Type, X } from 'lucide-react';
import { addFashionImageBanner, fashionError, uploadFashionPhotos } from '../../lib/fashionListingsApi';
import { FASHION_PHOTO_SLOTS, countFashionPhotos, type FashionPhotoRole, type FashionPhotoSlots } from '../../lib/fashionPhotoSlots';
import { toProxyUrl } from '../../lib/imageUrl';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS = 24;
const BANNER_TEXT_KEY = 'fashion.bannerText';

type Props = {
  slots: FashionPhotoSlots;
  editable: boolean;
  organizationId?: string | null;
  onChange: (slots: FashionPhotoSlots) => void;
  /** Uploaded files are named after this SKU when present. */
  sku?: string;
  compact?: boolean;
};

type BannerDraft = { role: FashionPhotoRole; index: number; text: string; position: 'top' | 'bottom'; theme: 'dark' | 'brand' | 'light' };

function readBannerText() {
  try { return localStorage.getItem(BANNER_TEXT_KEY) ?? ''; } catch { return ''; }
}

/**
 * Photo slots for one garment: Front and Back (required), Tag & labels (1–2),
 * Additional (up to 13) and Size chart. Each slot supports camera capture and upload.
 */
export default function FashionPhotoSet({ slots, editable, organizationId, onChange, sku, compact = false }: Props) {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyRole, setBusyRole] = useState<FashionPhotoRole | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [banner, setBanner] = useState<BannerDraft | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const total = countFashionPhotos(slots);
  const busy = busyRole !== null || bannerBusy;

  async function addFiles(role: FashionPhotoRole, list: FileList | null) {
    if (!editable || !list?.length || busy) return;
    const slot = FASHION_PHOTO_SLOTS.find((item) => item.role === role)!;
    const room = Math.min(slot.max - slots[role].length, MAX_PHOTOS - total);
    if (room <= 0) { setErrors([`${slot.label} is full (${slot.max} max, ${MAX_PHOTOS} photos per item).`]); return; }
    const accepted: File[] = [];
    const nextErrors: string[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      if (!ACCEPTED.includes(file.type)) nextErrors.push(`${file.name}: use JPEG, PNG, or WebP.`);
      else if (file.size > MAX_FILE_BYTES) nextErrors.push(`${file.name}: each photo must be 20 MB or smaller.`);
      else accepted.push(file);
    }
    if (list.length > room) nextErrors.push(`Only ${room} more photo${room === 1 ? '' : 's'} fit in ${slot.label}.`);
    if (!accepted.length) { setErrors(nextErrors.length ? nextErrors : ['No supported photos were selected.']); return; }
    setBusyRole(role); setErrors([]);
    try {
      const result = await uploadFashionPhotos(accepted, organizationId, sku);
      const urls = result.uploaded.map((item) => item.url).filter(Boolean);
      onChange({ ...slots, [role]: [...slots[role], ...urls].slice(0, slot.max) });
      setErrors([...nextErrors, ...result.errors]);
    } catch (error) {
      setErrors([fashionError(error)]);
    } finally {
      setBusyRole(null);
    }
  }

  function remove(role: FashionPhotoRole, index: number) {
    onChange({ ...slots, [role]: slots[role].filter((_, position) => position !== index) });
  }
  function move(role: FashionPhotoRole, index: number, delta: number) {
    const next = [...slots[role]];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...slots, [role]: next });
  }
  async function applyBanner() {
    if (!banner || !banner.text.trim()) return;
    setBannerBusy(true); setErrors([]);
    try {
      const url = slots[banner.role][banner.index];
      const result = await addFashionImageBanner({ imageUrl: url, text: banner.text.trim(), position: banner.position, theme: banner.theme }, organizationId);
      const next = [...slots[banner.role]];
      next[banner.index] = result.url;
      onChange({ ...slots, [banner.role]: next });
      try { localStorage.setItem(BANNER_TEXT_KEY, banner.text.trim()); } catch { /* per-viewer convenience only */ }
      setBanner(null);
    } catch (error) {
      setErrors([fashionError(error)]);
    } finally {
      setBannerBusy(false);
    }
  }

  return (
    <section className={compact ? 'space-y-4' : 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900'}>
      {!compact && <div>
        <h2 className="text-lg font-semibold">Photos of this garment</h2>
        <p className="mt-1 text-sm text-slate-500">Front, back and at least one label photo are required. Photos stay in slot order on the listing; the front photo is the main image. {total}/{MAX_PHOTOS} photos.</p>
      </div>}
      {FASHION_PHOTO_SLOTS.map((slot) => {
        const urls = slots[slot.role];
        const full = urls.length >= slot.max || total >= MAX_PHOTOS;
        const missing = urls.length < slot.min;
        return (
          <div key={slot.role} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {slot.label}{slot.min > 0 ? <span className="text-pink-600"> *</span> : null}
                <span className="ml-2 font-normal text-slate-500">{urls.length}/{slot.max}</span>
              </h3>
              <p className="text-xs text-slate-500">{slot.hint}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {urls.map((url, index) => (
                <figure key={url} className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-28 sm:w-28 dark:border-slate-700 dark:bg-slate-800">
                  <img src={toProxyUrl(url)} alt={`${slot.label} photo ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                  {editable && <>
                    <button type="button" aria-label={`Remove ${slot.label.toLowerCase()} photo ${index + 1}`} disabled={busy} onClick={() => remove(slot.role, index)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow disabled:opacity-40"><X size={14} /></button>
                    {slot.role !== 'sizeChart' && <button type="button" aria-label={`Add banner to ${slot.label.toLowerCase()} photo ${index + 1}`} disabled={busy} onClick={() => setBanner({ role: slot.role, index, text: readBannerText(), position: 'bottom', theme: 'dark' })} className="absolute bottom-1 left-1 rounded-full bg-white/90 p-1 text-slate-700 shadow disabled:opacity-40"><Type size={14} /></button>}
                    {urls.length > 1 && <div className="absolute bottom-1 right-1 flex gap-1">
                      <button type="button" aria-label="Move earlier" disabled={busy || index === 0} onClick={() => move(slot.role, index, -1)} className="rounded-full bg-white/90 p-1 text-slate-700 shadow disabled:opacity-30"><ArrowLeft size={12} /></button>
                      <button type="button" aria-label="Move later" disabled={busy || index === urls.length - 1} onClick={() => move(slot.role, index, 1)} className="rounded-full bg-white/90 p-1 text-slate-700 shadow disabled:opacity-30"><ArrowRight size={12} /></button>
                    </div>}
                  </>}
                </figure>
              ))}
              {editable && !full && (
                <div className={`flex h-24 w-24 flex-col items-stretch justify-center gap-1 rounded-lg border-2 border-dashed p-1 sm:h-28 sm:w-28 ${missing ? 'border-pink-300 dark:border-pink-800' : 'border-slate-300 dark:border-slate-600'}`}>
                  {busyRole === slot.role ? <span className="flex justify-center text-slate-500" role="status" aria-label={`Uploading ${slot.label}`}><Loader2 className="animate-spin" size={20} /></span> : <>
                    {slot.camera && <button type="button" disabled={busy} onClick={() => inputs.current[`${slot.role}-camera`]?.click()} className="flex min-h-9 items-center justify-center gap-1 rounded-md bg-pink-50 text-xs font-semibold text-pink-700 disabled:opacity-40 dark:bg-pink-950/40 dark:text-pink-300"><Camera size={14} /> Camera</button>}
                    <button type="button" disabled={busy} onClick={() => inputs.current[`${slot.role}-file`]?.click()} className="flex min-h-9 items-center justify-center gap-1 rounded-md bg-slate-100 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"><ImagePlus size={14} /> Upload</button>
                  </>}
                  <input ref={(node) => { inputs.current[`${slot.role}-camera`] = node; }} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void addFiles(slot.role, event.target.files); event.target.value = ''; }} />
                  <input ref={(node) => { inputs.current[`${slot.role}-file`] = node; }} type="file" accept="image/jpeg,image/png,image/webp" multiple={slot.max > 1} className="hidden" onChange={(event) => { void addFiles(slot.role, event.target.files); event.target.value = ''; }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
      {banner && (
        <div role="dialog" aria-label="Add banner to photo" className="space-y-3 rounded-lg border border-pink-200 bg-pink-50/60 p-3 dark:border-pink-900 dark:bg-pink-950/20">
          <p className="text-sm font-semibold">Add a text banner</p>
          <p className="text-xs text-slate-500">Creates a new copy of the photo with a banner. The original upload is kept in storage.</p>
          <label className="block text-sm">Banner text<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" maxLength={60} value={banner.text} onChange={(event) => setBanner({ ...banner, text: event.target.value })} placeholder="For example, Free shipping · Fast dispatch" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Position<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" value={banner.position} onChange={(event) => setBanner({ ...banner, position: event.target.value as BannerDraft['position'] })}><option value="bottom">Bottom</option><option value="top">Top</option></select></label>
            <label className="text-sm">Style<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" value={banner.theme} onChange={(event) => setBanner({ ...banner, theme: event.target.value as BannerDraft['theme'] })}><option value="dark">Dark</option><option value="brand">Pink</option><option value="light">Light</option></select></label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={bannerBusy || !banner.text.trim()} onClick={() => void applyBanner()} className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{bannerBusy ? 'Adding banner…' : 'Apply banner'}</button>
            <button type="button" disabled={bannerBusy} onClick={() => setBanner(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      {errors.map((error) => <p key={error} role="alert" className="text-sm text-red-600">{error}</p>)}
    </section>
  );
}
