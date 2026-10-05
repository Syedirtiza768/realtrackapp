import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import CatalogImageGallery from '../catalog/shared/CatalogImageGallery';
import { uploadFashionPhotos } from '../../lib/fashionListingsApi';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS = 24;

type Props = {
  images: string[];
  editable: boolean;
  organizationId?: string | null;
  onChange: (images: string[]) => void;
  compact?: boolean;
};

export default function FashionPhotoSet({ images, editable, organizationId, onChange, compact = false }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  async function addFiles(list: FileList | File[] | null) {
    if (!editable || !list || busy) return;
    const incoming = Array.from(list);
    const remaining = MAX_PHOTOS - images.length;
    if (remaining <= 0) {
      setErrors([`This garment already has the maximum of ${MAX_PHOTOS} photos.`]);
      return;
    }
    const accepted: File[] = [];
    const nextErrors: string[] = [];
    for (const file of incoming.slice(0, remaining)) {
      if (!ACCEPTED.includes(file.type)) {
        nextErrors.push(`${file.name}: use JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        nextErrors.push(`${file.name}: each photo must be 20 MB or smaller.`);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) {
      setErrors(nextErrors.length ? nextErrors : ['No supported photos were selected.']);
      return;
    }
    setBusy(true);
    setProgress(`Uploading ${accepted.length} photo${accepted.length === 1 ? '' : 's'}…`);
    try {
      const result = await uploadFashionPhotos(accepted, organizationId);
      const urls = result.uploaded.map((item) => item.url).filter(Boolean);
      onChange([...images, ...urls].slice(0, MAX_PHOTOS));
      setErrors([...nextErrors, ...result.errors]);
      setProgress(urls.length ? `${urls.length} photo${urls.length === 1 ? '' : 's'} added to this garment.` : '');
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Photo upload failed. Try again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={compact ? 'space-y-3' : 'space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900'}>
      {!compact ? (
      <div>
        <h2 className="text-lg font-semibold">Photos of this garment</h2>
        <p className="mt-1 text-sm text-slate-500">Collect the complete photo set first — front, back, brand label, size label, care label, and defects. Analysis starts only when you continue. These photos stay one Fashion item.</p>
      </div>
      ) : null}
      {editable ? (
        <div className="flex flex-wrap gap-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = ''; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = ''; }} />
          <button type="button" disabled={busy || images.length >= MAX_PHOTOS} onClick={() => cameraRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-700 disabled:opacity-40 dark:border-pink-800 dark:text-pink-300">
            <Camera size={16} /> Take photo
          </button>
          <button type="button" disabled={busy || images.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40">
            <ImagePlus size={16} /> Upload photos
          </button>
        </div>
      ) : null}
      <div
        className="rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-600"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); if (editable) void addFiles(event.dataTransfer.files); }}
      >
        {busy ? <p className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> {progress}</p> : `Drop additional photos here. ${images.length}/${MAX_PHOTOS} in this set. The first photo is primary.`}
      </div>
      {compact ? null : images.length ? <CatalogImageGallery images={images} editable={editable && !busy} onChange={onChange} /> : <p className="text-sm text-slate-500">No photos yet. Camera capture and file upload add to the same garment.</p>}
      {errors.map((error) => <p key={error} role="alert" className="text-sm text-red-600">{error}</p>)}
      {progress && !busy ? <p role="status" className="text-sm text-emerald-700">{progress}</p> : null}
    </section>
  );
}
