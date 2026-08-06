import { fetchWithAuth } from './authApi';

const API = '/api';

export interface DriveFileEntry {
  id: string;
  folderId: string;
  filename: string;
  cdnUrl: string;
  s3Key: string;
  s3KeyThumb: string | null;
  s3KeyMedium: string | null;
  mimeType: string | null;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  createdAt: string;
}

export interface DriveFolderEntry {
  id: string;
  name: string;
  s3Prefix: string;
  linkedPartNumber: string | null;
  fileCount: number;
  totalSizeBytes: number;
  createdAt: string;
  updatedAt: string;
  thumbnailUrls: string[];
}

export interface BatchLookupResult {
  results: Record<string, DriveFileEntry[]>;
  summary: Array<{ partNumber: string; count: number }>;
}

export interface DriveStats {
  totalFolders: number;
  totalFiles: number;
  totalSizeBytes: number;
}

export interface DriveSearchResponse {
  items: Array<DriveFileEntry & { folderName: string }>;
  total: number;
  page: number;
  totalPages: number;
}

export interface FileListResponse {
  items: DriveFileEntry[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Folders ─────────────────────────────────────────────────

export async function listFolders(): Promise<DriveFolderEntry[]> {
  return fetchWithAuth<DriveFolderEntry[]>(`${API}/image-drive/folders`);
}

export async function createFolder(
  name: string,
  linkedPartNumber?: string,
): Promise<DriveFolderEntry> {
  return fetchWithAuth<DriveFolderEntry>(`${API}/image-drive/folders`, {
    method: 'POST',
    body: JSON.stringify({ name, linkedPartNumber }),
  });
}

export async function updateFolder(
  folderId: string,
  updates: { name?: string; linkedPartNumber?: string | null },
): Promise<DriveFolderEntry> {
  return fetchWithAuth<DriveFolderEntry>(
    `${API}/image-drive/folders/${folderId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
  );
}

export async function deleteFolder(folderId: string): Promise<void> {
  await fetchWithAuth(`${API}/image-drive/folders/${folderId}`, {
    method: 'DELETE',
  });
}

// ─── Files ───────────────────────────────────────────────────

export async function listFiles(
  folderId: string,
  page = 1,
  limit = 50,
): Promise<FileListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return fetchWithAuth<FileListResponse>(
    `${API}/image-drive/folders/${folderId}/files?${params}`,
  );
}

export async function uploadToFolder(
  folderId: string,
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<{ uploaded: number; files: Array<{ filename: string; cdnUrl: string; s3Key: string }> }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/image-drive/folders/${folderId}/upload`);

    const token = localStorage.getItem('mk_auth_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
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

export async function uploadAutoCreate(
  folderName: string,
  files: File[],
  partNumber?: string,
  onProgress?: (pct: number) => void,
): Promise<{
  folderId: string;
  folderName: string;
  uploaded: number;
  files: Array<{ filename: string; cdnUrl: string; s3Key: string }>;
}> {
  const formData = new FormData();
  formData.append('folderId', 'auto');
  formData.append('folderName', folderName);
  if (partNumber) formData.append('partNumber', partNumber);
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
          onProgress(Math.round((e.loaded / e.total) * 100));
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

export async function deleteFile(fileId: string): Promise<void> {
  await fetchWithAuth(`${API}/image-drive/files/${fileId}`, {
    method: 'DELETE',
  });
}

export async function getFile(fileId: string): Promise<DriveFileEntry> {
  return fetchWithAuth<DriveFileEntry>(`${API}/image-drive/files/${fileId}`);
}

export async function bulkDeleteFiles(
  fileIds: string[],
): Promise<{ deleted: number; failed: string[] }> {
  return fetchWithAuth<{ deleted: number; failed: string[] }>(
    `${API}/image-drive/files/bulk-delete`,
    {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    },
  );
}

// ─── Lookup (auto-attach) ────────────────────────────────────

export async function lookupDriveImages(
  partNumber: string,
): Promise<DriveFileEntry[]> {
  const res = await fetchWithAuth<{
    partNumber: string;
    images: DriveFileEntry[];
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

// ─── Search ──────────────────────────────────────────────────

export async function searchDrive(
  query: string,
  page = 1,
  limit = 50,
): Promise<DriveSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    limit: String(limit),
  });
  return fetchWithAuth<DriveSearchResponse>(
    `${API}/image-drive/search?${params}`,
  );
}

// ─── Stats ───────────────────────────────────────────────────

export async function getDriveStats(): Promise<DriveStats> {
  return fetchWithAuth<DriveStats>(`${API}/image-drive/stats`);
}
