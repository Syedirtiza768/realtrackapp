import { useCallback, useState } from 'react';
import {
  Database,
  History,
  BarChart3,
  FileText,
  RefreshCw,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import CsvUploader from './CsvUploader';
import ColumnMapper from './ColumnMapper';
import ImportReport from './ImportReport';
import {
  useUploadCsv,
  startImport,
  cancelImport,
  retryImport,
  useImportList,
  useImportDetail,
  useImportStats,
} from '../../lib/catalogImportApi';
import type {
  CatalogField,
  CatalogImport,
  CatalogImportStatus,
} from '../../types/catalogImport';

type Step = 'upload' | 'mapping' | 'processing' | 'complete';

export default function CatalogImportDashboard() {
  const [step, setStep] = useState<Step>('upload');
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [catalogFields, setCatalogFields] = useState<CatalogField[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const { upload, uploading, progress, error: uploadError, result: uploadResult, reset: resetUpload } = useUploadCsv();
  const { data: importDetail } = useImportDetail(
    step === 'processing' || step === 'complete' ? activeImportId : null,
  );
  const { data: importListData, loading: listLoading, refresh: refreshList } = useImportList();
  const { stats, refresh: refreshStats } = useImportStats();

  /* ── Upload handler ─────────────────────────────────────── */
  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const response = await upload(file);
        if (response) {
          setDetectedHeaders(response.detectedHeaders);
          setColumnMapping(response.columnMapping);
          setCatalogFields(response.catalogFields);
          setActiveImportId(response.import.id);
          setStep('mapping');
        }
      } catch {
        // Error is handled by useUploadCsv
      }
    },
    [upload],
  );

  /* ── Mapping confirmed → start import ───────────────────── */
  const handleConfirmMapping = useCallback(
    async (mapping: Record<string, string>) => {
      if (!activeImportId) return;
      try {
        await startImport(activeImportId, mapping);
        setStep('processing');
      } catch (err) {
        console.error('Failed to start import:', err);
      }
    },
    [activeImportId],
  );

  /* ── Auto-map handler ───────────────────────────────────── */
  const handleAutoMap = useCallback(() => {
    if (uploadResult) {
      setColumnMapping(uploadResult.columnMapping);
    }
  }, [uploadResult]);

  /* ── Start new import ───────────────────────────────────── */
  const handleNewImport = useCallback(() => {
    setStep('upload');
    setActiveImportId(null);
    setDetectedHeaders([]);
    setColumnMapping({});
    setCatalogFields([]);
    resetUpload();
  }, [resetUpload]);

  /* ── Cancel import ──────────────────────────────────────── */
  const handleCancel = useCallback(
    async (id: string) => {
      try {
        await cancelImport(id);
        refreshList();
        refreshStats();
      } catch (err) {
        console.error('Cancel failed:', err);
      }
    },
    [refreshList, refreshStats],
  );

  /* ── Retry import ───────────────────────────────────────── */
  const handleRetry = useCallback(
    async (id: string) => {
      try {
        await retryImport(id);
        setActiveImportId(id);
        setStep('processing');
        refreshList();
      } catch (err) {
        console.error('Retry failed:', err);
      }
    },
    [refreshList],
  );

  // Auto-advance to complete when processing finishes
  if (
    step === 'processing' &&
    importDetail &&
    (importDetail.status === 'completed' || importDetail.status === 'failed')
  ) {
    setStep('complete');
    refreshList();
    refreshStats();
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-400" />
            Catalog Import
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Import CSV catalog files into the master product database
          </p>
        </div>
        {step !== 'upload' && (
          <button
            onClick={handleNewImport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <FileText className="h-4 w-4" />
            New Import
          </button>
        )}
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Catalog Products" value={stats.totalCatalogProducts.toLocaleString()} />
          <MiniStat label="Total Imports" value={stats.totalImports.toLocaleString()} />
          <MiniStat label="Products Inserted" value={stats.totalProductsInserted.toLocaleString()} />
          <MiniStat label="Duplicates Caught" value={stats.totalDuplicatesSkipped.toLocaleString()} />
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <CsvUploader
          onFileSelected={handleFileSelected}
          uploading={uploading}
          progress={progress}
          error={uploadError}
          uploaded={!!uploadResult}
        />
      )}

      {/* Step: Column mapping */}
      {step === 'mapping' && (
        <ColumnMapper
          detectedHeaders={detectedHeaders}
          initialMapping={columnMapping}
          catalogFields={catalogFields}
          onConfirm={handleConfirmMapping}
          onAutoMap={handleAutoMap}
        />
      )}

      {/* Step: Processing / Complete */}
      {(step === 'processing' || step === 'complete') && importDetail && (
        <div className="space-y-4">
          <ImportReport importRecord={importDetail} />

          {step === 'complete' && (
            <div className="flex gap-3">
              <button
                onClick={handleNewImport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500"
              >
                <FileText className="h-4 w-4" />
                Import Another File
              </button>
              {importDetail.status === 'failed' && (
                <button
                  onClick={() => handleRetry(importDetail.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry Import
                </button>
              )}
            </div>
          )}

          {step === 'processing' && importDetail.status === 'processing' && (
            <button
              onClick={() => handleCancel(importDetail.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 text-red-400 text-sm font-medium hover:bg-red-600/30 border border-red-600/50"
            >
              <XCircle className="h-4 w-4" />
              Cancel Import
            </button>
          )}
        </div>
      )}

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowHistory(!showHistory)}
          >
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-400" />
              Import History
              {importListData && (
                <Badge variant="secondary">{importListData.total}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  refreshList();
                  refreshStats();
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <RefreshCw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
              </button>
              {showHistory ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {importListData && importListData.imports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 py-2 px-3 font-medium">File</th>
                      <th className="text-left text-slate-400 py-2 px-3 font-medium">Date</th>
                      <th className="text-center text-slate-400 py-2 px-3 font-medium">Status</th>
                      <th className="text-right text-slate-400 py-2 px-3 font-medium">Rows</th>
                      <th className="text-right text-slate-400 py-2 px-3 font-medium">Inserted</th>
                      <th className="text-right text-slate-400 py-2 px-3 font-medium">Skipped</th>
                      <th className="text-center text-slate-400 py-2 px-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importListData.imports.map((imp) => (
                      <ImportHistoryRow
                        key={imp.id}
                        importRecord={imp}
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        onView={(id) => {
                          setActiveImportId(id);
                          setStep('complete');
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-sm text-center py-6">
                No imports yet. Upload a CSV file to get started.
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/* ── Mini stat component ──────────────────────────────────── */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-200 mt-0.5">{value}</p>
    </div>
  );
}

/* ── History row component ────────────────────────────────── */

function statusBadgeVariant(
  status: CatalogImportStatus,
): 'default' | 'success' | 'destructive' | 'warning' | 'secondary' {
  const map: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'secondary'> = {
    pending: 'secondary',
    validating: 'default',
    processing: 'default',
    completed: 'success',
    failed: 'destructive',
    cancelled: 'secondary',
    paused: 'warning',
  };
  return map[status] ?? 'secondary';
}

function ImportHistoryRow({
  importRecord,
  onRetry,
  onCancel,
  onView,
}: {
  importRecord: CatalogImport;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onView: (id: string) => void;
}) {
  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-800/30">
      <td className="py-2 px-3">
        <button
          onClick={() => onView(importRecord.id)}
          className="text-blue-400 hover:text-blue-300 text-left"
        >
          {importRecord.fileName}
        </button>
      </td>
      <td className="py-2 px-3 text-slate-400">
        {new Date(importRecord.createdAt).toLocaleDateString()}
      </td>
      <td className="py-2 px-3 text-center">
        <Badge variant={statusBadgeVariant(importRecord.status)}>
          {importRecord.status}
        </Badge>
      </td>
      <td className="py-2 px-3 text-right text-slate-300">
        {importRecord.totalRows.toLocaleString()}
      </td>
      <td className="py-2 px-3 text-right text-emerald-400">
        {importRecord.insertedRows.toLocaleString()}
      </td>
      <td className="py-2 px-3 text-right text-amber-400">
        {importRecord.skippedDuplicates.toLocaleString()}
      </td>
      <td className="py-2 px-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {importRecord.status === 'failed' && (
            <button
              onClick={() => onRetry(importRecord.id)}
              className="text-amber-400 hover:text-amber-300 p-1"
              title="Retry"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {(importRecord.status === 'processing' || importRecord.status === 'pending') && (
            <button
              onClick={() => onCancel(importRecord.id)}
              className="text-red-400 hover:text-red-300 p-1"
              title="Cancel"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onView(importRecord.id)}
            className="text-slate-400 hover:text-slate-200 p-1"
            title="View details"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
