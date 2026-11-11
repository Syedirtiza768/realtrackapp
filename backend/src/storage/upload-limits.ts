/**
 * Multer options for image endpoints that buffer uploads in memory
 * (multer's default storage). Without `limits`, a 50-file request is held in
 * the API process heap in full. A 16MP phone/DSLR JPEG is well under 20MB, and
 * MAX_PIXEL_COUNT in image-processor.service.ts already rejects larger images.
 */
export const IMAGE_UPLOAD_MAX_FILE_BYTES = Number(
  process.env.IMAGE_UPLOAD_MAX_FILE_MB ?? '20',
) * 1024 * 1024;

export const IMAGE_UPLOAD_MULTER_OPTIONS = {
  limits: { fileSize: IMAGE_UPLOAD_MAX_FILE_BYTES },
};
