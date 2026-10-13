import { useEffect, useRef, useState } from 'react';
import { fashionError, uploadFashionPhotos } from '../../lib/fashionListingsApi';
import { prepareFashionPhoto } from '../../lib/fashionCaptureMedia';
import { FASHION_PHOTO_SLOTS, countFashionPhotos, type FashionPhotoRole, type FashionPhotoSlots } from '../../lib/fashionPhotoSlots';

export type PhotoUploadState = { pending: number; failed: number };
type PendingPhoto = { id: string; role: FashionPhotoRole; file: File; preview: string; status: 'queued' | 'uploading' | 'failed'; error?: string };
type Options = {
  slots: FashionPhotoSlots;
  onChange: (slots: FashionPhotoSlots) => void;
  organizationId?: string | null;
  sku?: string;
  onUploadStateChange?: (state: PhotoUploadState) => void;
};

/** Two uploads at a time; failed files remain available for an explicit retry. */
export function useFashionPhotoQueue(options: Options) {
  const latest = useRef(options); latest.current = options;
  const slotsRef = useRef(options.slots); slotsRef.current = options.slots;
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const photosRef = useRef(photos);
  const running = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);
  const [errors, setErrors] = useState<string[]>([]);
  function change(next: PendingPhoto[]) { photosRef.current = next; if (mounted.current) setPhotos(next); }
  function commitSlots(next: FashionPhotoSlots) { slotsRef.current = next; latest.current.onChange(next); }
  const pending = photos.filter((photo) => photo.status !== 'failed').length;
  const failed = photos.length - pending;

  useEffect(() => { latest.current.onUploadStateChange?.({ pending, failed }); }, [pending, failed]);
  useEffect(() => {
    mounted.current = true;
    const controllers = running.current;
    return () => {
      mounted.current = false;
      controllers.forEach((controller) => controller.abort());
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, []);

  useEffect(() => {
    async function upload(photo: PendingPhoto, controller: AbortController) {
      try {
        const file = await prepareFashionPhoto(photo.file);
        if (controller.signal.aborted) return;
        const result = await uploadFashionPhotos([file], latest.current.organizationId, latest.current.sku, controller.signal);
        const url = result.uploaded[0]?.url;
        if (!url) throw new Error(result.errors.join(' ') || 'Upload did not complete. Retry this photo.');
        if (!mounted.current || !photosRef.current.some((item) => item.id === photo.id)) return;
        const current = slotsRef.current;
        commitSlots({ ...current, [photo.role]: [...current[photo.role], url] });
        URL.revokeObjectURL(photo.preview);
        change(photosRef.current.filter((item) => item.id !== photo.id));
      } catch (error) {
        if (mounted.current && !controller.signal.aborted) change(photosRef.current.map((item) => item.id === photo.id ? { ...item, status: 'failed', error: fashionError(error) } : item));
      } finally {
        running.current.delete(photo.id);
        // Schedule queued work even when a cancelled operation finishes late.
        if (mounted.current) change([...photosRef.current]);
      }
    }
    for (const photo of photosRef.current) {
      if (running.current.size >= 2) break;
      if (photo.status !== 'queued' || running.current.has(photo.id)) continue;
      // Preserve capture order within a slot even when network responses vary.
      if (photosRef.current.some((item) => item.role === photo.role && running.current.has(item.id))) continue;
      const controller = new AbortController();
      running.current.set(photo.id, controller);
      change(photosRef.current.map((item) => item.id === photo.id ? { ...item, status: 'uploading' } : item));
      void upload(photo, controller);
    }
  }, [photos]);

  function add(role: FashionPhotoRole, files: File[]) {
    const slot = FASHION_PHOTO_SLOTS.find((item) => item.role === role)!;
    const current = photosRef.current;
    const room = Math.max(0, Math.min(slot.max - slotsRef.current[role].length - current.filter((item) => item.role === role).length, 24 - countFashionPhotos(slotsRef.current) - current.length));
    const messages: string[] = [];
    const accepted: PendingPhoto[] = [];
    for (const file of files.slice(0, room)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) messages.push(`${file.name}: use JPEG, PNG, or WebP.`);
      else if (file.size > 20 * 1024 * 1024) messages.push(`${file.name}: the maximum photo size is 20 MB.`);
      else accepted.push({ id: crypto.randomUUID(), role, file, preview: URL.createObjectURL(file), status: 'queued' });
    }
    if (files.length > room) messages.push(`${slot.label} has room for ${room} more photo${room === 1 ? '' : 's'}.`);
    setErrors(messages);
    change([...current, ...accepted]);
    return accepted.length > 0;
  }
  function removePending(id: string) {
    const photo = photosRef.current.find((item) => item.id === id);
    running.current.get(id)?.abort();
    if (photo) URL.revokeObjectURL(photo.preview);
    change(photosRef.current.filter((item) => item.id !== id));
  }
  function retry(id: string) { change(photosRef.current.map((item) => item.id === id ? { ...item, status: 'queued', error: undefined } : item)); }
  const counts = Object.fromEntries(FASHION_PHOTO_SLOTS.map((slot) => [slot.role, options.slots[slot.role].length + photos.filter((photo) => photo.role === slot.role).length])) as Record<FashionPhotoRole, number>;
  return { photos, add, removePending, retry, counts, errors, commitSlots, slotsRef, pending, failed };
}
