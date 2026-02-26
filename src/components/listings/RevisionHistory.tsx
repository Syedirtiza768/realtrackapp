/* ─── RevisionHistory ─────────────────────────────────────
 *  Timeline view of all revisions for a listing.
 *  Shows version, status transitions, timestamps, and
 *  allows viewing full snapshot diffs.
 * ────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  ChevronDown,
  ChevronRight,
  GitCommit,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useRevisions } from '../../lib/listingsApi';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  ready: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  sold: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  delisted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  archived: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RevisionHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: revisions, loading, error } = useRevisions(id ?? null, 50);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Revision History
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {id ? `Listing ${id.slice(0, 8)}…` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-5 text-center text-red-400 text-sm">
          <p className="font-medium">Failed to load revisions</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && revisions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400">No revisions found for this listing.</p>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {revisions.length > 0 && (
        <Card>
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCommit size={16} className="text-blue-400" />
              {revisions.length} Revision{revisions.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {revisions.map((rev, idx) => {
                const isExpanded = expandedId === rev.id;
                const isLatest = idx === 0;

                return (
                  <div key={rev.id} className="group">
                    {/* Revision row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : rev.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Version indicator */}
                      <div className="relative flex flex-col items-center shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                          isLatest ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}>
                          v{rev.version}
                        </div>
                        {idx < revisions.length - 1 && (
                          <div className="w-px h-3 bg-slate-700 mt-1" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {rev.statusBefore && (
                            <>
                              <StatusBadge status={rev.statusBefore} />
                              <ChevronRight size={12} className="text-slate-600" />
                            </>
                          )}
                          <StatusBadge status={rev.statusAfter} />
                          {isLatest && (
                            <Badge variant="success" className="text-[10px]">Latest</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatDate(rev.createdAt)}
                          </span>
                          {rev.changeReason && (
                            <span className="text-slate-600">
                              {rev.changeReason}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expand icon */}
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Expanded snapshot */}
                    {isExpanded && (
                      <div className="px-5 pb-4 ml-12">
                        <div className="bg-slate-800/50 rounded-lg p-4 overflow-x-auto">
                          <p className="text-xs text-slate-500 mb-2 font-medium">Snapshot at v{rev.version}</p>
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto scrollbar-thin">
                            {JSON.stringify(rev.snapshot, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
