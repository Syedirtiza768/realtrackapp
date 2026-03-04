import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

interface CsvUploaderProps {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  progress: number;
  error: string | null;
  uploaded: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function CsvUploader({
  onFileSelected,
  uploading,
  progress,
  error,
  uploaded,
}: CsvUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setValidationError(null);

      // Validate file type
      if (
        !file.name.toLowerCase().endsWith('.csv') &&
        file.type !== 'text/csv'
      ) {
        setValidationError('Only CSV files are supported. Please select a .csv file.');
        return;
      }

      // Validate file size (100 MB max)
      if (file.size > 100 * 1024 * 1024) {
        setValidationError('File too large. Maximum file size is 100 MB.');
        return;
      }

      // Validate non-empty
      if (file.size === 0) {
        setValidationError('The selected file is empty.');
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-400" />
          Upload CSV Catalog File
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8
            transition-all cursor-pointer
            ${
              dragOver
                ? 'border-blue-400 bg-blue-400/10'
                : uploaded
                  ? 'border-emerald-500/50 bg-emerald-900/10'
                  : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
            }
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleChange}
            className="hidden"
            disabled={uploading}
          />

          {!selectedFile && !uploaded && (
            <>
              <Upload className="h-10 w-10 text-slate-400 mb-3" />
              <p className="text-slate-300 text-sm font-medium">
                Drag & drop a CSV file here, or click to browse
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Supports .csv files up to 100 MB (50,000+ rows)
              </p>
            </>
          )}

          {selectedFile && !uploaded && (
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-slate-200 text-sm font-medium">{selectedFile.name}</p>
                <p className="text-slate-400 text-xs">{formatBytes(selectedFile.size)}</p>
              </div>
              {!uploading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="ml-2 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {uploaded && selectedFile && (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-emerald-300 text-sm font-medium">
                  {selectedFile.name} uploaded successfully
                </p>
                <p className="text-slate-400 text-xs">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Upload progress bar */}
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Validation error */}
        {(validationError || error) && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/50">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-400 text-sm">{validationError || error}</p>
          </div>
        )}

        {/* Supported formats */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 text-xs">Supported:</span>
          <Badge variant="secondary">.csv</Badge>
          <Badge variant="secondary">eBay File Exchange</Badge>
          <Badge variant="secondary">Custom CSV</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
