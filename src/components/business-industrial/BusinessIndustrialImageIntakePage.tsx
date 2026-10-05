import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FolderOpen, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collectDroppedImageDriveFiles, getImageDriveRootFolderName, toImageDriveFolderFiles, type ImageDriveFolderFile } from '../../lib/imageDriveUpload';
import { applyImageIntakeGroup, createDriveImageIntakeJob, createImageIntakeJob, downloadImageIntakeExport, getImageIntakeGroup, getImageIntakeJob, listImageIntakeGroups, listImageIntakeJobs, startImageIntakeJob, uploadImageIntakeFolder, type ImageIntakeGroup, type ImageIntakeGroupDetail, type ImageIntakeJob } from '../../lib/businessIndustrialImageIntakeApi';

const CATEGORY_FAMILIES = [
  ['industrial_automation', 'Industrial automation & controls'],
  ['electrical_equipment', 'Electrical equipment & protection'],
  ['machinery_tooling', 'Manufacturing machinery, tooling & spare parts'],
  ['hydraulics_pneumatics', 'Hydraulics, pneumatics, pumps & valves'],
  ['test_measurement', 'Test, measurement & inspection equipment'],
  ['material_handling', 'Material handling & industrial storage'],
  ['commercial_equipment', 'Commercial kitchen, office & retail equipment'],
  ['construction_safety', 'Construction, industrial supplies & safety'],
  ['medical_laboratory', 'Medical and laboratory equipment (restricted)'],
  ['hazmat_chemical', 'Hazardous materials and chemicals (restricted)'],
] as const;
const conditionIdForLabel = (value: string | null) => {
  const label = (value ?? '').toUpperCase();
  if (label === 'NEW') return '1000';
  if (label === 'REFURBISHED') return '2500';
  if (label === 'FOR_PARTS') return '7000';
  if (label === 'USED') return '3000';
  return '';
};

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete the image intake request.';
const statusLabel = (value: string) => value.replace(/_/g, ' ');

export default function BusinessIndustrialImageIntakePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ImageDriveFolderFile[]>([]);
  const [rootName, setRootName] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [jobs, setJobs] = useState<ImageIntakeJob[]>([]);
  const [job, setJob] = useState<ImageIntakeJob | null>(null);
  const [groups, setGroups] = useState<ImageIntakeGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ImageIntakeGroupDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categoryFamily, setCategoryFamily] = useState('');
  const [title, setTitle] = useState('');
  const [conditionLabel, setConditionLabel] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [conditionId, setConditionId] = useState('');

  const folderPreview = useMemo(() => {
    const names = new Map<string, number>();
    for (const item of files) {
      const parts = item.relativePath.split(/[\\/]+/).filter(Boolean);
      const partFolder = parts.length > 2 && parts[0].toLowerCase() === rootName.toLowerCase() ? parts[1] : parts[0];
      if (partFolder) names.set(partFolder, (names.get(partFolder) ?? 0) + 1);
    }
    return [...names.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [files, rootName]);

  async function loadJobs() {
    try {
      const result = await listImageIntakeJobs();
      setJobs(result);
      if (job) setJob(result.find((item) => item.id === job.id) ?? job);
      else if (result[0]) setJob(result[0]);
    } catch (error) { setMessage(messageOf(error)); }
  }

  async function loadGroups(jobId: string) {
    try { setGroups(await listImageIntakeGroups(jobId)); }
    catch (error) { setMessage(messageOf(error)); }
  }

  useEffect(() => { void loadJobs(); }, []);
  useEffect(() => {
    if (!job) return;
    void loadGroups(job.id);
    if (!['processing', 'pending'].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try { setJob(await getImageIntakeJob(job.id)); await loadGroups(job.id); }
      catch (error) { setMessage(messageOf(error)); }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  function acceptFiles(next: ImageDriveFolderFile[]) {
    if (!next.length) { setMessage('No supported image files were found.'); return; }
    const bytes = next.reduce((sum, item) => sum + item.file.size, 0);
    if (bytes > 1024 * 1024 * 1024) { setMessage('This folder is larger than the 1 GB intake limit. Upload it in smaller runs.'); return; }
    setFiles(next); setRootName(getImageDriveRootFolderName(next)); setMessage(`${next.length} images found across the selected folder tree.`);
  }

  async function beginIntake() {
    if (!files.length) { setMessage('Choose or drop a folder of part images first.'); return; }
    setBusy(true); setMessage('Creating the B&I intake run…'); setUploadProgress(0);
    try {
      const created = await createImageIntakeJob(rootName || 'Folder Upload');
      setJob(created);
      const result = await uploadImageIntakeFolder(created.id, files, setUploadProgress);
      if (result.errors.length) setMessage(`${result.uploaded} uploaded; ${result.errors.length} file(s) need attention. Starting detection for the valid images.`);
      else setMessage(`${result.uploaded} images uploaded. Starting AI identification…`);
      const started = await startImageIntakeJob(created.id);
      setJob(started); setFiles([]); setUploadProgress(100); await loadGroups(created.id); await loadJobs();
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  }

  async function beginDrivePilot() {
    if (!driveUrl.trim()) { setMessage('Paste a public Google Drive folder link first.'); return; }
    setBusy(true); setMessage('Queueing the 20-item Google Drive pilot on the server…');
    try {
      const created = await createDriveImageIntakeJob(driveUrl.trim(), 20);
      setJob(created); setSelectedGroup(null); await loadJobs();
      setMessage('Drive pilot queued. The server will download, convert to WebP, detect, enrich, and create reviewable catalog drafts in the background.');
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  }

  async function inspectGroup(group: ImageIntakeGroup) {
    try { setSelectedGroup(await getImageIntakeGroup(group.id)); setCategoryFamily(group.detected.categoryFamily ?? ''); setTitle(group.detected.title ?? ''); setConditionId(conditionIdForLabel(group.detected.conditionLabel)); setConditionLabel(group.detected.conditionLabel ?? 'UNKNOWN'); setPrice(''); setQuantity(String(group.instanceCount)); }
    catch (error) { setMessage(messageOf(error)); }
  }

  async function createDraft() {
    if (!selectedGroup) return;
    setBusy(true); setMessage('Creating the B&I draft…');
    try {
      const result = await applyImageIntakeGroup(selectedGroup.id, { categoryFamily: categoryFamily || undefined, title: title || undefined, conditionId: conditionId || undefined, conditionLabel: conditionLabel || undefined, price: price ? Number(price) : undefined, quantity: quantity ? Number(quantity) : undefined });
      setMessage(result.created ? 'Draft created. Complete the listing details and compliance review before eBay publishing.' : 'This image group is already linked to a draft.');
      await loadGroups(selectedGroup.jobId); await loadJobs();
      navigate('/business-industrial/listings');
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  }

  async function retryDetection() {
    if (!job) return;
    setBusy(true); setMessage('Retrying only pending or failed part groups…');
    try {
      const started = await startImageIntakeJob(job.id);
      setJob(started); await loadGroups(job.id); await loadJobs();
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  }

  async function downloadExport() {
    if (!job) return;
    try { const blob = await downloadImageIntakeExport(job.id); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `omni-core-bi-image-intake-${job.id}.xlsx`; anchor.click(); URL.revokeObjectURL(url); setMessage('Excel workbook downloaded.'); }
    catch (error) { setMessage(messageOf(error)); }
  }

  const progress = job?.totalFolders ? Math.min(100, Math.round((job.processedFolders / job.totalFolders) * 100)) : 0;

  return <div>
    {job && <p className="mt-4 rounded-lg bg-cyan-50 p-3 text-xs text-slate-600 dark:bg-cyan-950/20 dark:text-slate-300">Model: {job.aiModel || 'GPT-5.6 Luna'} · AI cost: ${(job.aiCostUsd ?? 0).toFixed(4)} · {job.aiInputTokens ?? 0} input / {job.aiOutputTokens ?? 0} output tokens · drafts remain reviewable</p>}
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-cyan-600">Business &amp; Industrial intake</p><h1 className="text-3xl font-semibold">AI image intake</h1><p className="mt-2 max-w-3xl text-slate-500">Drop a folder tree like Image Drive. Omni Core groups dot-numbered instances, reads visible labels and specifications, resolves the eBay leaf category, and prepares reviewable B&amp;I drafts.</p></div><button className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => void loadJobs()}><FolderOpen size={16} /> Refresh runs</button></div>
    {message && <p role="status" className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{message}</p>}
    {job && ['partial', 'failed'].includes(job.status) && <button className="mt-3 rounded-lg border border-amber-500 px-3 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50" disabled={busy} onClick={() => void retryDetection()}>{busy ? <Loader2 className="mr-2 inline animate-spin" size={15} /> : null}Retry failed detection groups</button>}
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex items-start gap-3"><Sparkles className="mt-1 text-cyan-600" size={24} /><div><h2 className="font-semibold">Run the 20-item Google Drive pilot</h2><p className="mt-1 text-sm text-slate-500">Paste a public folder link. The server selects up to 20 BNI item folders, downloads up to 12 images per item, converts them to WebP before S3 storage, then runs GPT-5.6 Luna detection and listing enrichment in the background.</p></div></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm" placeholder="https://drive.google.com/drive/folders/…" value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} /><button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void beginDrivePilot()} disabled={busy}>{busy ? <Loader2 className="mr-2 inline animate-spin" size={15} /> : null}Queue Drive pilot</button></div><p className="mt-2 text-xs text-slate-500">The server requires <code>GOOGLE_DRIVE_API_KEY</code> with access to the public Drive API. Drafts remain in review and are not published automatically.</p></section>
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex items-start gap-3"><UploadCloud className="mt-1 text-cyan-600" size={24} /><div><h2 className="font-semibold">Upload part images</h2><p className="mt-1 text-sm text-slate-500">Use a folder containing part folders. Each image must be a supported image type and no larger than 25 MB; a run supports up to 5,000 images.</p></div></div><div className="mt-4 rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50/50 p-8 text-center dark:bg-cyan-950/20" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void collectDroppedImageDriveFiles(event.dataTransfer).then(acceptFiles).catch((error) => setMessage(messageOf(error))); }}><Sparkles className="mx-auto text-cyan-600" size={30} /><p className="mt-3 text-sm font-medium">Drop the folder here</p><p className="mt-1 text-xs text-slate-500">or choose a directory from your computer</p><button className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => { inputRef.current?.setAttribute('webkitdirectory', ''); inputRef.current?.click(); }} disabled={busy}>{busy ? <Loader2 className="mr-2 inline animate-spin" size={15} /> : null}Choose folder</button><input ref={inputRef} className="hidden" type="file" multiple onChange={(event) => { acceptFiles(toImageDriveFolderFiles(event.target.files ?? [])); event.target.value = ''; }} /></div>{files.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800"><span><strong>{rootName}</strong> · {files.length} images · {folderPreview.length} part folders</span><button className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => void beginIntake()} disabled={busy}>{busy ? `Uploading ${uploadProgress}%` : 'Upload & identify parts'}</button></div>}</section>
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent image runs</h2><span className="text-xs text-slate-500">{jobs.length} run(s)</span></div><div className="space-y-3">{jobs.map((item) => <button key={item.id} className={`block w-full rounded-xl bg-white p-4 text-left shadow-sm dark:bg-slate-900 ${job?.id === item.id ? 'ring-2 ring-cyan-500' : ''}`} onClick={() => { setJob(item); setSelectedGroup(null); }}><div className="flex items-center justify-between gap-3"><span className="font-medium">{item.sourceRootName}</span><span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs font-semibold capitalize text-cyan-700">{statusLabel(item.status)}</span></div><p className="mt-2 text-xs text-slate-500">{item.groupedParts} distinct part(s) · {item.totalFolders} source folder(s) · {item.totalImages} image(s){item.aiCostUsd !== undefined ? ` · $${item.aiCostUsd.toFixed(4)} AI` : ''}</p></button>)}{!jobs.length && <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No image intake runs yet.</p>}</div></section>
      <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Detection results</h2>{job && <p className="mt-1 text-xs text-slate-500">{job.sourceRootName} · {job.processedFolders}/{job.totalFolders} folders processed</p>}</div>{job && <button className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => void downloadExport()}><Download size={15} /> Export Excel</button>}</div>{job && <div className="mt-4"><div className="flex justify-between text-xs text-slate-500"><span>{job.status === 'processing' ? 'AI identification in progress' : 'Run progress'}</span><span>{progress}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-2 rounded-full bg-cyan-600 transition-all" style={{ width: `${progress}%` }} /></div></div>}<div className="mt-4 max-h-[520px] space-y-2 overflow-auto">{groups.map((group) => <button key={group.id} className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:border-cyan-400 dark:border-slate-700" onClick={() => void inspectGroup(group)}><div className="flex items-center justify-between gap-2"><span className="font-medium">{group.basePartName}</span><span className="text-xs capitalize text-slate-500">{statusLabel(group.detectionStatus)}</span></div><p className="mt-1 text-xs text-slate-500">{group.instanceCount} instance(s) · {group.detected.title || 'Identification pending'}{group.confidence !== null ? ` · ${Math.round(group.confidence * 100)}% confidence` : ''}</p>{group.detected.categoryName && <p className="mt-1 text-xs text-cyan-700">{group.detected.categoryName}</p>}</button>)}{job && !groups.length && <p className="text-sm text-slate-500">Groups will appear after the upload is accepted.</p>}</div></section></div>
    {selectedGroup && <div className="mt-4 grid gap-3 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 sm:grid-cols-2 dark:bg-cyan-950/20"><label className="text-sm">eBay condition<select required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:bg-slate-800" value={conditionId} onChange={(event) => { setConditionId(event.target.value); setConditionLabel(event.target.options[event.target.selectedIndex]?.text || conditionLabel); }}><option value="">Confirm later in listing editor</option><option value="1000">New</option><option value="1500">New other / open box</option><option value="2500">Seller refurbished</option><option value="3000">Used</option><option value="7000">For parts or not working</option></select></label><label className="text-sm">Condition description<input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:bg-slate-800" value={conditionLabel} onChange={(event) => setConditionLabel(event.target.value)} /></label></div>}
    {selectedGroup && <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-cyan-600">Review group</p><h2 className="text-2xl font-semibold">{selectedGroup.basePartName}</h2><p className="mt-1 text-sm text-slate-500">{selectedGroup.rawFolderNames.join(', ')} · quantity {selectedGroup.instanceCount}</p></div><button className="text-sm text-slate-500" onClick={() => setSelectedGroup(null)}>Close</button></div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><div><div className="grid grid-cols-3 gap-2">{selectedGroup.assets.map((asset) => <img key={asset.id} src={asset.cdnUrl} alt={asset.filename} className="aspect-square rounded-lg object-cover" />)}</div><p className="mt-3 text-xs text-slate-500">AI results are evidence-based suggestions. Verify labels, part numbers, specifications, condition, price, and included items against the photos.</p></div><div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Title<input className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="text-sm">B&amp;I category family<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:bg-slate-800" value={categoryFamily} onChange={(event) => setCategoryFamily(event.target.value)}><option value="">Choose family</option>{CATEGORY_FAMILIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Price estimate<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="text-sm">Quantity<input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label></div><div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><p><strong>Detected:</strong> {[selectedGroup.detected.brand, selectedGroup.detected.model, selectedGroup.detected.mpn, selectedGroup.detected.partType, selectedGroup.detected.conditionLabel].filter(Boolean).join(' · ') || 'No high-confidence text identification'}</p><p className="mt-2"><strong>eBay category:</strong> {selectedGroup.detected.categoryName || 'Manual category selection required'}</p>{selectedGroup.detected.warnings.length > 0 && <p className="mt-2 text-amber-700"><strong>Review notes:</strong> {selectedGroup.detected.warnings.join(' ')}</p>}</div><button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void createDraft()} disabled={busy || !categoryFamily}>{busy ? <Loader2 className="mr-2 inline animate-spin" size={15} /> : <CheckCircle2 className="mr-2 inline" size={15} />}Create B&amp;I draft</button></div></div></section>}
  </div>;
}
