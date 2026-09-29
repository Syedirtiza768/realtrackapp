import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { fashionError, uploadFashionPhotos } from '../../lib/fashionListingsApi';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS = 24;

type Props = {
  images: string[];
  editable: boolean;
  organizationId?: string | null;
  onChange: (images: string[]) => void;
};

/**
 * Appends Fashion photos to an image list (shared catalog quick view).
 * Photo slots (front/back/tag…) are edited in the Fashion item editor; new photos
 * added here appear there under Additional.
 */
export default function FashionPhotoAppend({ images, editable, organizationId, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function addFiles(list: FileList | null) {
    if (!editable || !list || busy) return;
    const remaining = MAX_PHOTOS - images.length;
    if (remaining <= 0) { setErrors([`This garment already has the maximum of ${MAX_PHOTOS} photos.`]); return; }
    const accepted = Array.from(list).slice(0, remaining).filter((file) => ACCEPTED.includes(file.type) && file.size <= MAX_FILE_BYTES);
    if (!accepted.length) { setErrors(['Use JPEG, PNG, or WebP photos of 20 MB or less.']); return; }
    setBusy(true); setErrors([]);
    try {
      const result = await uploadFashionPhotos(accepted, organizationId);
      onChange([...images, ...result.uploaded.map((item) => item.url).filter(Boolean)].slice(0, MAX_PHOTOS));
      setErrors(result.errors);
    } catch (error) {
      setErrors([fashionError(error)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {editable && <div className="flex flex-wrap gap-3">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = ''; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = ''; }} />
        <button type="button" disabled={busy || images.length >= MAX_PHOTOS} onClick={() => cameraRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-700 disabled:opacity-40 dark:border-pink-800 dark:text-pink-300"><Camera size={16} /> Take photo</button>
        <button type="button" disabled={busy || images.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40"><ImagePlus size={16} /> Upload photos</button>
        {busy && <span role="status" className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Uploading…</span>}
      </div>}
      {errors.map((error) => <p key={error} role="alert" className="text-sm text-red-600">{error}</p>)}
    </div>
  );
}
