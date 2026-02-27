/* ─── AI Enhancements Panel ─────────────────────────────────
 *  AI-powered listing enhancement management for a single SKU.
 *  Supports: title optimization, description generation,
 *            item specifics, fitment detection, image enhancement.
 *  Workflow: Request → Review → Approve/Reject → Apply
 * ────────────────────────────────────────────────────────── */

import React, { useState, useCallback } from 'react';
import {
  Sparkles,
  Type,
  FileText,
  ListChecks,
  Car,
  Image,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Zap,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import {
  useListingEnhancements,
  requestEnhancement,
  approveEnhancement,
  applyEnhancement,
  rejectEnhancement,
} from '../../lib/multiStoreApi';
import type { AiEnhancement, EnhancementType, EnhancementStatus } from '../../types/multiStore';
import { ENHANCEMENT_TYPE_META } from '../../types/multiStore';

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  title_optimization: Type,
  description_generation: FileText,
  item_specifics: ListChecks,
  fitment_detection: Car,
  image_enhancement: Image,
};

const STATUS_CONFIG: Record<string, { icon: React.ComponentType<any>; bg: string; text: string; label: string }> = {
  requested: { icon: Clock, bg: 'bg-slate-100', text: 'text-slate-600', label: 'Requested' },
  processing: { icon: Loader2, bg: 'bg-blue-100', text: 'text-blue-700', label: 'Processing' },
  generated: { icon: Sparkles, bg: 'bg-purple-100', text: 'text-purple-700', label: 'Generated' },
  approved: { icon: CheckCircle2, bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  rejected: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

const TYPES: EnhancementType[] = [
  'title_optimization',
  'description_generation',
  'item_specifics',
  'fitment_detection',
  'image_enhancement',
];

export default function AiEnhancementsPanel({ listingId }: { listingId: string }) {
  const { enhancements, loading, refresh } = useListingEnhancements(listingId);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const handleRequest = useCallback(async (type: EnhancementType) => {
    setRequesting(type);
    setActionMsg(null);
    try {
      await requestEnhancement(listingId, type);
      setActionMsg(`${ENHANCEMENT_TYPE_META[type].label} generated!`);
      await refresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
    setRequesting(null);
  }, [listingId, refresh]);

  const handleRequestAll = useCallback(async () => {
    setRequesting('all');
    setActionMsg(null);
    let count = 0;
    for (const type of TYPES) {
      try {
        await requestEnhancement(listingId, type);
        count++;
      } catch { /* continue */ }
    }
    setActionMsg(`Generated ${count}/${TYPES.length} enhancements`);
    setRequesting(null);
    await refresh();
  }, [listingId, refresh]);

  const handleApprove = useCallback(async (id: string) => {
    try {
      await approveEnhancement(id);
      setActionMsg('Enhancement approved!');
      await refresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  }, [refresh]);

  const handleApply = useCallback(async (id: string) => {
    try {
      await applyEnhancement(id);
      setActionMsg('Enhancement applied to listing!');
      await refresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  }, [refresh]);

  const handleReject = useCallback(async (id: string) => {
    try {
      await rejectEnhancement(id, 'User rejected');
      setActionMsg('Enhancement rejected');
      await refresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  }, [refresh]);

  // Group enhancements by type
  const enhByType = TYPES.reduce((acc, type) => {
    acc[type] = enhancements.filter((e) => e.enhancementType === type);
    return acc;
  }, {} as Record<EnhancementType, AiEnhancement[]>);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">AI-Powered Listing Enhancements</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {enhancements.length} enhancements
            {' · '}
            {enhancements.filter((e) => e.status === 'approved').length} approved
            {' · '}
            {enhancements.filter((e) => e.appliedAt).length} applied
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={handleRequestAll}
            disabled={requesting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {requesting === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate All
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={`px-3 py-2 rounded-lg text-sm ${actionMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {actionMsg}
        </div>
      )}

      {/* Enhancement Type Cards */}
      {TYPES.map((type) => {
        const meta = ENHANCEMENT_TYPE_META[type];
        const typeEnhancements = enhByType[type] ?? [];
        const latest = typeEnhancements[0]; // already sorted by version DESC
        const Icon = TYPE_ICONS[type] ?? Sparkles;

        return (
          <div key={type} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Type Header */}
            <div className="px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${meta.color}-50`}>
                <Icon className={`w-5 h-5 text-${meta.color}-600`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                  {latest && <StatusBadge status={latest.status} />}
                  {latest?.enhancementVersion && latest.enhancementVersion > 1 && (
                    <span className="text-[10px] text-slate-400">v{latest.enhancementVersion}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{meta.description}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {(!latest || latest.status === 'rejected' || latest.status === 'approved') && (
                  <button
                    onClick={() => handleRequest(type)}
                    disabled={requesting !== null}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {requesting === type ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    {latest ? 'Regenerate' : 'Generate'}
                  </button>
                )}
                {latest?.status === 'generated' && (
                  <>
                    <button
                      onClick={() => handleApprove(latest.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 transition-colors"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(latest.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-medium rounded hover:bg-red-100 transition-colors"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </>
                )}
                {latest?.status === 'approved' && !latest.appliedAt && (
                  <button
                    onClick={() => handleApply(latest.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" />
                    Apply
                  </button>
                )}
                {latest && (
                  <button
                    onClick={() => setExpandedId(expandedId === latest.id ? null : latest.id)}
                    className="p-1 rounded hover:bg-slate-100 transition-colors"
                  >
                    {expandedId === latest.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Detail */}
            {latest && expandedId === latest.id && (
              <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                {latest.confidenceScore != null && (
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-600">
                      Confidence: <strong>{(latest.confidenceScore * 100).toFixed(1)}%</strong>
                    </span>
                    <span className="text-xs text-slate-400">
                      | {latest.tokensUsed ?? 0} tokens | {latest.latencyMs ?? 0}ms
                    </span>
                    {latest.provider && (
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px]">
                        {latest.provider}/{latest.model}
                      </span>
                    )}
                  </div>
                )}

                {/* Original vs Enhanced */}
                {latest.originalValue && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Original</p>
                    <div className="p-2 bg-white rounded border border-slate-200 text-xs text-slate-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {latest.originalValue.slice(0, 500)}{latest.originalValue.length > 500 ? '…' : ''}
                    </div>
                  </div>
                )}
                {latest.enhancedValue && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1">Enhanced</p>
                    <div className="p-2 bg-green-50 rounded border border-green-200 text-xs text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {type === 'description_generation' ? (
                        <div dangerouslySetInnerHTML={{ __html: latest.enhancedValue }} />
                      ) : (
                        latest.enhancedValue.slice(0, 800)
                      )}
                    </div>
                  </div>
                )}

                {/* Diff/Changes */}
                {latest.diff && (latest.diff as any).changes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Changes</p>
                    <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                      {((latest.diff as any).changes as string[]).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Structured Data (item_specifics, fitment) */}
                {latest.enhancedData && type === 'item_specifics' && (latest.enhancedData as any).specifics && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Item Specifics</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries((latest.enhancedData as any).specifics).map(([k, v]) => (
                        <div key={k} className="flex justify-between bg-white rounded px-2 py-1 border border-slate-200">
                          <span className="text-[11px] text-slate-500">{k}</span>
                          <span className="text-[11px] text-slate-800 font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {latest.enhancedData && type === 'fitment_detection' && (latest.enhancedData as any).fitments && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Detected Fitments</p>
                    <div className="space-y-1">
                      {((latest.enhancedData as any).fitments as Array<{ year: string; make: string; model: string }>).map((f, i) => (
                        <div key={i} className="flex gap-2 bg-white rounded px-2 py-1 border border-slate-200 text-[11px]">
                          <span className="font-medium text-slate-800">{f.year}</span>
                          <span className="text-slate-600">{f.make}</span>
                          <span className="text-slate-500">{f.model}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {latest.appliedAt && (
                  <p className="text-xs text-green-600 font-medium">
                    Applied to listing on {new Date(latest.appliedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: EnhancementStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.requested;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}
