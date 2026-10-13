export const FASHION_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'OS'] as const;

export function fashionSkuWithSize(base: string, size: string) {
  const suffix = size.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return suffix ? `${base}-${suffix}` : base;
}

/** Release late results (especially camera streams) after a deadline or cancellation. */
export function mediaDeadline<T>(promise: Promise<T>, ms: number, message: string, release?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = window.setTimeout(() => { expired = true; reject(new Error(message)); }, ms);
    promise.then((value) => {
      window.clearTimeout(timer);
      if (expired) release?.(value); else resolve(value);
    }, (error) => { window.clearTimeout(timer); if (!expired) reject(error); });
  });
}

/** Keep label detail while avoiding multi-megabyte camera uploads. */
export async function prepareFashionPhoto(file: File): Promise<File> {
  if (file.size < 750_000) return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await mediaDeadline(createImageBitmap(file), 8_000, 'Could not prepare this photo. Retry or choose another image.', (late) => late.close());
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await mediaDeadline(new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9)), 8_000, 'Could not prepare this photo. Please retry.');
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    // Older devices can upload the original; optimization never prevents capture.
    return file;
  } finally { bitmap?.close(); }
}
