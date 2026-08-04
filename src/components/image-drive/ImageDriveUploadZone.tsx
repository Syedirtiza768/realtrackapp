import { useState, useCallback, useRef } from 'react';
import { Upload, X, Check, AlertCircle, ImagePlus, Loader2 } from 'lucide-react';
import { uploadToDrive } from '../../lib/imageDriveApi';
import OptimizedImage from '../ui/OptimizedImage';

interface FileState {
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface ImageDriveUploadZoneProps {
  partNumber: string;
  onUploadComplete?: (count: number) => void;
  maxImages?: number;
}

export default function ImageDriveUploadZone({
  partNumber,
  onUploadComplete,
  maxImages = 24,
}: ImageDriveUploadZoneProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const incoming = Array.from(newFiles).slice(0, maxImages - files.length);
      if (incoming.length === 0) return;

      const states: FileState[] = incoming.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'pending' as const,
      }));

      setFiles((prev) => [...prev, ...states]);
    },
    [files.length, maxImages],
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (!partNumber.trim() || files.length === 0 || isUploading) return;

    setIsUploading(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' as const, progress: 0 })));

    try {
      const result = await uploadToDrive(
        partNumber,
        files.map((f) => f.file),
        (_idx, pct) => {
          setFiles((prev) => prev.map((f) => ({ ...f, progress: pct })));
        },
      );

      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'done' as const,
          progress: 100,
        })),
      );

      onUploadComplete?.(result.recorded);

      setTimeout(() => {
        setFiles([]);
        onUploadComplete?.(0);
      }, 2000);
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'error' as const,
          error: err instanceof Error ? err.message : 'Upload failed',
        })),
      );
    } finally {
      setIsUploading(false);
    }
  }, [partNumber, files, isUploading, onUploadComplete]);

  return (
    <div className="space-y-3">
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <ImagePlus className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Drop images here or click to browse
        </p>
        <p className="text-xs text-slate-400 mt-1">All image formats accepted</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
            {!isUploading && (
              <button
                onClick={() => {
                  files.forEach((f) => URL.revokeObjectURL(f.preview));
                  setFiles([]);
                }}
                className="text-xs text-slate-400 hover:text-red-400"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {files.map((f, i) => (
              <div
                key={i}
                className="relative group rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-square"
              >
                <OptimizedImage
                  src={f.preview}
                  alt=""
                  variant="thumb"
                  aspectRatio="1/1"
                  className="w-full h-full"
                />
                {f.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
                {f.status === 'done' && (
                  <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                )}
                {f.status === 'error' && (
                  <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                )}
                {f.status === 'pending' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {files.some((f) => f.status === 'error') && (
            <p className="text-xs text-red-400">
              {files.find((f) => f.status === 'error')?.error}
            </p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || !partNumber.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading
              ? 'Uploading...'
              : `Upload ${files.length} image${files.length !== 1 ? 's' : ''} to Image Drive`}
          </button>
        </div>
      )}
    </div>
  );
}
