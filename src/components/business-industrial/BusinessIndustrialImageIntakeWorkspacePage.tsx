import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, FolderOpen, ImagePlus, Loader2, RefreshCw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collectDroppedImageDriveFiles, getImageDriveRootFolderName, toImageDriveFolderFiles, type ImageDriveFolderFile } from '../../lib/imageDriveUpload';
import { useAuth } from '../auth/AuthContext';
import { applyImageIntakeGroup, createDriveImageIntakeJob, createImageIntakeJob, downloadImageIntakeExport, getImageIntakeGroup, getImageIntakeJob, listImageIntakeGroups, listImageIntakeJobs, startImageIntakeJob, uploadImageIntakeFolder, type ImageIntakeGroup, type ImageIntakeGroupDetail, type ImageIntakeJob } from '../../lib/businessIndustrialImageIntakeApi';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import FeedbackPanel from '../ui/FeedbackPanel';

const FAMILIES = [['industrial_automation', 'Industrial automation & controls'], ['electrical_equipment', 'Electrical equipment & protection'], ['machinery_tooling', 'Manufacturing machinery, tooling & spare parts'], ['hydraulics_pneumatics', 'Hydraulics, pneumatics, pumps & valves'], ['test_measurement', 'Test, measurement & inspection equipment'], ['material_handling', 'Material handling & industrial storage'], ['commercial_equipment', 'Commercial kitchen, office & retail equipment'], ['construction_safety', 'Construction, industrial supplies & safety'], ['medical_laboratory', 'Medical and laboratory equipment (restricted)'], ['hazmat_chemical', 'Hazardous materials and chemicals (restricted)']] as const;
const CONDITIONS: Record<string, string> = { '1000': 'New', '1500': 'New other / open box', '2500': 'Seller refurbished', '3000': 'Used', '7000': 'For parts or not working' };
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete the image intake request.';
const labelFor = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const badgeFor = (status: string) => status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300';

export default function BusinessIndustrialImageIntakeWorkspacePage() {
  const { activeOrganizationId } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<'drive' | 'folder'>('drive');
  const [driveUrl, setDriveUrl] = useState('');
  const [driveLimit, setDriveLimit] = useState('200');
  const [driveSkip, setDriveSkip] = useState('');
  const [driveAutoCreate, setDriveAutoCreate] = useState(true);
  const [files, setFiles] = useState<ImageDriveFolderFile[]>([]);
  const [rootName, setRootName] = useState('');
  const [jobs, setJobs] = useState<ImageIntakeJob[]>([]);
  const [job, setJob] = useState<ImageIntakeJob | null>(null);
  const [groups, setGroups] = useState<ImageIntakeGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ImageIntakeGroupDetail | null>(null);
  const [family, setFamily] = useState('');
  const [title, setTitle] = useState('');
  const [conditionId, setConditionId] = useState('');
  const [conditionLabel, setConditionLabel] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const folderCount = useMemo(() => new Set(files.map((item) => item.relativePath.split(/[\\/]+/).filter(Boolean).slice(-2, -1)[0] || item.relativePath)).size, [files]);
  const progress = job?.totalFolders ? Math.round((job.processedFolders / job.totalFolders) * 100) : 0;
  const isActive = Boolean(job && ['pending', 'processing'].includes(job.status));

  async function refreshJobs(preferredId?: string) {
    try {
      const result = await listImageIntakeJobs(activeOrganizationId);
      setJobs(result);
      if (preferredId) setJob(result.find((item) => item.id === preferredId) ?? null);
      else setJob((current) => current ? result.find((item) => item.id === current.id) ?? current : result[0] ?? null);
    } catch (error) { setMessage(messageOf(error)); }
  }
  async function refreshGroups(jobId: string) {
    try { setGroups(await listImageIntakeGroups(jobId, activeOrganizationId)); } catch (error) { setMessage(messageOf(error)); }
  }
  useEffect(() => { void refreshJobs(); }, [activeOrganizationId]);
  useEffect(() => {
    if (!job) return;
    void refreshGroups(job.id);
    if (!['pending', 'processing'].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const updated = await getImageIntakeJob(job.id, activeOrganizationId);
        setJob(updated); await refreshGroups(job.id);
        if (!['pending', 'processing'].includes(updated.status)) await refreshJobs(job.id);
      } catch (error) { setMessage(messageOf(error)); }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, activeOrganizationId]);

  function acceptFiles(next: ImageDriveFolderFile[]) {
    if (!next.length) { setMessage('No supported image files were found.'); return; }
    if (next.length > 5000) { setMessage('This folder contains more than 5,000 images. Split it into smaller imports.'); return; }
    const oversized = next.find((item) => item.file.size > 25 * 1024 * 1024);
    if (oversized) { setMessage(oversized.file.name + ' is larger than the 25 MB per-image limit.'); return; }
    if (next.reduce((total, item) => total + item.file.size, 0) > 1024 * 1024 * 1024) { setMessage('This folder is larger than the 1 GB intake limit.'); return; }
    const nextFolderCount = new Set(next.map((item) => item.relativePath.split(/[\\/]+/).filter(Boolean).slice(-2, -1)[0] || item.relativePath)).size;
    setFiles(next); setRootName(getImageDriveRootFolderName(next)); setMessage(next.length + ' images found across ' + nextFolderCount + ' part folders.');
  }
  async function importFromDrive() {
    const limit = Number(driveLimit);
    if (!driveUrl.trim()) { setMessage('Paste a public Google Drive folder URL first.'); return; }
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) { setMessage('The folder limit must be a whole number from 1 to 200.'); return; }
    setBusy(true); setMessage('Queueing Google Drive import on the server...');
    try {
      const skipped = driveSkip.split(',').map((item) => item.trim()).filter(Boolean);
      const created = await createDriveImageIntakeJob(driveUrl.trim(), limit, skipped, driveAutoCreate, activeOrganizationId);
      setJob(created); setSelectedGroup(null); await refreshJobs(created.id); setMessage('Import queued. Background processing and progress updates are active.');
    } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); }
  }
  async function importLocalFolder() {
    if (!files.length) { setMessage('Choose or drop a folder of part images first.'); return; }
    setBusy(true); setMessage('Creating the folder import...');
    try {
      const created = await createImageIntakeJob(rootName || 'Folder import', activeOrganizationId);
      setJob(created); setUploadProgress(0);
      const result = await uploadImageIntakeFolder(created.id, files, setUploadProgress, activeOrganizationId);
      setMessage(result.errors.length ? result.uploaded + ' uploaded; ' + result.errors.length + ' file(s) need attention.' : result.uploaded + ' images uploaded. Starting AI identification...');
      const started = await startImageIntakeJob(created.id, activeOrganizationId);
      setJob(started); setFiles([]); setUploadProgress(100); await refreshGroups(created.id); await refreshJobs(created.id);
    } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); }
  }
  async function inspectGroup(group: ImageIntakeGroup) {
    try {
      const detail = await getImageIntakeGroup(group.id, activeOrganizationId);
      setSelectedGroup(detail); setFamily(detail.detected.categoryFamily ?? ''); setTitle(detail.detected.title ?? '');
      setConditionId(detail.detected.conditionLabel?.toUpperCase() === 'NEW' ? '1000' : detail.detected.conditionLabel?.toUpperCase() === 'USED' ? '3000' : '');
      setConditionLabel(detail.detected.conditionLabel ?? 'UNKNOWN'); setPrice(''); setQuantity(String(detail.instanceCount));
    } catch (error) { setMessage(messageOf(error)); }
  }
  async function createDraft() {
    if (!selectedGroup) return;
    setBusy(true); setMessage('Creating the B&I catalog draft...');
    try {
      const result = await applyImageIntakeGroup(selectedGroup.id, { categoryFamily: family || undefined, title: title || undefined, conditionId: conditionId || undefined, conditionLabel: conditionLabel || undefined, price: price ? Number(price) : undefined, quantity: quantity ? Number(quantity) : undefined }, activeOrganizationId);
      setMessage(result.created ? 'Draft created and available in the B&I catalog for completion and review.' : 'This image group is already linked to a draft.');
      await refreshGroups(selectedGroup.jobId); await refreshJobs(selectedGroup.jobId);
      navigate(result.catalogProductId ? '/business-industrial/listings/editor?edit=' + encodeURIComponent(result.catalogProductId) : '/business-industrial/catalog');
    } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); }
  }
  async function retry() {
    if (!job) return;
    setBusy(true); setMessage('Retrying pending and failed groups...');
    try { const started = await startImageIntakeJob(job.id, activeOrganizationId); setJob(started); await refreshGroups(job.id); await refreshJobs(job.id); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); }
  }
  async function exportRun() {
    if (!job) return;
    try { const blob = await downloadImageIntakeExport(job.id, activeOrganizationId); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'omni-core-bi-image-intake-' + job.id + '.xlsx'; anchor.click(); URL.revokeObjectURL(url); setMessage('Excel workbook downloaded.'); } catch (error) { setMessage(messageOf(error)); }
  }

  return <div className="space-y-6">
    <WorkspacePageHeader eyebrow="Business & Industrial workspace" title="Image intake" subtitle="Import product images, identify parts with AI, review the evidence, and move approved information into the B&I catalog. Drive imports are limited to 200 folders; local folders accept up to 5,000 images and 25 MB per file.">
      <button type="button" onClick={() => void refreshJobs(job?.id)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900"><RefreshCw size={15} /> Refresh runs</button>
      <button type="button" onClick={() => navigate('/business-industrial/catalog')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}><ExternalLink size={15} /> Open catalog</button>
    </WorkspacePageHeader>
    {message && <FeedbackPanel tone="info" onDismiss={() => setMessage('')}>{message}</FeedbackPanel>}
    {job && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-xs text-slate-500">Run status</p><p className={'mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ' + badgeFor(job.status)}>{labelFor(job.status)}</p></div><div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-xs text-slate-500">Folders</p><p className="mt-1 text-xl font-semibold">{job.processedFolders} / {job.totalFolders}</p></div><div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-xs text-slate-500">Images</p><p className="mt-1 text-xl font-semibold">{job.processedImages} / {job.totalImages}</p></div><div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-xs text-slate-500">Catalog groups</p><p className="mt-1 text-xl font-semibold">{job.groupedParts}</p></div><div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900"><p className="text-xs text-slate-500">AI usage</p><p className="mt-1 text-xl font-semibold">{'$' + (job.aiCostUsd ?? 0).toFixed(4)}</p><p className="text-[11px] text-slate-500">{job.aiRuns ?? 0} runs · {job.aiInputTokens ?? 0} in / {job.aiOutputTokens ?? 0} out</p></div></div>}
    <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Choose an image source</h2><p className="mt-1 text-sm text-slate-500">Both sources create an organization-scoped run and keep results available for review.</p></div><div className="grid w-full min-w-0 grid-cols-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:w-auto"><button type="button" onClick={() => setSource('drive')} className={'min-h-11 rounded-md px-3 py-2 text-sm font-semibold ' + (source === 'drive' ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300' : 'text-slate-500')}>Google Drive</button><button type="button" onClick={() => setSource('folder')} className={'min-h-11 rounded-md px-3 py-2 text-sm font-semibold ' + (source === 'folder' ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300' : 'text-slate-500')}>Local folder</button></div></div>{source === 'drive' ? <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]"><div><label className="text-sm font-medium">Public Google Drive folder URL<input className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" placeholder="https://drive.google.com/drive/folders/..." value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} /></label><label className="mt-4 block text-sm font-medium">Folder names to skip <span className="font-normal text-slate-500">(comma separated)</span><input className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" placeholder="Packaging, Archive" value={driveSkip} onChange={(event) => setDriveSkip(event.target.value)} /></label></div><div><label className="text-sm font-medium">Maximum product folders<input type="number" min="1" max="200" step="1" className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" value={driveLimit} onChange={(event) => setDriveLimit(event.target.value)} /></label><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={driveAutoCreate} onChange={(event) => setDriveAutoCreate(event.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-600" /><span><span className="font-medium">Create catalog drafts automatically</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Drafts still require review before publishing.</span></span></label></div><div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-cyan-50 p-3 text-xs text-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200"><span><strong>Server processing:</strong> images are converted to WebP, analyzed, enriched, and stored while this page can remain open for progress.</span><button type="button" onClick={() => void importFromDrive()} disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <><Loader2 className="mr-2 inline animate-spin" size={15} />Queueing...</> : 'Start Drive import'}</button></div></div> : <div className="mt-5"><div className="rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50/50 p-8 text-center dark:bg-cyan-950/20" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void collectDroppedImageDriveFiles(event.dataTransfer).then(acceptFiles).catch((error) => setMessage(messageOf(error))); }}><ImagePlus className="mx-auto text-cyan-600" size={30} /><p className="mt-3 text-sm font-medium">Drop a folder tree here</p><p className="mt-1 text-xs text-slate-500">or choose a directory containing product images</p><button type="button" className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { inputRef.current?.setAttribute('webkitdirectory', ''); inputRef.current?.click(); }} disabled={busy}><FolderOpen className="mr-2 inline" size={15} />Choose folder</button><input ref={inputRef} className="hidden" type="file" multiple onChange={(event) => { acceptFiles(toImageDriveFolderFiles(event.target.files ?? [])); event.target.value = ''; }} /></div>{files.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800"><span><strong>{rootName}</strong> · {files.length} images · {folderCount} part folders</span><button type="button" className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => void importLocalFolder()} disabled={busy}>{busy ? 'Uploading ' + uploadProgress + '%' : 'Upload and identify'}</button></div>}</div>}</section>
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]"><section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent runs</h2><span className="text-xs text-slate-500">{jobs.length} run(s)</span></div><div className="space-y-3">{jobs.map((item) => <button type="button" key={item.id} className={'block w-full rounded-xl bg-white p-4 text-left shadow-sm dark:bg-slate-900 ' + (job?.id === item.id ? 'ring-2 ring-cyan-500' : '')} onClick={() => { setJob(item); setSelectedGroup(null); }}><div className="flex items-center justify-between gap-3"><span className="truncate font-medium">{item.sourceRootName}</span><span className={'rounded-full px-2 py-1 text-xs font-semibold ' + badgeFor(item.status)}>{labelFor(item.status)}</span></div><p className="mt-2 text-xs text-slate-500">{item.groupedParts} group(s) · {item.totalFolders} folder(s) · {item.totalImages} image(s)</p><p className="mt-1 text-[11px] text-slate-400">{item.aiModel || 'GPT-5.6 Luna'} · {'$' + (item.aiCostUsd ?? 0).toFixed(4)}</p></button>)}{!jobs.length && <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No image intake runs yet.</p>}</div></section><section className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Detection and enrichment</h2>{job && <p className="mt-1 text-xs text-slate-500">{job.sourceRootName} · {job.processedFolders}/{job.totalFolders} folders processed</p>}</div>{job && <div className="flex flex-wrap gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700" onClick={() => void exportRun()}><Download size={15} /> Export Excel</button>{['partial', 'failed'].includes(job.status) && <button type="button" className="rounded-lg border border-amber-500 px-3 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50" disabled={busy} onClick={() => void retry()}>{busy ? 'Retrying...' : 'Retry failed groups'}</button>}</div>}</div>{job && <div className="mt-4"><div className="flex justify-between text-xs text-slate-500"><span>{isActive ? 'Processing in the background' : 'Run progress'}</span><span>{progress}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-2 rounded-full bg-cyan-600 transition-all" style={{ width: progress + '%' }} /></div>{job.errorMessage && <p className="mt-2 text-xs text-red-600">{job.errorMessage}</p>}</div>}<div className="mt-4 max-h-[560px] space-y-2 overflow-auto">{groups.map((group) => <button type="button" key={group.id} className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:border-cyan-400 dark:border-slate-700" onClick={() => void inspectGroup(group)}><div className="flex items-center justify-between gap-2"><span className="font-medium">{group.basePartName}</span><span className="text-xs text-slate-500">{labelFor(group.detectionStatus)}</span></div><p className="mt-1 text-xs text-slate-500">{group.instanceCount} instance(s) · {group.detected.title || 'Identification pending'}{group.confidence !== null ? ' · ' + Math.round(group.confidence * 100) + '% confidence' : ''}</p>{group.detected.categoryName && <p className="mt-1 text-xs text-cyan-700">{group.detected.categoryName}</p>}{group.catalogProductId && <p className="mt-1 text-xs font-semibold text-emerald-700">Catalog draft created</p>}</button>)}{job && !groups.length && <p className="text-sm text-slate-500">Results will appear as the run processes.</p>}</div></section></div>
    {selectedGroup && <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-cyan-600">Review group</p><h2 className="text-2xl font-semibold">{selectedGroup.basePartName}</h2><p className="mt-1 text-sm text-slate-500">{selectedGroup.rawFolderNames.join(', ')} · quantity {selectedGroup.instanceCount}</p></div><button type="button" onClick={() => setSelectedGroup(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close group review"><X size={18} /></button></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><div><div className="grid grid-cols-3 gap-2">{selectedGroup.assets.map((asset) => <img key={asset.id} src={asset.cdnUrl} alt={asset.filename} className="aspect-square rounded-lg object-cover" />)}</div><p className="mt-3 text-xs text-slate-500">AI results are suggestions based on image evidence. Verify labels, part numbers, specifications, condition, price, and included items before creating the catalog record.</p></div><div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Title<input className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="text-sm">B&amp;I category family<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" value={family} onChange={(event) => setFamily(event.target.value)}><option value="">Choose family</option>{FAMILIES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label className="text-sm">eBay condition<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" value={conditionId} onChange={(event) => { setConditionId(event.target.value); setConditionLabel(CONDITIONS[event.target.value] || ''); }}><option value="">Confirm in editor</option>{Object.entries(CONDITIONS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label className="text-sm">Condition description<input className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2" value={conditionLabel} onChange={(event) => setConditionLabel(event.target.value)} /></label><label className="text-sm">Price<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="text-sm">Quantity<input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label></div><div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><p><strong>Detected:</strong> {[selectedGroup.detected.brand, selectedGroup.detected.model, selectedGroup.detected.mpn, selectedGroup.detected.partType, selectedGroup.detected.conditionLabel].filter(Boolean).join(' · ') || 'No high-confidence text identification'}</p><p className="mt-2"><strong>eBay category:</strong> {selectedGroup.detected.categoryName || 'Manual category selection required'}</p>{selectedGroup.detected.warnings.length > 0 && <p className="mt-2 text-amber-700"><strong>Review notes:</strong> {selectedGroup.detected.warnings.join(' ')}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void createDraft()} disabled={busy || !family}>{busy ? <Loader2 className="mr-2 inline animate-spin" size={15} /> : <CheckCircle2 className="mr-2 inline" size={15} />}Create catalog draft</button><button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700" onClick={() => navigate('/business-industrial/catalog')}>View catalog</button></div></div></div></section>}
  </div>;
}
