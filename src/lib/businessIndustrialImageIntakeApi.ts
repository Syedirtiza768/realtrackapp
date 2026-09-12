import { fetchDownloadResponse, fetchWithAuth } from './authApi';
import type { ImageDriveFolderFile } from './imageDriveUpload';

const API = '/api/business-industrial/image-intake';
const BATCH_SIZE = 50;
const withOrganization = (path: string, organizationId?: string | null) => organizationId
  ? path + (path.includes('?') ? '&' : '?') + 'organizationId=' + encodeURIComponent(organizationId)
  : path;

export interface ImageIntakeJob {
  id: string;
  sourceRootName: string;
  sourceReferenceUrl: string | null;
  status: string;
  totalFolders: number;
  totalImages: number;
  processedFolders: number;
  processedImages: number;
  groupedParts: number;
  failedFolders: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  aiModel?: string;
  aiInputTokens?: number;
  aiOutputTokens?: number;
  aiCostUsd?: number;
  aiRuns?: number;
  webpStorage?: boolean;
}

export interface ImageIntakeDetectedSummary {
  title: string | null;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  partType: string | null;
  conditionLabel: string | null;
  categoryFamily: string | null;
  categoryId: string | null;
  categoryName: string | null;
  warnings: string[];
}

export interface ImageIntakeGroup {
  id: string;
  jobId: string;
  basePartName: string;
  rawFolderNames: string[];
  instanceSuffixes: string[];
  instanceCount: number;
  detectionStatus: string;
  confidence: number | null;
  catalogProductId: string | null;
  errorMessage: string | null;
  detected: ImageIntakeDetectedSummary;
}

export interface ImageIntakeAsset {
  id: string;
  sourceFolderName: string;
  relativePath: string;
  filename: string;
  cdnUrl: string;
  mimeType: string | null;
  fileSizeBytes: number;
  createdAt: string;
}

export interface ImageIntakeGroupDetail extends ImageIntakeGroup {
  assets: ImageIntakeAsset[];
}

export interface ApplyImageIntakeGroupInput {
  sku?: string;
  title?: string;
  description?: string;
  brand?: string;
  model?: string;
  mpn?: string;
  conditionLabel?: string;
  conditionId?: string;
  price?: number;
  quantity?: number;
  categoryFamily?: string;
  categoryId?: string;
  categoryName?: string;
  verticalAttributes?: Record<string, unknown>;
}

export async function createImageIntakeJob(sourceRootName: string, organizationId?: string | null): Promise<ImageIntakeJob> {
  return fetchWithAuth<ImageIntakeJob>(withOrganization(`${API}/jobs`, organizationId), { method: 'POST', body: JSON.stringify({ sourceRootName }) });
}

export async function createDriveImageIntakeJob(
  folderUrl: string,
  maxItems = 200,
  skipFolderNames: string[] = [],
  autoCreateDrafts = true,
  organizationId?: string | null,
): Promise<ImageIntakeJob> {
  return fetchWithAuth<ImageIntakeJob>(withOrganization(API + '/jobs/from-drive', organizationId), {
    method: 'POST',
    body: JSON.stringify({ folderUrl, maxItems, skipFolderNames, autoCreateDrafts }),
  });
}

export async function uploadImageIntakeFolder(
  jobId: string,
  files: ImageDriveFolderFile[],
  onProgress?: (percent: number) => void,
  organizationId?: string | null,
): Promise<{ uploaded: number; skipped: number; errors: string[]; job: ImageIntakeJob }> {
  let uploaded = 0;
  let skipped = 0;
  const errors: string[] = [];
  const batches: ImageDriveFolderFile[][] = [];
  for (let index = 0; index < files.length; index += BATCH_SIZE) batches.push(files.slice(index, index + BATCH_SIZE));
  for (const [index, batch] of batches.entries()) {
    const body = new FormData();
    body.append('filePaths', JSON.stringify(batch.map((item) => item.relativePath)));
    for (const item of batch) body.append('files', item.file, item.file.name);
    const result = await fetchWithAuth<{ uploaded: number; skipped: number; errors: string[]; job: ImageIntakeJob }>(withOrganization(`${API}/jobs/${jobId}/upload`, organizationId), { method: 'POST', body });
    uploaded += result.uploaded;
    skipped += result.skipped;
    errors.push(...result.errors);
    onProgress?.(Math.round(((index + 1) / batches.length) * 100));
  }
  return { uploaded, skipped, errors, job: (await getImageIntakeJob(jobId, organizationId)) };
}

export async function startImageIntakeJob(jobId: string, organizationId?: string | null): Promise<ImageIntakeJob> {
  return fetchWithAuth<ImageIntakeJob>(withOrganization(`${API}/jobs/${jobId}/start`, organizationId), { method: 'POST' });
}

export async function listImageIntakeJobs(organizationId?: string | null): Promise<ImageIntakeJob[]> {
  const result = await fetchWithAuth<{ jobs: ImageIntakeJob[] }>(withOrganization(`${API}/jobs`, organizationId));
  return result.jobs;
}

export async function getImageIntakeJob(jobId: string, organizationId?: string | null): Promise<ImageIntakeJob> {
  return fetchWithAuth<ImageIntakeJob>(withOrganization(`${API}/jobs/${jobId}`, organizationId));
}

export async function listImageIntakeGroups(jobId: string, organizationId?: string | null): Promise<ImageIntakeGroup[]> {
  const result = await fetchWithAuth<{ groups: ImageIntakeGroup[] }>(withOrganization(`${API}/jobs/${jobId}/groups`, organizationId));
  return result.groups;
}

export async function getImageIntakeGroup(groupId: string, organizationId?: string | null): Promise<ImageIntakeGroupDetail> {
  return fetchWithAuth<ImageIntakeGroupDetail>(withOrganization(`${API}/groups/${groupId}`, organizationId));
}

export async function applyImageIntakeGroup(groupId: string, input: ApplyImageIntakeGroupInput, organizationId?: string | null) {
  return fetchWithAuth<{ catalogProductId: string; created: boolean }>(withOrganization(`${API}/groups/${groupId}/apply`, organizationId), { method: 'POST', body: JSON.stringify(input) });
}

export async function downloadImageIntakeExport(jobId: string, organizationId?: string | null): Promise<Blob> {
  const response = await fetchDownloadResponse(withOrganization(`${API}/jobs/${jobId}/export.xlsx`, organizationId));
  return response.blob();
}
