import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import CsvUploader from './CsvUploader';
import ColumnMapper from './ColumnMapper';
import ImportReport from './ImportReport';
import ImportErrorViewer from './ImportErrorViewer';
import CompliancePanel from './CompliancePanel';
import {
  useUploadCsv,
  startImport,
  cancelImport,
  retryImport,
  clearAllCatalog,
  useImportList,
  useImportDetail,
  useImportStats,
  getCatalogFields,
} from '../../lib/catalogImportApi';
import { showCatalogDestructiveUi } from '../../lib/catalogDestructiveUi';
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
  const {
    data: importListData,
    loading: listLoading,
    error: listError,
    refresh: refreshList,
  } = useImportList();
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useImportStats();

  const [startImportError, setStartImportError] = useState<string | null>(null);

  const [clearCatalogOpen, setClearCatalogOpen] = useState(false);
  const [clearCatalogPhrase, setClearCatalogPhrase] = useState('');
  const [clearCatalogBusy, setClearCatalogBusy] = useState(false);
  const [clearCatalogError, setClearCatalogError] = useState<string | null>(null);

  /* ── When import finishes, leave processing step (must not run in render) ─ */
  useEffect(() => {
    if (step !== 'processing' || !importDetail) return;
    if (importDetail.status !== 'completed' && importDetail.status !== 'failed') return;
    setStep('complete');
    void refreshList();
    void refreshStats();
  }, [step, importDetail, refreshList, refreshStats]);

  /* ── Upload handler ─────────────────────────────────────── */
  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const response = await upload(file);
        if (!response) return;
        const { detectedHeaders: headers, columnMapping: mapping, catalogFields: fields, import: imp } = response;
        setDetectedHeaders(headers);
        setColumnMapping(mapping);
        setCatalogFields(fields);
        setActiveImportId(imp.id);

        // Auto-start if all headers are mapped and the required title field is present
        const mappedValues = Object.values(mapping);
        const hasTitle = mappedValues.includes('title');
        const unmappedHeaders = headers.filter((h) => !mapping[h]);

        if (hasTitle && unmappedHeaders.length === 0) {
          try {
            setStartImportError(null);
            await startImport(imp.id, mapping);
            setStep('processing');
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to start import. Is Redis running?';
            setStartImportError(msg);
            setStep('mapping');
          }
        } else {
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
      setStartImportError(null);
      try {
        await startImport(activeImportId, mapping);
        setStep('processing');
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to start import. Is Redis running?';
        setStartImportError(msg);
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
    setStartImportError(null);
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

  const openClearCatalogModal = useCallback(() => {
    setClearCatalogPhrase('');
    setClearCatalogError(null);
    setClearCatalogOpen(true);
  }, []);

  const closeClearCatalogModal = useCallback(() => {
    if (clearCatalogBusy) return;
    setClearCatalogOpen(false);
    setClearCatalogPhrase('');
    setClearCatalogError(null);
  }, [clearCatalogBusy]);

  const submitClearCatalog = useCallback(async () => {
    const phrase = clearCatalogPhrase.trim();
    if (phrase !== 'DELETE_ALL_CATALOG') {
      setClearCatalogError(
        phrase.length === 0
          ? 'Enter the phrase DELETE_ALL_CATALOG to enable the delete button.'
          : 'Must match exactly: DELETE_ALL_CATALOG (no extra characters).',
      );
      return;
    }
    setClearCatalogBusy(true);
    setClearCatalogError(null);
    try {
      await clearAllCatalog();
      await Promise.all([refreshStats(), refreshList()]);
      handleNewImport();
      setClearCatalogOpen(false);
      setClearCatalogPhrase('');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Clear catalog failed. Check the Network tab or server logs.';
      console.error('Clear catalog failed:', err);
      setClearCatalogError(msg);
    } finally {
      setClearCatalogBusy(false);
    }
  }, [clearCatalogPhrase, refreshStats, refreshList, handleNewImport]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-400" />
            Catalog Import
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Import CSV, .xlsx, or .xls catalog files into the master product database.{' '}
            <Link to="/catalog/motors-filters" className="text-blue-400 hover:underline">
              Browse with Motors ops filters
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showCatalogDestructiveUi && (
            <button
              type="button"
              onClick={openClearCatalogModal}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-800 text-red-300 text-sm hover:bg-red-950/50 transition-colors"
            >
              Clear catalog
            </button>
          )}
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
      </div>

      {(listError || statsError) && (
        <div
          className="rounded-lg border border-amber-800/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          <p className="font-medium text-amber-200">Could not reach the catalog import API</p>
          {listError && <p className="mt-1 text-amber-100/90">Import history: {listError}</p>}
          {statsError && <p className="mt-1 text-amber-100/90">Stats: {statsError}</p>}
          <p className="mt-2 text-xs text-amber-200/80">
            Confirm the backend is up (e.g. port 4191), nginx proxies <span className="font-mono">/api</span> to it,
            and open DevTools → Network on a failed request for details.
          </p>
        </div>
      )}

      {/* Stats bar */}
      {statsLoading && !stats && !statsError && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Loading catalog stats…
        </div>
      )}
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
        <div className="space-y-3">
          {startImportError && (
            <div
              className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {startImportError}
            </div>
          )}
          <ColumnMapper
            detectedHeaders={detectedHeaders}
            initialMapping={columnMapping}
            catalogFields={catalogFields}
            onConfirm={handleConfirmMapping}
            onAutoMap={handleAutoMap}
          />
        </div>
      )}

      {/* Step: Processing / Complete */}
      {(step === 'processing' || step === 'complete') && importDetail && (
        <div className="space-y-4">
          <ImportReport importRecord={importDetail} />

          {/* Show row-level errors and warnings */}
          {(importDetail.status === 'completed' || importDetail.status === 'failed') && (
            <ImportErrorViewer
              importId={importDetail.id}
              totalRows={importDetail.totalRows}
              invalidRows={importDetail.invalidRows}
              flaggedForReview={importDetail.flaggedForReview}
            />
          )}

          {/* eBay compliance validation */}
          {importDetail.status === 'completed' && (
            <CompliancePanel
              importId={importDetail.id}
              productIds={(importDetail as any).productIds ?? []}
              importStatus={importDetail.status}
            />
          )}

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
              <History className="h-5 w-5 text-slate-500 dark:text-slate-400" />
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
                className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-200"
              >
                <RefreshCw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
              </button>
              {showHistory ? (
                <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {listLoading && !importListData && !listError && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading import history…
              </div>
            )}
            {listError && !listLoading && (
              <p className="text-center text-sm text-red-400 py-6">
                Import history could not be loaded (details in the alert above). Use refresh to retry.
              </p>
            )}
            {!listLoading && !listError && importListData && importListData.imports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-500 dark:text-slate-400 py-2 px-3 font-medium">File</th>
                      <th className="text-left text-slate-500 dark:text-slate-400 py-2 px-3 font-medium">Date</th>
                      <th className="text-center text-slate-500 dark:text-slate-400 py-2 px-3 font-medium">Status</th>
                      <th className="text-right text-slate-500 dark:text-slate-400 py-2 px-3 font-medium">Rows</th>
                      <th className="text-right text-slate-500 dark:text-slate-400 py-2 px-3 font-medium">Inserted</th>
                      <th className="text-right text-slate-500 dark:text-slate-400 py-2 px-3 font-medium">Skipped</th>
                      <th className="text-center text-slate-500 dark:text-slate-400 py-2 px-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importListData.imports.map((imp) => (
                      <ImportHistoryRow
                        key={imp.id}
                        importRecord={imp}
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        onView={async (id, status) => {
                          setActiveImportId(id);
                          if (status === 'pending') {
                            setDetectedHeaders(imp.detectedHeaders || []);
                            setColumnMapping(imp.columnMapping || {});
                            try {
                              const { fields } = await getCatalogFields();
                              setCatalogFields(fields);
                            } catch (e) {
                              console.error(e);
                            }
                            setStep('mapping');
                          } else {
                            setStep('complete');
                          }
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {!listLoading && !listError && importListData && importListData.imports.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">
                No imports yet. Upload a CSV or Excel file to get started.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {showCatalogDestructiveUi && clearCatalogOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/85 dark:bg-slate-950/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-catalog-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-4 py-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h2 id="clear-catalog-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Clear entire catalog
                </h2>
              </div>
              <button
                type="button"
                onClick={closeClearCatalogModal}
                disabled={clearCatalogBusy}
                className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:text-slate-200 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4 text-sm text-slate-500 dark:text-slate-300">
              <p>
                This permanently deletes all rows shown on the <strong className="text-slate-600 dark:text-slate-200">Catalog</strong> page
                (<span className="font-mono text-slate-500 dark:text-slate-300">listing_records</span> — Excel uploads, pipeline jobs,
                CSV imports, etc.), plus catalog import history, <span className="font-mono">catalog_products</span>,
                and compliance audit logs for this flow. Motors products are unlinked from catalog SKUs and from any
                generated listing id.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Type <span className="font-mono text-slate-600 dark:text-slate-200">DELETE_ALL_CATALOG</span> to confirm
                </span>
                <input
                  type="text"
                  value={clearCatalogPhrase}
                  onChange={(e) => {
                    setClearCatalogPhrase(e.target.value);
                    setClearCatalogError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !clearCatalogBusy && clearCatalogPhrase.trim() === 'DELETE_ALL_CATALOG') {
                      e.preventDefault();
                      void submitClearCatalog();
                    }
                  }}
                  disabled={clearCatalogBusy}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-950 px-3 py-2 font-mono text-slate-900 dark:text-slate-100 outline-none ring-blue-500/40 focus:border-blue-500 focus:ring-2 disabled:opacity-50"
                  placeholder="DELETE_ALL_CATALOG"
                />
              </label>
              {clearCatalogError && (
                <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                  {clearCatalogError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeClearCatalogModal}
                  disabled={clearCatalogBusy}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitClearCatalog()}
                  disabled={clearCatalogBusy || clearCatalogPhrase.trim() !== 'DELETE_ALL_CATALOG'}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {clearCatalogBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    'Delete everything'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Mini stat component ──────────────────────────────────── */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-600 dark:text-slate-200 mt-0.5">{value}</p>
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
  onView: (id: string, status: CatalogImportStatus) => void;
}) {
  return (
    <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100/30 dark:bg-slate-800/30">
      <td className="py-2 px-3">
        <button
          onClick={() => onView(importRecord.id, importRecord.status)}
          className="text-blue-400 hover:text-blue-300 text-left"
        >
          {importRecord.fileName}
        </button>
      </td>
      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
        {new Date(importRecord.createdAt).toLocaleDateString()}
      </td>
      <td className="py-2 px-3 text-center">
        <Badge variant={statusBadgeVariant(importRecord.status)}>
          {importRecord.status}
        </Badge>
      </td>
      <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-300">
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
            onClick={() => onView(importRecord.id, importRecord.status)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-200 p-1"
            title="View details"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
