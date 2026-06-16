/* ─── ImageUploadZone ──────────────────────────────────────
 *  Drag-and-drop + file picker for uploading multiple images.
 *  Auto-uploads on selection using presigned S3 URLs.
 *  Reports completed uploads (CDN URLs + asset IDs) to parent.
 * ────────────────────────────────────────────────────────── */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, Check, AlertCircle, ImagePlus, Loader2 } from 'lucide-react';
import { uploadImages, type UploadedImage } from '../../lib/storageApi';

/* ── Types ────────────────────────────────────────────────── */

interface FileState {
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export interface ImageUploadZoneProps {
  /** Called whenever the set of successfully uploaded images changes. */
  onImagesChange: (images: UploadedImage[]) => void;
  /** Max number of images allowed. Default 12 (eBay limit). */
  maxImages?: number;
}

/* ── Constants ────────────────────────────────────────────── */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/* ── Component ────────────────────────────────────────────── */

export default function ImageUploadZone({
  onImagesChange,
  maxImages = 12,
}: ImageUploadZoneProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImagesRef = useRef<UploadedImage[]>([]);

  // Notify parent whenever uploaded images change
  const notifyParent = useCallback(
    (images: UploadedImage[]) => {
      uploadedImagesRef.current = images;
      onImagesChange(images);
    },
    [onImagesChange],
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on unmount
  }, []);

  /* ── File validation ─────────────────────────────────────── */

  const validateFiles = useCallback(
    (inputFiles: File[]): File[] => {
      const remaining = maxImages - files.length;
      if (remaining <= 0) return [];

      return inputFiles
        .filter((f) => {
          if (!ACCEPTED_TYPES.includes(f.type)) return false;
          if (f.size > MAX_FILE_SIZE) return false;
          return true;
        })
        .slice(0, remaining);
    },
    [files.length, maxImages],
  );

  /* ── Add files and auto-upload ────────────────────────────── */

  const addFiles = useCallback(
    async (inputFiles: File[]) => {
      const valid = validateFiles(inputFiles);
      if (valid.length === 0) return;

      const newFileStates: FileState[] = valid.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'pending',
      }));

      // Append to state
      const startIndex = files.length;
      setFiles((prev) => [...prev, ...newFileStates]);
      setIsUploading(true);

      // Upload the new batch
      const results = await uploadImages(
        valid,
        // onFileProgress
        (idx, pct) => {
          const fileIdx = startIndex + idx;
          setFiles((prev) => {
            const updated = [...prev];
            if (updated[fileIdx]) {
              updated[fileIdx] = { ...updated[fileIdx], progress: pct, status: 'uploading' };
            }
            return updated;
          });
        },
        // onFileComplete
        (idx) => {
          const fileIdx = startIndex + idx;
          setFiles((prev) => {
            const updated = [...prev];
            if (updated[fileIdx]) {
              updated[fileIdx] = { ...updated[fileIdx], status: 'done', progress: 100 };
            }
            return updated;
          });
        },
        // onFileError
        (idx, error) => {
          const fileIdx = startIndex + idx;
          setFiles((prev) => {
            const updated = [...prev];
            if (updated[fileIdx]) {
              updated[fileIdx] = { ...updated[fileIdx], status: 'error', error };
            }
            return updated;
          });
        },
      );

      // Collect successful uploads and notify parent
      if (results.length > 0) {
        notifyParent([...uploadedImagesRef.current, ...results]);
      }

      setIsUploading(false);
    },
    [files.length, validateFiles, notifyParent],
  );

  /* ── Remove file ─────────────────────────────────────────── */

  const removeFile = useCallback(
    (idx: number) => {
      setFiles((prev) => {
        const updated = [...prev];
        URL.revokeObjectURL(updated[idx].preview);

        // Track whether this was a successfully uploaded image
        const wasUploaded = updated[idx].status === 'done';
        updated.splice(idx, 1);

        if (wasUploaded) {
          // Rebuild the uploaded images list from remaining done files
          const remaining: UploadedImage[] = [];
          let uploadIdx = 0;
          for (let i = 0; i < updated.length; i++) {
            if (updated[i].status === 'done') {
              // Match by order with the original uploadedImages array
              const existing = uploadedImagesRef.current[uploadIdx];
              if (existing) remaining.push(existing);
            }
            if (updated[i].status === 'done' || updated[i].status === 'error') {
              uploadIdx++;
            }
          }
          notifyParent(remaining);
        }

        return updated;
      });
    },
    [notifyParent],
  );

  /* ── Drag handlers ───────────────────────────────────────── */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED_TYPES.includes(f.type),
      );
      addFiles(dropped);
    },
    [addFiles],
  );

  /* ── File input change ───────────────────────────────────── */

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(Array.from(e.target.files));
        e.target.value = '';
      }
    },
    [addFiles],
  );

  const canAddMore = files.length < maxImages;
  const doneCount = files.filter((f) => f.status === 'done').length;
  const hasUploading = files.some((f) => f.status === 'uploading' || f.status === 'pending');

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-500/5'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
                ${isDragging ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-700'}`}
            >
              <ImagePlus
                className={`w-5 h-5 ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Drag & drop images here, or click to browse
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                JPEG, PNG, WebP up to 20MB each &middot; {files.length}/{maxImages} images
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Image previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {files.map((f, i) => (
            <div
              key={`${f.file.name}-${i}`}
              className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <img
                src={f.preview}
                alt={f.file.name}
                className="w-full h-24 object-cover"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="absolute top-1 right-1 bg-white/90 dark:bg-slate-800/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              </button>

              {/* Status indicator */}
              {f.status === 'uploading' && (
                <div className="absolute inset-x-0 bottom-0 bg-black/40">
                  <div className="h-1 bg-blue-500 transition-all" style={{ width: `${f.progress}%` }} />
                </div>
              )}
              {f.status === 'done' && (
                <div className="absolute top-1 left-1">
                  <Check className="w-4 h-4 text-green-400 drop-shadow" />
                </div>
              )}
              {f.status === 'error' && (
                <div className="absolute top-1 left-1">
                  <AlertCircle className="w-4 h-4 text-red-400 drop-shadow" />
                </div>
              )}

              {/* File info */}
              <div className="px-1.5 py-1 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {f.file.name}
                </p>
                {f.status === 'uploading' && (
                  <p className="text-[10px] text-blue-500">{f.progress}%</p>
                )}
                {f.status === 'error' && (
                  <p className="text-[10px] text-red-400">{f.error ?? 'Failed'}</p>
                )}
              </div>
            </div>
          ))}

          {/* Add more button */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-400 mb-1" />
              <span className="text-[10px] text-slate-400">Add more</span>
            </button>
          )}
        </div>
      )}

      {/* Status bar */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {isUploading && (
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          )}
          <span>
            {doneCount} of {files.length} uploaded
            {hasUploading && ' — uploading...'}
          </span>
        </div>
      )}
    </div>
  );
}
