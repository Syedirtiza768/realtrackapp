/* ─── Inventory Panel ───────────────────────────────────────
 *  Centralized inventory management for a single SKU.
 *  Shows: current stock levels, adjust quantity, event history.
 * ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  Loader2,
  BarChart3,
  ShoppingCart,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';
import { getInventoryLedger, adjustInventory } from '../../lib/multiStoreApi';

interface Ledger {
  id: string;
  listingId: string;
  quantityTotal: number;
  quantityReserved: number;
  quantityAvailable: number | null;
  lowStockThreshold: number;
  lastReconciledAt: string | null;
}

interface InventoryEvent {
  id: string;
  eventType: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  sourceChannel: string | null;
  reason: string | null;
  createdAt: string;
}

export default function InventoryPanel({ listingId }: { listingId: string }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [events, setEvents] = useState<InventoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInventoryLedger(listingId);
      setLedger(data.ledger);
      setEvents(data.recentEvents);
    } catch {
      // Inventory may not exist yet — that's OK
    }
    setLoading(false);
  }, [listingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdjust = async () => {
    if (adjustAmount === 0 || !adjustReason.trim()) return;
    setAdjusting(true);
    setMsg(null);
    try {
      await adjustInventory(listingId, adjustAmount, adjustReason);
      setMsg(`Adjusted by ${adjustAmount > 0 ? '+' : ''}${adjustAmount}`);
      setAdjustAmount(0);
      setAdjustReason('');
      await fetchData();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    }
    setAdjusting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  const available = ledger ? (ledger.quantityAvailable ?? (ledger.quantityTotal - ledger.quantityReserved)) : 0;
  const isLowStock = ledger ? available <= ledger.lowStockThreshold && available > 0 : false;
  const isOutOfStock = available <= 0;

  return (
    <div className="space-y-6">
      {/* Stock Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StockCard
          label="Total Stock"
          value={ledger?.quantityTotal ?? 0}
          icon={Package}
          color="text-blue-600 bg-blue-50"
        />
        <StockCard
          label="Available"
          value={available}
          icon={isOutOfStock ? AlertTriangle : isLowStock ? TrendingDown : BarChart3}
          color={isOutOfStock ? 'text-red-600 bg-red-50' : isLowStock ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'}
        />
        <StockCard
          label="Reserved"
          value={ledger?.quantityReserved ?? 0}
          icon={ShoppingCart}
          color="text-purple-600 bg-purple-50"
        />
        <StockCard
          label="Low Stock Threshold"
          value={ledger?.lowStockThreshold ?? 2}
          icon={AlertTriangle}
          color="text-slate-600 bg-slate-50"
        />
      </div>

      {/* Alerts */}
      {isOutOfStock && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">Out of Stock — This item has no available inventory.</p>
        </div>
      )}
      {isLowStock && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <TrendingDown className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            Low Stock Warning — Only {available} units available (threshold: {ledger?.lowStockThreshold}).
          </p>
        </div>
      )}

      {/* Adjust Quantity */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Adjust Inventory</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Qty Change</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAdjustAmount((v) => v - 1)}
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Minus className="w-4 h-4 text-slate-600" />
              </button>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1.5 border border-slate-300 rounded text-center text-sm"
              />
              <button
                onClick={() => setAdjustAmount((v) => v + 1)}
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Reason</label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g., Received shipment, Damaged item, Physical count correction"
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
          <button
            onClick={handleAdjust}
            disabled={adjustAmount === 0 || !adjustReason.trim() || adjusting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adjusting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Apply
          </button>
        </div>
        {msg && (
          <p className={`mt-2 text-sm ${msg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>
        )}
      </div>

      {/* Event History */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Recent Inventory Events</h3>
        </div>
        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No inventory events yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {events.map((evt) => (
              <div key={evt.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  evt.quantityChange > 0 ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {evt.quantityChange > 0
                    ? <ArrowUpCircle className="w-4 h-4 text-green-600" />
                    : <ArrowDownCircle className="w-4 h-4 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${evt.quantityChange > 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {evt.quantityChange > 0 ? '+' : ''}{evt.quantityChange}
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium uppercase">
                      {evt.eventType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {evt.reason && <p className="text-xs text-slate-500 mt-0.5">{evt.reason}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">{evt.quantityBefore} → {evt.quantityAfter}</p>
                  <p className="text-[10px] text-slate-400">{new Date(evt.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StockCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
}) {
  const [iconColor, bgColor] = color.split(' ');
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">{label}</span>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${bgColor}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</p>
    </div>
  );
}
