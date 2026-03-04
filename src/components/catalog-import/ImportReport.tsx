import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  ArrowDownToLine,
  Flag,
  Ban,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { CatalogImport } from '../../types/catalogImport';

interface ImportReportProps {
  importRecord: CatalogImport;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.round((e - s) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function StatusBadge({ status }: { status: CatalogImport['status'] }) {
  const map: Record<string, { variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    validating: { variant: 'default', label: 'Validating' },
    processing: { variant: 'default', label: 'Processing' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'destructive', label: 'Failed' },
    cancelled: { variant: 'secondary', label: 'Cancelled' },
    paused: { variant: 'warning', label: 'Paused' },
  };
  const cfg = map[status] ?? { variant: 'secondary' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function ImportReport({ importRecord }: ImportReportProps) {
  const progressPct =
    importRecord.totalRows > 0
      ? Math.round((importRecord.processedRows / importRecord.totalRows) * 100)
      : 0;

  const isProcessing = importRecord.status === 'processing' || importRecord.status === 'validating';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            Import Report
          </div>
          <StatusBadge status={importRecord.status} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* File info */}
        <div className="text-sm text-slate-400 mb-4">
          <span className="text-slate-200 font-medium">{importRecord.fileName}</span>
          {importRecord.fileSizeBytes && (
            <span className="ml-2">
              ({(importRecord.fileSizeBytes / 1024).toFixed(0)} KB)
            </span>
          )}
        </div>

        {/* Progress bar (while processing) */}
        {isProcessing && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Processing rows...</span>
              <span>
                {importRecord.processedRows.toLocaleString()} / {importRecord.totalRows.toLocaleString()} ({progressPct}%)
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<FileText className="h-4 w-4 text-slate-400" />}
            label="Total Rows"
            value={importRecord.totalRows.toLocaleString()}
          />
          <StatCard
            icon={<ArrowDownToLine className="h-4 w-4 text-emerald-400" />}
            label="Inserted"
            value={importRecord.insertedRows.toLocaleString()}
            variant="success"
          />
          <StatCard
            icon={<Ban className="h-4 w-4 text-amber-400" />}
            label="Duplicates Skipped"
            value={importRecord.skippedDuplicates.toLocaleString()}
            variant="warning"
          />
          <StatCard
            icon={<Flag className="h-4 w-4 text-blue-400" />}
            label="Flagged for Review"
            value={importRecord.flaggedForReview.toLocaleString()}
            variant="info"
          />
          <StatCard
            icon={<XCircle className="h-4 w-4 text-red-400" />}
            label="Invalid Rows"
            value={importRecord.invalidRows.toLocaleString()}
            variant="error"
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-slate-400" />}
            label="Duration"
            value={formatDuration(importRecord.startedAt, importRecord.completedAt)}
          />
        </div>

        {/* Error message */}
        {importRecord.errorMessage && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/50">
            <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-400 text-sm">{importRecord.errorMessage}</p>
          </div>
        )}

        {/* Warnings */}
        {importRecord.warnings && importRecord.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {importRecord.warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg bg-amber-900/10 border border-amber-900/30"
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-400 text-sm">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {/* Completed success message */}
        {importRecord.status === 'completed' && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-emerald-900/20 border border-emerald-900/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-emerald-400 text-sm">
              Import completed successfully. {importRecord.insertedRows} new products added to the catalog.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Stat card sub-component ──────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: 'success' | 'warning' | 'error' | 'info';
}) {
  const valueColors = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    info: 'text-blue-400',
  };

  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-lg font-semibold ${variant ? valueColors[variant] : 'text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}
