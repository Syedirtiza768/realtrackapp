/* ─── AI Upload Wizard ─────────────────────────────────────
 *  Full drag-drop image upload → AI pipeline → listing preview.
 *  Steps: Upload → Analyzing → Review → Listing Ready
 * ────────────────────────────────────────────────────────── */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, X, Check, AlertTriangle, Loader2,
  ChevronRight, Eye, Sparkles, ArrowLeft, Camera, Zap, FileCheck,
  Shield, Car, Package, Edit3,
} from 'lucide-react';
import type {
  PipelineProgress,
  PipelineStage,
  MotorsProduct,
  FitmentRow,
} from '../../types/motors';
import {
  useRequestImageUpload,
  useConfirmImageUpload,
  uploadFileToS3,
  subscribePipelineProgress,
  useMotorsProduct,
} from '../../lib/motorsApi';

/* ── Types ────────────────────────────────────────────────── */

type WizardStep = 'upload' | 'uploading' | 'analyzing' | 'results';

interface UploadFileState {
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

/* ── Stage icon + color config ────────────────────────────── */

const STAGE_CONFIG: Record<string, { icon: typeof Sparkles; color: string; activeColor: string }> = {
  upload:     { icon: Upload,    color: 'text-gray-400', activeColor: 'text-blue-500' },
  extraction: { icon: Eye,       color: 'text-gray-400', activeColor: 'text-purple-500' },
  identity:   { icon: Package,   color: 'text-gray-400', activeColor: 'text-indigo-500' },
  fitment:    { icon: Car,       color: 'text-gray-400', activeColor: 'text-teal-500' },
  listing:    { icon: Edit3,     color: 'text-gray-400', activeColor: 'text-orange-500' },
  compliance: { icon: Shield,    color: 'text-gray-400', activeColor: 'text-green-500' },
  complete:   { icon: Check,     color: 'text-gray-400', activeColor: 'text-emerald-500' },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function AIUploadWizard() {
  const navigate = useNavigate();

  /* ── Step state ──────────────────────────────────────────── */
  const [step, setStep] = useState<WizardStep>('upload');
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [motorsProductId, setMotorsProductId] = useState<string | null>(null);
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Optional metadata ───────────────────────────────────── */
  const [brand, setBrand] = useState('');
  const [mpn, setMpn] = useState('');
  const [productType, setProductType] = useState('');
  const [condition, setCondition] = useState('New');
  const [showMetadata, setShowMetadata] = useState(false);

  /* ── Mutations ───────────────────────────────────────────── */
  const requestUpload = useRequestImageUpload();
  const confirmUpload = useConfirmImageUpload();

  /* ── Product data (loads after pipeline completes) ─────── */
  const { data: product, refetch: refetchProduct } = useMotorsProduct(motorsProductId);

  /* ── Drag & Drop handlers ────────────────────────────────── */
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addFiles(dropped);
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const accepted = newFiles.filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 20 * 1024 * 1024,
    );
    setFiles(prev => [
      ...prev,
      ...accepted.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'pending' as const,
      })),
    ]);
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[idx].preview);
      updated.splice(idx, 1);
      return updated;
    });
  }, []);

  /* ── Upload Flow ─────────────────────────────────────────── */
  const startUpload = async () => {
    if (files.length === 0) return;
    setStep('uploading');
    setError(null);

    try {
      // Step 1: Request presigned URLs from backend
      const uploadReq = await requestUpload.mutateAsync({
        files: files.map(f => ({
          fileName: f.file.name,
          mimeType: f.file.type,
          fileSize: f.file.size,
        })),
        brand: brand || undefined,
        mpn: mpn || undefined,
        productType: productType || undefined,
        condition: condition || undefined,
        autoRunPipeline: true,
      });

      setMotorsProductId(uploadReq.motorsProductId);

      // Step 2: Upload all files to S3 in parallel
      const uploadResults = await Promise.allSettled(
        uploadReq.uploadUrls.map(async (urlInfo: { uploadUrl: string; key: string; fileName: string }, idx: number) => {
          setFiles(prev => {
            const updated = [...prev];
            if (updated[idx]) updated[idx] = { ...updated[idx], status: 'uploading' };
            return updated;
          });

          await uploadFileToS3(urlInfo.uploadUrl, files[idx].file, (pct) => {
            setFiles(prev => {
              const updated = [...prev];
              if (updated[idx]) updated[idx] = { ...updated[idx], progress: pct };
              return updated;
            });
          });

          setFiles(prev => {
            const updated = [...prev];
            if (updated[idx]) updated[idx] = { ...updated[idx], status: 'done', progress: 100 };
            return updated;
          });

          return urlInfo.key;
        }),
      );

      // Collect successful keys
      const successKeys = uploadResults
        .filter((r: PromiseSettledResult<string>): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map((r: PromiseFulfilledResult<string>) => r.value);

      // Mark failed uploads
      uploadResults.forEach((r: PromiseSettledResult<string>, idx: number) => {
        if (r.status === 'rejected') {
          setFiles(prev => {
            const updated = [...prev];
            if (updated[idx]) updated[idx] = { ...updated[idx], status: 'error', error: 'Upload failed' };
            return updated;
          });
        }
      });

      if (successKeys.length === 0) {
        setError('All image uploads failed');
        setStep('upload');
        return;
      }

      // Step 3: Confirm upload and trigger pipeline
      await confirmUpload.mutateAsync({
        motorsProductId: uploadReq.motorsProductId,
        data: { uploadedKeys: successKeys, autoRunPipeline: true },
      });

      // Step 4: Switch to analyzing step and subscribe to SSE
      setStep('analyzing');
      subscribeToProgress(uploadReq.motorsProductId);

    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setStep('upload');
    }
  };

  /* ── SSE Progress Subscription ───────────────────────────── */
  const subscribeToProgress = (productId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    eventSourceRef.current = subscribePipelineProgress(
      productId,
      (progress) => {
        setPipelineProgress(progress);
        if (progress.done) {
          setStep('results');
          refetchProduct();
        }
      },
      () => {
        // On error, try polling the product directly
        setTimeout(() => refetchProduct(), 2000);
        setStep('results');
      },
      () => {
        refetchProduct();
      },
    );
  };

  /* ── Cleanup ──────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      files.forEach(f => URL.revokeObjectURL(f.preview));
    };
  }, []);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/motors')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h1 className="text-lg font-semibold text-gray-900">
              AI Listing Engine
            </h1>
          </div>

          {/* Step indicator */}
          <div className="ml-auto flex items-center gap-2">
            {(['upload', 'uploading', 'analyzing', 'results'] as WizardStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  step === s ? 'bg-purple-600 ring-2 ring-purple-200' :
                  (['upload', 'uploading', 'analyzing', 'results'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-300')
                }`} />
                {i < 3 && <ChevronRight className="w-3 h-3 text-gray-300" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto py-8 px-6">
        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'upload' && (
          <UploadStep
            files={files}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
            fileInputRef={fileInputRef}
            brand={brand}
            setBrand={setBrand}
            mpn={mpn}
            setMpn={setMpn}
            productType={productType}
            setProductType={setProductType}
            condition={condition}
            setCondition={setCondition}
            showMetadata={showMetadata}
            setShowMetadata={setShowMetadata}
            onStart={startUpload}
          />
        )}

        {step === 'uploading' && (
          <UploadingStep files={files} />
        )}

        {step === 'analyzing' && (
          <AnalyzingStep progress={pipelineProgress} />
        )}

        {step === 'results' && (
          <ResultsStep
            product={product ?? null}
            progress={pipelineProgress}
            onViewProduct={() => motorsProductId && navigate(`/motors/${motorsProductId}`)}
            onStartOver={() => {
              setStep('upload');
              setFiles([]);
              setMotorsProductId(null);
              setPipelineProgress(null);
              setError(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  STEP COMPONENTS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ── Upload Step ──────────────────────────────────────────── */

function UploadStep({
  files, isDragging, onDragOver, onDragLeave, onDrop, onAddFiles,
  onRemoveFile, fileInputRef, brand, setBrand, mpn, setMpn,
  productType, setProductType, condition, setCondition,
  showMetadata, setShowMetadata, onStart,
}: {
  files: UploadFileState[];
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (idx: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  brand: string; setBrand: (v: string) => void;
  mpn: string; setMpn: (v: string) => void;
  productType: string; setProductType: (v: string) => void;
  condition: string; setCondition: (v: string) => void;
  showMetadata: boolean; setShowMetadata: (v: boolean) => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Hero prompt */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by OpenAI Vision + eBay Motors API
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Drop your product images
        </h2>
        <p className="text-gray-500 max-w-lg mx-auto">
          Our AI will analyze part numbers, brand, fitment data, and generate
          a ready-to-publish eBay Motors listing in seconds.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => (fileInputRef as React.RefObject<HTMLInputElement>).current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-purple-500 bg-purple-50 scale-[1.01]'
            : 'border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50/30'
          }`}
      >
        <input
          ref={fileInputRef as React.LegacyRef<HTMLInputElement>}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAddFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <div className="space-y-3">
          <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center transition-colors
            ${isDragging ? 'bg-purple-100' : 'bg-gray-100'}`}>
            <Camera className={`w-7 h-7 ${isDragging ? 'text-purple-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drag & drop product images here
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPEG, PNG, WebP up to 20MB each • Multiple images supported
            </p>
          </div>
        </div>
      </div>

      {/* Image previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {files.map((f, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border bg-white">
              <img src={f.preview} alt={f.file.name} className="w-full h-32 object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <div className="px-2 py-1.5 border-t">
                <p className="text-[11px] text-gray-500 truncate">{f.file.name}</p>
                <p className="text-[10px] text-gray-400">{(f.file.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
          ))}

          {/* Add more button */}
          <button
            onClick={() => (fileInputRef as React.RefObject<HTMLInputElement>).current?.click()}
            className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50/30 transition-colors"
          >
            <Upload className="w-5 h-5 text-gray-400 mb-1" />
            <span className="text-xs text-gray-400">Add more</span>
          </button>
        </div>
      )}

      {/* Optional metadata */}
      <div className="bg-white rounded-lg border">
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          <span className="font-medium">Optional: Pre-fill known details</span>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showMetadata ? 'rotate-90' : ''}`} />
        </button>
        {showMetadata && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
              <input
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="e.g. Dorman, ACDelco"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Part Number (MPN)</label>
              <input
                value={mpn}
                onChange={e => setMpn(e.target.value)}
                placeholder="e.g. 675-237"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product Type</label>
              <input
                value={productType}
                onChange={e => setProductType(e.target.value)}
                placeholder="e.g. Brake Caliper"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              >
                <option>New</option>
                <option>Remanufactured</option>
                <option>Used</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Start button */}
      <div className="flex justify-end">
        <button
          onClick={onStart}
          disabled={files.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium text-sm
            hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Zap className="w-4 h-4" />
          Analyze {files.length} Image{files.length !== 1 ? 's' : ''} with AI
        </button>
      </div>
    </div>
  );
}

/* ── Uploading Step ───────────────────────────────────────── */

function UploadingStep({ files }: { files: UploadFileState[] }) {
  const total = files.length;
  const done = files.filter(f => f.status === 'done').length;
  const overallPct = total > 0 ? Math.round(files.reduce((s, f) => s + f.progress, 0) / total) : 0;

  return (
    <div className="max-w-lg mx-auto space-y-6 py-12">
      <div className="text-center space-y-2">
        <Loader2 className="w-10 h-10 text-purple-500 mx-auto animate-spin" />
        <h2 className="text-xl font-semibold text-gray-900">Uploading images…</h2>
        <p className="text-sm text-gray-500">{done} of {total} files uploaded ({overallPct}%)</p>
      </div>

      {/* Overall progress bar */}
      <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-purple-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      {/* Per-file progress */}
      <div className="space-y-2">
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-3 bg-white rounded-lg border px-3 py-2">
            <img src={f.preview} alt="" className="w-8 h-8 rounded object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 truncate">{f.file.name}</p>
              <div className="mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    f.status === 'error' ? 'bg-red-500' : f.status === 'done' ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${f.progress}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-400 w-10 text-right">
              {f.status === 'done' ? <Check className="w-4 h-4 text-green-500 inline" /> : `${f.progress}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Analyzing Step ───────────────────────────────────────── */

function AnalyzingStep({ progress }: { progress: PipelineProgress | null }) {
  const stages = progress?.stages ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          AI Pipeline Running
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          Analyzing your product images…
        </h2>
        <p className="text-sm text-gray-500">
          Our AI is extracting product data, matching to catalog, and generating your listing.
        </p>
      </div>

      {/* Pipeline stages */}
      <div className="bg-white rounded-xl border shadow-sm divide-y">
        {(stages.length > 0 ? stages : getDefaultStages()).map((stage) => {
          const config = STAGE_CONFIG[stage.stage] || STAGE_CONFIG.extraction;
          const Icon = config.icon;
          const isRunning = stage.status === 'running';
          const isComplete = stage.status === 'completed';
          const isFailed = stage.status === 'failed';

          return (
            <div
              key={stage.stage}
              className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                isRunning ? 'bg-purple-50/50' : ''
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                isComplete ? 'bg-green-100' :
                isRunning ? 'bg-purple-100' :
                isFailed ? 'bg-red-100' :
                'bg-gray-100'
              }`}>
                {isRunning ? (
                  <Loader2 className="w-4.5 h-4.5 text-purple-600 animate-spin" />
                ) : isComplete ? (
                  <Check className="w-4.5 h-4.5 text-green-600" />
                ) : isFailed ? (
                  <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
                ) : (
                  <Icon className={`w-4.5 h-4.5 ${config.color}`} />
                )}
              </div>

              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  isComplete ? 'text-green-700' :
                  isRunning ? 'text-purple-700' :
                  isFailed ? 'text-red-700' :
                  'text-gray-500'
                }`}>
                  {stage.label}
                </p>
                {stage.error && (
                  <p className="text-xs text-red-500 mt-0.5">{stage.error}</p>
                )}
              </div>

              {isRunning && (
                <span className="text-xs text-purple-500 font-medium">Processing…</span>
              )}
              {isComplete && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Confidence scores (appear as they come in) */}
      {progress?.confidence && (
        <div className="grid grid-cols-4 gap-3">
          {([
            { key: 'identity' as const, label: 'Identity', color: 'indigo' },
            { key: 'fitment' as const, label: 'Fitment', color: 'teal' },
            { key: 'compliance' as const, label: 'Compliance', color: 'green' },
            { key: 'content' as const, label: 'Content', color: 'orange' },
          ]).map(({ key, label }) => {
            const val = progress.confidence[key];
            if (val === null) return (
              <div key={key} className="bg-white rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase text-gray-400 font-medium">{label}</p>
                <p className="text-lg font-bold text-gray-300 mt-1">—</p>
              </div>
            );
            return (
              <div key={key} className="bg-white rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase text-gray-400 font-medium">{label}</p>
                <p className={`text-lg font-bold mt-1 ${
                  val >= 0.8 ? 'text-green-600' : val >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {(val * 100).toFixed(0)}%
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Results Step ─────────────────────────────────────────── */

function ResultsStep({
  product,
  progress,
  onViewProduct,
  onStartOver,
}: {
  product: MotorsProduct | null;
  progress: PipelineProgress | null;
  onViewProduct: () => void;
  onStartOver: () => void;
}) {
  const isSuccess = progress?.overallStatus === 'approved' || progress?.overallStatus === 'published';
  const isReview = progress?.overallStatus === 'review_required';
  const isFailed = progress?.overallStatus === 'failed';

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      {/* Status banner */}
      <div className={`rounded-xl border p-6 text-center space-y-2 ${
        isSuccess ? 'bg-green-50 border-green-200' :
        isReview ? 'bg-amber-50 border-amber-200' :
        isFailed ? 'bg-red-50 border-red-200' :
        'bg-blue-50 border-blue-200'
      }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
          isSuccess ? 'bg-green-100' :
          isReview ? 'bg-amber-100' :
          isFailed ? 'bg-red-100' :
          'bg-blue-100'
        }`}>
          {isSuccess ? <Check className="w-6 h-6 text-green-600" /> :
           isReview ? <Eye className="w-6 h-6 text-amber-600" /> :
           isFailed ? <AlertTriangle className="w-6 h-6 text-red-600" /> :
           <FileCheck className="w-6 h-6 text-blue-600" />}
        </div>
        <h2 className={`text-lg font-semibold ${
          isSuccess ? 'text-green-800' :
          isReview ? 'text-amber-800' :
          isFailed ? 'text-red-800' :
          'text-blue-800'
        }`}>
          {isSuccess ? 'Listing Ready to Publish!' :
           isReview ? 'Review Required' :
           isFailed ? 'Pipeline Failed' :
           'Processing Complete'}
        </h2>
        <p className={`text-sm ${
          isSuccess ? 'text-green-600' :
          isReview ? 'text-amber-600' :
          isFailed ? 'text-red-600' :
          'text-blue-600'
        }`}>
          {isSuccess ? 'Your AI-generated listing is ready. Review and publish with one click.' :
           isReview ? 'Some items need human attention before publishing.' :
           isFailed ? 'The pipeline encountered errors. You can retry or edit manually.' :
           'Pipeline completed. Review the results below.'}
        </p>
      </div>

      {/* Product summary card */}
      {product && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              {product.imageUrls?.[0] && (
                <img src={product.imageUrls[0]} alt="" className="w-12 h-12 rounded object-cover border" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {product.generatedTitle || `${product.brand || ''} ${product.mpn || ''} ${product.productType || ''}`.trim() || 'Untitled Product'}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  {product.brand && (
                    <span className="text-xs text-gray-500">Brand: <span className="font-medium text-gray-700">{product.brand}</span></span>
                  )}
                  {product.mpn && (
                    <span className="text-xs text-gray-500">MPN: <span className="font-medium text-gray-700">{product.mpn}</span></span>
                  )}
                  {product.productType && (
                    <span className="text-xs text-gray-500">Type: <span className="font-medium text-gray-700">{product.productType}</span></span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Confidence scores */}
          <div className="grid grid-cols-4 gap-px bg-gray-100">
            {([
              { label: 'Identity', value: product.identityConfidence, color: 'indigo' },
              { label: 'Fitment', value: product.fitmentConfidence, color: 'teal' },
              { label: 'Compliance', value: product.complianceScore, color: 'green' },
              { label: 'Content', value: product.contentQualityScore, color: 'orange' },
            ]).map(({ label, value }) => (
              <div key={label} className="bg-white px-4 py-3 text-center">
                <p className="text-[10px] uppercase text-gray-400 font-medium tracking-wider">{label}</p>
                <p className={`text-xl font-bold mt-1 ${
                  value != null && value >= 0.8 ? 'text-green-600' :
                  value != null && value >= 0.5 ? 'text-yellow-600' :
                  value != null ? 'text-red-600' :
                  'text-gray-300'
                }`}>
                  {value != null ? `${(Number(value) * 100).toFixed(0)}%` : '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Generated listing preview */}
          {product.generatedTitle && (
            <div className="px-5 py-4 border-t space-y-3">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                AI-Generated Listing
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-gray-900">{product.generatedTitle}</p>
                {product.generatedBulletFeatures?.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5">
                    {product.generatedBulletFeatures.slice(0, 4).map((f: string, i: number) => (
                      <li key={i} className="text-xs text-gray-600">{f}</li>
                    ))}
                  </ul>
                )}
                {product.generatedItemSpecifics && Object.keys(product.generatedItemSpecifics).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(product.generatedItemSpecifics).slice(0, 6).map(([k, v]) => (
                      <span key={k} className="inline-flex text-[10px] bg-white border rounded px-2 py-0.5 text-gray-600">
                        <span className="font-medium text-gray-800">{k}:</span>&nbsp;{String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fitment preview */}
          {product.fitmentRows && product.fitmentRows.length > 0 && (
            <div className="px-5 py-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <Car className="w-3.5 h-3.5 text-teal-500" />
                Vehicle Compatibility ({product.fitmentRows.length} vehicles)
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-100 text-gray-500">
                      <th className="px-3 py-1.5 text-left font-medium">Year</th>
                      <th className="px-3 py-1.5 text-left font-medium">Make</th>
                      <th className="px-3 py-1.5 text-left font-medium">Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.fitmentRows.slice(0, 5).map((row: FitmentRow, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5 text-gray-700">{row.year}</td>
                        <td className="px-3 py-1.5 text-gray-700">{row.make}</td>
                        <td className="px-3 py-1.5 text-gray-700">{row.model}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {product.fitmentRows.length > 5 && (
                  <p className="text-center text-[10px] text-gray-400 py-1.5">
                    +{product.fitmentRows.length - 5} more vehicles
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={onStartOver}
          className="px-4 py-2.5 text-sm text-gray-700 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          Upload Another
        </button>
        <button
          onClick={onViewProduct}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium text-sm
            hover:bg-purple-700 transition-colors shadow-sm"
        >
          View Full Details
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function getDefaultStages(): PipelineStage[] {
  return [
    { stage: 'upload', label: 'Upload Complete', status: 'completed' },
    { stage: 'extraction', label: 'AI Vision Analysis', status: 'running' },
    { stage: 'identity', label: 'Product Identification', status: 'pending' },
    { stage: 'fitment', label: 'Fitment Resolution', status: 'pending' },
    { stage: 'listing', label: 'Listing Generation', status: 'pending' },
    { stage: 'compliance', label: 'Compliance Check', status: 'pending' },
    { stage: 'complete', label: 'Ready to Publish', status: 'pending' },
  ];
}
