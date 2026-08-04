import { fetchWithAuth } from './authApi';

const API = '/api';

export interface ImageDriveEntry {
  id: string;
  partNumberRaw: string;
  cdnUrl: string;
  s3Key: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number;
  source: string;
  sourceListingId: string | null;
  createdAt: string;
}

export interface BatchLookupResult {
  results: Record<string, ImageDriveEntry[]>;
  summary: Array<{ partNumber: string; count: number }>;
}

export interface ImageDriveStats {
  totalParts: number;
  totalImages: number;
}

export interface ImageDriveSearchResponse {
  items: ImageDriveEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export async function lookupDriveImages(
  partNumber: string,
): Promise<ImageDriveEntry[]> {
  const res = await fetchWithAuth<{
    partNumber: string;
    images: ImageDriveEntry[];
    count: number;
  }>(`${API}/image-drive/lookup/${encodeURIComponent(partNumber)}`);
  return res.images;
}

export async function batchLookupDriveImages(
  partNumbers: string[],
): Promise<BatchLookupResult> {
  return fetchWithAuth<BatchLookupResult>(`${API}/image-drive/lookup`, {
    method: 'POST',
    body: JSON.stringify({ partNumbers }),
  });
}

export async function uploadToDrive(
  partNumber: string,
  files: File[],
  onProgress?: (fileIndex: number, pct: number) => void,
): Promise<{ recorded: number; images: Array<{ cdnUrl: string; s3Key: string }> }> {
  const formData = new FormData();
  formData.append('partNumber', partNumber);
  for (const file of files) {
    formData.append('files', file);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/image-drive/upload`);

    const token = localStorage.getItem('mk_auth_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(0, Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(formData);
  });
}

export async function deleteDriveImage(assetId: string): Promise<void> {
  await fetchWithAuth(`${API}/image-drive/${assetId}`, { method: 'DELETE' });
}

export async function searchDrive(
  query: string,
  page = 1,
  limit = 50,
): Promise<ImageDriveSearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page), limit: String(limit) });
  return fetchWithAuth<ImageDriveSearchResponse>(`${API}/image-drive/search?${params}`);
}

export async function getDriveStats(): Promise<ImageDriveStats> {
  return fetchWithAuth<ImageDriveStats>(`${API}/image-drive/stats`);
}

export async function recordAssetsToDrive(
  partNumber: string,
  assetIds: string[],
): Promise<{ recorded: number }> {
  return fetchWithAuth<{ recorded: number }>(`${API}/image-drive/record`, {
    method: 'POST',
    body: JSON.stringify({ partNumber, assetIds }),
  });
}
