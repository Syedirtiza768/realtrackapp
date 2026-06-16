/* ─── Storage API ──────────────────────────────────────────
 *  Frontend API layer for image uploads via presigned S3 URLs.
 *  Uses the existing /storage backend endpoints.
 * ────────────────────────────────────────────────────────── */

import { fetchWithAuth } from './authApi';

const API = '/api';

/* ── Types ────────────────────────────────────────────────── */

export interface PresignedUpload {
  uploadUrl: string;
  s3Key: string;
  assetId: string;
}

export interface UploadedImage {
  assetId: string;
  cdnUrl: string;
  s3Key: string;
}

/* ── Upload flow ──────────────────────────────────────────── */

/**
 * Request presigned upload URLs from the backend.
 */
export async function requestBulkUploadUrls(
  files: Array<{ filename: string; mimeType: string; fileSize?: number }>,
): Promise<PresignedUpload[]> {
  const res = await fetchWithAuth<{ uploads: PresignedUpload[] }>(
    `${API}/storage/bulk-upload-urls`,
    {
      method: 'POST',
      body: JSON.stringify({ files }),
    },
  );
  return res.uploads;
}

/**
 * Upload a single file directly to S3 using a presigned PUT URL.
 * Reports upload progress via callback.
 */
export async function uploadFileToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.send(file);
  });
}

/**
 * Confirm an upload and get the CDN URL.
 */
export async function confirmUpload(assetId: string): Promise<UploadedImage> {
  const res = await fetchWithAuth<{ asset: { id: string; cdnUrl: string; s3Key: string } }>(
    `${API}/storage/confirm`,
    {
      method: 'POST',
      body: JSON.stringify({ assetId }),
    },
  );
  return {
    assetId: res.asset.id,
    cdnUrl: res.asset.cdnUrl,
    s3Key: res.asset.s3Key,
  };
}

/**
 * Full upload flow for multiple files:
 * 1. Request presigned URLs
 * 2. Upload each file to S3 (parallel, with per-file progress)
 * 3. Confirm each upload
 * Returns successfully uploaded images.
 */
export async function uploadImages(
  files: File[],
  onFileProgress: (index: number, pct: number) => void,
  onFileComplete: (index: number) => void,
  onFileError: (index: number, error: string) => void,
): Promise<UploadedImage[]> {
  // Step 1: Get presigned URLs
  const presigned = await requestBulkUploadUrls(
    files.map((f) => ({
      filename: f.name,
      mimeType: f.type,
      fileSize: f.size,
    })),
  );

  // Step 2: Upload all files to S3 in parallel
  const uploadResults = await Promise.allSettled(
    presigned.map(async (urlInfo, idx) => {
      await uploadFileToS3(urlInfo.uploadUrl, files[idx], (pct) => {
        onFileProgress(idx, pct);
      });
      onFileComplete(idx);
      return urlInfo;
    }),
  );

  // Step 3: Confirm successful uploads
  const confirmed: UploadedImage[] = [];
  for (let i = 0; i < uploadResults.length; i++) {
    const result = uploadResults[i];
    if (result.status === 'fulfilled') {
      try {
        const img = await confirmUpload(result.value.assetId);
        confirmed.push(img);
      } catch {
        onFileError(i, 'Confirm failed');
      }
    } else {
      onFileError(i, result.reason?.message ?? 'Upload failed');
    }
  }

  return confirmed;
}
