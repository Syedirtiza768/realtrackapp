/* ─── Image gallery with high-quality downloads ────────────
 *  Opens from a result thumbnail. Loads every image of the
 *  part at the best quality available (our S3 originals,
 *  eBay 1600 px), pages through them, and downloads the
 *  current one or all of them as a zip — through the API,
 *  so private-bucket and cross-origin images work.
 * ────────────────────────────────────────────────────────── */

import { ChevronLeft, ChevronRight, Download, FolderDown, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  downloadOmniImage,
  downloadPartImage,
  downloadPartImagesZip,
  listPartImages,
  type PartImage,
} from '../../../lib/partsSearchOptionsApi';

export type GalleryTarget = { partId: string; title: string; fallbackUrl: string | null };

type Props = { target: GalleryTarget | null; onClose: () => void };

export default function ImageGalleryDialog({ target, onClose }: Props) {
  const [images, setImages] = useState<PartImage[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'one' | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOmni = Boolean(target?.partId.startsWith('omni:'));

  useEffect(() => {
    setImages(null);
    setCurrent(0);
    setError(null);
    if (!target || isOmni) return;
    const controller = new AbortController();
    setLoading(true);
    listPartImages(target.partId, controller.signal)
      .then((data) => setImages(data.images))
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [target, isOmni]);

  const count = images?.length ?? (target?.fallbackUrl ? 1 : 0);
  const step = useCallback((delta: number) => setCurrent((i) => (count ? (i + delta + count) % count : 0)), [count]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose, step]);

  if (!target) return null;
  const image = images?.[current];
  const src = image?.previewUrl ?? target.fallbackUrl;

  const run = async (kind: 'one' | 'all') => {
    setBusy(kind);
    setError(null);
    try {
      if (isOmni) await downloadOmniImage(target.partId);
      else if (kind === 'all') await downloadPartImagesZip(target.partId);
      else await downloadPartImage(target.partId, image?.index ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Images: ${target.title}`} onClick={onClose}>
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 text-sm text-white" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 flex-1 truncate font-medium">{target.title}</p>
        {count > 1 && <span className="tabular-nums text-slate-300">{current + 1} / {count}</span>}
        <button
          type="button"
          onClick={() => void run('one')}
          disabled={busy !== null || (!image && !isOmni)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-50"
        >
          {busy === 'one' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
          Download {isOmni ? 'image' : 'full size'}
        </button>
        {count > 1 && (
          <button
            type="button"
            onClick={() => void run('all')}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy === 'all' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <FolderDown size={14} aria-hidden="true" />}
            All {count} (.zip)
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-white hover:bg-white/10" aria-label="Close images">
          <X size={18} />
        </button>
      </div>

      <div className="relative mx-auto mt-3 flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {loading && !src ? (
          <Loader2 size={28} className="animate-spin text-white" aria-label="Loading images" />
        ) : src ? (
          <img src={src} alt={target.title} referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg bg-white object-contain" />
        ) : (
          <p className="text-sm text-slate-300">No image</p>
        )}
        {count > 1 && (
          <>
            <button type="button" onClick={() => step(-1)} className="absolute left-0 rounded-full bg-white/90 p-2 text-slate-900" aria-label="Previous image">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => step(1)} className="absolute right-0 rounded-full bg-white/90 p-2 text-slate-900" aria-label="Next image">
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {images && images.length > 1 && (
        <div className="mx-auto mt-3 flex max-w-5xl gap-2 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={img.index}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Show image ${i + 1}`}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-white ${i === current ? 'border-white' : 'border-transparent opacity-70'}`}
            >
              <img src={img.previewUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="mx-auto mt-2 max-w-5xl rounded bg-red-600/90 px-3 py-1.5 text-xs text-white" onClick={(e) => e.stopPropagation()}>
          {error}
        </p>
      )}
    </div>
  );
}
