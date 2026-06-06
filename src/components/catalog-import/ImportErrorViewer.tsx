import { useState, useCallback, useEffect } from 'react';
import {
  AlertTriangle,
  XCircle,
  Flag,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  ImageIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { CatalogImportRow, ImportRowStatus } from '../../types/catalogImport';
import { fetchWithAuth } from '../../lib/authApi';

const API_BASE = '/api';

async function apiFetch<T>(path: string): Promise<T> {
  return fetchWithAuth<T>(`${API_BASE}${path}`);
}

interface ImportErrorViewerProps {
  importId: string;
  totalRows: number;
  invalidRows: number;
  flaggedForReview: number;
}

type RowFilter = 'all_issues' | 'invalid' | 'duplicate_flagged' | 'error' | 'duplicate_skipped';

const FILTER_OPTIONS: Array<{ value: RowFilter; label: string; color: string }> = [
  { value: 'all_issues', label: 'All Issues', color: 'text-slate-500 dark:text-slate-300' },
  { value: 'invalid', label: 'Invalid', color: 'text-red-400' },
  { value: 'error', label: 'Errors', color: 'text-red-400' },
  { value: 'duplicate_flagged', label: 'Flagged Duplicates', color: 'text-amber-400' },
  { value: 'duplicate_skipped', label: 'Skipped Duplicates', color: 'text-slate-500 dark:text-slate-400' },
];

function RowStatusBadge({ status }: { status: ImportRowStatus }) {
  const map: Record<string, { variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
    inserted: { variant: 'success', label: 'Inserted' },
    duplicate_skipped: { variant: 'secondary', label: 'Dup Skipped' },
    duplicate_flagged: { variant: 'warning', label: 'Dup Flagged' },
    updated: { variant: 'default', label: 'Updated' },
    invalid: { variant: 'destructive', label: 'Invalid' },
    error: { variant: 'destructive', label: 'Error' },
  };
  const cfg = map[status] ?? { variant: 'secondary', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function ImportErrorViewer({
  importId,
  totalRows,
  invalidRows,
  flaggedForReview,
}: ImportErrorViewerProps) {
  const [rows, setRows] = useState<CatalogImportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RowFilter>('all_issues');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const limit = 20;

  const issueCount = invalidRows + flaggedForReview;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = filter === 'all_issues' ? 'invalid,error,duplicate_flagged' : filter;
      const params = new URLSearchParams({
        status: statusParam,
        limit: String(limit),
        offset: String(page * limit),
      });
      const result = await apiFetch<{ rows: CatalogImportRow[]; total: number }>(
        `/catalog-import/${importId}/rows?${params.toString()}`,
      );
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rows');
    } finally {
      setLoading(false);
    }
  }, [importId, filter, page]);

  useEffect(() => {
    if (expanded) {
      void fetchRows();
    }
  }, [expanded, fetchRows]);

  const totalPages = Math.ceil(total / limit);

  if (issueCount === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span>Upload Issues & Errors</span>
            <Badge variant="warning">{issueCount}</Badge>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          )}
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent>
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === opt.value
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Error/Loading states */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-red-900/20 border border-red-900/50">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {loading && (
            <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-sm">Loading rows...</div>
          )}

          {/* Rows table */}
          {!loading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-left">
                    <th className="pb-2 pr-3 w-16">Row #</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Issue</th>
                    <th className="pb-2 pr-3">Match</th>
                    <th className="pb-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800">
                      <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {row.rowNumber}
                      </td>
                      <td className="py-2 pr-3">
                        <RowStatusBadge status={row.status} />
                      </td>
                      <td className="py-2 pr-3 max-w-[300px]">
                        <p className="text-slate-500 dark:text-slate-300 text-xs">{row.message || '—'}</p>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-400 dark:text-slate-500">
                        {row.matchStrategy || '—'}
                      </td>
                      <td className="py-2">
                        {row.rawData && (
                          <button
                            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            {expandedRow === row.id ? 'Hide' : 'View'} raw data
                          </button>
                        )}
                        {expandedRow === row.id && row.rawData && (
                          <div className="mt-2 p-2 rounded bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400 max-h-[200px] overflow-auto">
                            <table className="w-full">
                              <tbody>
                                {Object.entries(row.rawData).map(([key, val]) => (
                                  <tr key={key} className="border-b border-slate-200/50 dark:border-slate-800/50">
                                    <td className="py-0.5 pr-2 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{key}</td>
                                    <td className="py-0.5 text-slate-500 dark:text-slate-300 break-all">{val}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && rows.length === 0 && !error && (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
              No issues found with this filter.
            </p>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
