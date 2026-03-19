/**
 * OrderShipmentPanel.tsx — Phase 4
 *
 * Bulk operations panel for the Orders page:
 *  - Bulk ship selected orders with tracking info
 *  - Bulk cancel selected orders
 *  - CSV tracking upload
 *  - Manual eBay import trigger
 *
 * Designed to be placed alongside OrdersPage as a slide-out panel or section.
 */
import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Upload,
  XCircle,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  bulkShip,
  bulkCancel,
  uploadTrackingCsv,
  importEbayOrders,
  type BulkShipItem,
  type BulkResult,
  type CsvTrackingResult,
} from '../../lib/ordersApi';

/* ─── Props ─── */

interface OrderShipmentPanelProps {
  /** IDs of currently selected orders in the parent table */
  selectedOrderIds: string[];
  /** Callback to clear selection after a bulk action */
  onActionComplete?: () => void;
}

/* ─── Component ─── */

export default function OrderShipmentPanel({
  selectedOrderIds,
  onActionComplete,
}: OrderShipmentPanelProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Bulk Ship State ───
  const [carrier, setCarrier] = useState('USPS');
  const [trackingEntries, setTrackingEntries] = useState<Record<string, string>>({});

  // ─── Cancel Reason ───
  const [cancelReason, setCancelReason] = useState('');

  // ─── Results ───
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [csvResult, setCsvResult] = useState<CsvTrackingResult | null>(null);

  const invalidateOrders = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    onActionComplete?.();
  };

  /* ─── Bulk Ship Mutation ─── */

  const shipMutation = useMutation({
    mutationFn: (items: BulkShipItem[]) => bulkShip(items),
    onSuccess: (data: BulkResult[]) => {
      setBulkResults(data);
      invalidateOrders();
    },
  });

  const handleBulkShip = () => {
    const items: BulkShipItem[] = selectedOrderIds
      .filter((id) => trackingEntries[id]?.trim())
      .map((id) => ({
        orderId: id,
        trackingNumber: trackingEntries[id].trim(),
        carrier,
      }));

    if (items.length === 0) return;
    shipMutation.mutate(items);
  };

  /* ─── Bulk Cancel Mutation ─── */

  const cancelMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason?: string }) =>
      bulkCancel(ids, reason),
    onSuccess: (data: BulkResult[]) => {
      setBulkResults(data);
      invalidateOrders();
    },
  });

  const handleBulkCancel = () => {
    if (selectedOrderIds.length === 0) return;
    cancelMutation.mutate({
      ids: selectedOrderIds,
      reason: cancelReason || undefined,
    });
  };

  /* ─── CSV Tracking Upload ─── */

  const csvMutation = useMutation({
    mutationFn: (content: string) => uploadTrackingCsv(content),
    onSuccess: (data: CsvTrackingResult) => {
      setCsvResult(data);
      invalidateOrders();
    },
  });

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) csvMutation.mutate(content);
    };
    reader.readAsText(file);

    // Reset file input so the same file can be re-uploaded
    e.target.value = '';
  };

  /* ─── Manual eBay Import ─── */

  const importMutation = useMutation({
    mutationFn: () => importEbayOrders(),
    onSuccess: () => {
      invalidateOrders();
    },
  });

  const isAnyPending =
    shipMutation.isPending || cancelMutation.isPending || csvMutation.isPending || importMutation.isPending;

  const selectedCount = selectedOrderIds.length;

  return (
    <div className="space-y-4">
      {/* ─── Bulk Ship ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Bulk Ship ({selectedCount} selected)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="rounded-md bg-slate-800 border border-slate-700 text-sm px-2 py-1.5"
            >
              <option value="USPS">USPS</option>
              <option value="UPS">UPS</option>
              <option value="FedEx">FedEx</option>
              <option value="DHL">DHL</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {selectedOrderIds.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedOrderIds.map((id) => (
                <div key={id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono w-24 truncate">{id.slice(0, 8)}…</span>
                  <input
                    type="text"
                    placeholder="Tracking number"
                    value={trackingEntries[id] ?? ''}
                    onChange={(e) =>
                      setTrackingEntries((prev) => ({ ...prev, [id]: e.target.value }))
                    }
                    className="flex-1 rounded-md bg-slate-800 border border-slate-700 text-sm px-2 py-1"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleBulkShip}
            disabled={selectedCount === 0 || isAnyPending}
            className="w-full px-3 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {shipMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            Ship Selected Orders
          </button>
        </CardContent>
      </Card>

      {/* ─── CSV Tracking Upload ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" />
            CSV Tracking Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400">
            Upload a CSV with columns: <code className="text-slate-300">orderId</code>,{' '}
            <code className="text-slate-300">trackingNumber</code>,{' '}
            <code className="text-slate-300">carrier</code>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnyPending}
            className="w-full px-3 py-2 text-sm font-medium rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {csvMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Choose CSV File
          </button>

          {csvResult && (
            <div className="rounded-md bg-slate-800 p-3 text-xs space-y-1">
              <p>
                <CheckCircle2 className="inline h-3 w-3 text-emerald-400 mr-1" />
                {csvResult.succeeded}/{csvResult.processed} shipped
              </p>
              {csvResult.failed > 0 && (
                <p>
                  <AlertTriangle className="inline h-3 w-3 text-amber-400 mr-1" />
                  {csvResult.failed} failed
                </p>
              )}
              {csvResult.errors.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                  {csvResult.errors.map((err: { row: number; orderId: string; error: string }) => (
                    <p key={err.row} className="text-red-400">
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Bulk Cancel ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Bulk Cancel ({selectedCount} selected)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            placeholder="Cancellation reason (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full rounded-md bg-slate-800 border border-slate-700 text-sm px-2 py-1.5"
          />
          <button
            onClick={handleBulkCancel}
            disabled={selectedCount === 0 || isAnyPending}
            className="w-full px-3 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {cancelMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Cancel Selected Orders
          </button>
        </CardContent>
      </Card>

      {/* ─── Manual eBay Import ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Download className="h-4 w-4" />
            eBay Order Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 mb-3">
            Manually trigger an eBay order import for all connected stores.
            This normally runs every 15 minutes automatically.
          </p>
          <button
            onClick={() => importMutation.mutate()}
            disabled={isAnyPending}
            className="w-full px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Import eBay Orders Now
          </button>

          {importMutation.isSuccess && (
            <p className="text-xs text-emerald-400 mt-2">
              <CheckCircle2 className="inline h-3 w-3 mr-1" />
              Import complete
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Bulk Results ─── */}
      {bulkResults && bulkResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
              {bulkResults.map((r) => (
                <div key={r.orderId} className="flex items-center gap-2">
                  {r.success ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
                  )}
                  <span className="font-mono text-slate-400">{r.orderId.slice(0, 8)}…</span>
                  {r.error && <span className="text-red-400">{r.error}</span>}
                </div>
              ))}
            </div>
            <button
              onClick={() => setBulkResults(null)}
              className="mt-2 text-xs text-slate-400 hover:text-slate-300"
            >
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
