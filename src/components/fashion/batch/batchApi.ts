import { fetchWithAuth } from '../../../lib/authApi';

/** Client for /api/fashion/batch-publish (Fashion "Publish next N" pipeline). */
export const BATCH_API = '/api/fashion/batch-publish';

export type PipelineState =
  | 'UNPUBLISHED' | 'IMAGES_PROCESSING' | 'IMAGES_READY' | 'COMPLIANCE_CHECK'
  | 'NEEDS_REVIEW' | 'BLOCKED' | 'READY' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

export type ComplianceResult = 'PASS' | 'AUTO_FIXED' | 'NEEDS_REVIEW' | 'BLOCKED';

export type ComplianceIssue = {
  code: string;
  severity: 'info' | 'warn' | 'review' | 'block';
  message: string;
  field?: string;
  evidence?: string;
  imageIndex?: number;
  autoFixed?: boolean;
  source?: 'text' | 'vision' | 'image';
};

export type BatchSummary = {
  id: string;
  requestedSize: number;
  dryRun: boolean;
  ebayAccountId: string | null;
  marketplaceId: string | null;
  confirmedByUserId: string | null;
  status: 'queued' | 'running' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt: string | null;
  counts: Partial<Record<PipelineState, number>>;
};

export type BatchItem = {
  id: string;
  position: number;
  catalogProductId: string;
  state: PipelineState;
  complianceResult: ComplianceResult | null;
  riskScore: number | null;
  issueCodes: string[];
  ebayItemId: string | null;
  error: string | null;
  finishedAt: string | null;
  sku: string | null;
  title: string;
  brand: string | null;
  price: string | null;
  thumbUrl: string | null;
};

export type BatchDetail = BatchSummary & {
  topIssues: Array<{ code: string; count: number }>;
  items: BatchItem[];
};

export type ReviewSuggestion = {
  before: { title: string; description: string | null; brand: string | null };
  after: { title: string; description: string | null; brand: string | null };
  rationale: string;
  model: string | null;
  status: 'pending' | 'applied' | 'rejected' | 'edited';
};

export type ReviewView = {
  catalogProductId: string;
  state: PipelineState;
  complianceResult: ComplianceResult | null;
  riskScore: number | null;
  issues: ComplianceIssue[];
  fixes: Array<{ field: string; before: unknown; after: unknown; reason: string }>;
  suggestion: ReviewSuggestion | null;
  images: Array<{ index: number; thumb: string | null; width: number | null; height: number | null; flags: string[]; excluded: { code: string; reason: string } | null; error: string | null }>;
  ebayMasterUrls: string[];
  checkedAt: string | null;
  lastError: string | null;
  listing: { id: string; sku: string | null; title: string; description: string | null; brand: string | null; brandSpecific: string | null; price: string | null; categoryName: string | null; verticalValidationStatus: string | null };
};

export type AuditEntry = {
  id: string;
  action: string;
  result: string;
  userId: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  createdAt: string;
};

export const withOrg = (path: string, organizationId?: string | null) =>
  organizationId ? `${path}${path.includes('?') ? '&' : '?'}organizationId=${encodeURIComponent(organizationId)}` : path;

export const batchApi = {
  create: (body: { size: number; dryRun: boolean; ebayAccountId?: string; marketplaceId?: string; confirmAuthenticity?: boolean; organizationId?: string }) =>
    fetchWithAuth<{ batchId: string; picked: number; dryRun: boolean; message: string }>(`${BATCH_API}/batches`, { method: 'POST', body: JSON.stringify(body) }),
  list: (org?: string | null) => fetchWithAuth<BatchSummary[]>(withOrg(`${BATCH_API}/batches`, org)),
  get: (id: string, org?: string | null) => fetchWithAuth<BatchDetail>(withOrg(`${BATCH_API}/batches/${id}`, org)),
  retry: (itemId: string, org?: string | null) => fetchWithAuth(withOrg(`${BATCH_API}/items/${itemId}/retry`, org), { method: 'POST' }),
  queue: (state: 'NEEDS_REVIEW' | 'BLOCKED', org?: string | null) => fetchWithAuth<ReviewView[]>(withOrg(`${BATCH_API}/review-queue?state=${state}`, org)),
  listing: (id: string, org?: string | null) => fetchWithAuth<ReviewView>(withOrg(`${BATCH_API}/listings/${id}`, org)),
  audit: (id: string, org?: string | null) => fetchWithAuth<AuditEntry[]>(withOrg(`${BATCH_API}/listings/${id}/audit`, org)),
  applySuggestion: (id: string, body: { title?: string; description?: string | null; brand?: string | null }, org?: string | null) =>
    fetchWithAuth<ReviewView>(withOrg(`${BATCH_API}/listings/${id}/apply-suggestion`, org), { method: 'POST', body: JSON.stringify(body) }),
  rejectSuggestion: (id: string, org?: string | null) => fetchWithAuth<ReviewView>(withOrg(`${BATCH_API}/listings/${id}/reject-suggestion`, org), { method: 'POST' }),
  recheck: (id: string, org?: string | null) => fetchWithAuth<ReviewView>(withOrg(`${BATCH_API}/listings/${id}/recheck`, org), { method: 'POST' }),
  approve: (id: string, body: { authenticityConfirmed: boolean; notes?: string }, org?: string | null) =>
    fetchWithAuth<ReviewView>(withOrg(`${BATCH_API}/listings/${id}/approve`, org), { method: 'POST', body: JSON.stringify(body) }),
  reject: (id: string, notes: string, org?: string | null) =>
    fetchWithAuth<ReviewView>(withOrg(`${BATCH_API}/listings/${id}/reject`, org), { method: 'POST', body: JSON.stringify({ notes }) }),
  async downloadReport(id: string, org?: string | null) {
    const token = localStorage.getItem('mk_auth_token');
    const res = await fetch(withOrg(`${BATCH_API}/batches/${id}/report.csv`, org), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`Report download failed (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `fashion-batch-${id.slice(0, 8)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const STATE_LABEL: Record<PipelineState, string> = {
  UNPUBLISHED: 'Queued',
  IMAGES_PROCESSING: 'Processing images',
  IMAGES_READY: 'Images ready',
  COMPLIANCE_CHECK: 'Checking',
  NEEDS_REVIEW: 'Needs review',
  BLOCKED: 'Blocked',
  READY: 'Ready',
  PUBLISHING: 'Publishing',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
};

export const STATE_TONE: Record<PipelineState, string> = {
  UNPUBLISHED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  IMAGES_PROCESSING: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  IMAGES_READY: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  COMPLIANCE_CHECK: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  BLOCKED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  READY: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  PUBLISHING: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  PUBLISHED: 'bg-emerald-600 text-white dark:bg-emerald-700',
  FAILED: 'bg-red-600 text-white dark:bg-red-700',
};

export const SEVERITY_TONE: Record<ComplianceIssue['severity'], string> = {
  info: 'text-slate-500',
  warn: 'text-amber-700 dark:text-amber-300',
  review: 'text-amber-800 dark:text-amber-200 font-medium',
  block: 'text-red-700 dark:text-red-300 font-semibold',
};

export const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Unable to complete request.');
