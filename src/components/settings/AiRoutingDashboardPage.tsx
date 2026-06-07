import { useCallback, useEffect, useState } from 'react';
import { Cpu, Loader2, Play, RefreshCw } from 'lucide-react';
import ProtectedRoute from '../auth/ProtectedRoute';
import { usePermissions } from '../../hooks/usePermissions';
import {
  fetchAiRoutingPolicy,
  fetchAiRoutingRecommendations,
  fetchAiRoutingStats,
  runAiRoutingOptimize,
  type RoutingPolicy,
  type RoutingRecommendationsResponse,
  type RoutingStatsResponse,
} from '../../lib/aiRoutingApi';

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

function usd(n: number): string {
  return `$${n.toFixed(4)}`;
}

export default function AiRoutingDashboardPage() {
  return (
    <ProtectedRoute permissions={['ai.routing.view']}>
      <AiRoutingDashboard />
    </ProtectedRoute>
  );
}

function AiRoutingDashboard() {
  const { has } = usePermissions();
  const canManage = has('ai.routing.manage');

  const [stats, setStats] = useState<RoutingStatsResponse | null>(null);
  const [recommendations, setRecommendations] =
    useState<RoutingRecommendationsResponse | null>(null);
  const [policy, setPolicy] = useState<RoutingPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [s, r, p] = await Promise.all([
        fetchAiRoutingStats(),
        fetchAiRoutingRecommendations(),
        fetchAiRoutingPolicy(),
      ]);
      setStats(s);
      setRecommendations(r);
      setPolicy(p);
    } catch (e: unknown) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Failed to load AI routing data',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOptimize = async () => {
    if (!canManage) return;
    setOptimizing(true);
    setMessage(null);
    try {
      const next = await runAiRoutingOptimize();
      setPolicy(next);
      setMessage({
        type: 'ok',
        text: `Policy updated to v${next.version ?? '?'}`,
      });
      await load();
    } catch (e: unknown) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Optimizer failed',
      });
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
            AI routing
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Segment performance, learned policy, and optimizer recommendations (last 30 days).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {canManage && (
            <button
              type="button"
              disabled={optimizing}
              onClick={() => void handleOptimize()}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {optimizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run optimizer
            </button>
          )}
        </div>
      </div>

      {message && (
        <p
          className={`text-sm ${message.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Policy version"
          value={String(stats?.policyVersion ?? policy?.version ?? '—')}
        />
        <StatCard
          label="Session cost"
          value={usd(stats?.sessionCostUsd ?? 0)}
        />
        <StatCard
          label="Segments tracked"
          value={String(stats?.segments.length ?? 0)}
        />
      </div>

      {stats && Object.keys(stats.costByLane).length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Cost by lane (session)
          </h3>
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(stats.costByLane).map(([lane, cost]) => (
              <span
                key={lane}
                className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1"
              >
                {lane}: {usd(cost)}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          Segment × model stats
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500">
              <tr>
                <th className="px-4 py-2">Segment</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">First pass</th>
                <th className="px-4 py-2">Approval</th>
                <th className="px-4 py-2">Publish</th>
                <th className="px-4 py-2">Compliance</th>
                <th className="px-4 py-2">Avg cost</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.segments ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-slate-500 text-center">
                    No ai_run_logs yet — run enrichment to populate metrics.
                  </td>
                </tr>
              ) : (
                stats?.segments.map((seg) => (
                  <tr
                    key={`${seg.segmentKey}-${seg.model}`}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-4 py-2 font-mono text-xs">{seg.segmentKey}</td>
                    <td className="px-4 py-2">{seg.model}</td>
                    <td className="px-4 py-2">{seg.attempts}</td>
                    <td className="px-4 py-2">{pct(seg.firstPassRate)}</td>
                    <td className="px-4 py-2">{pct(seg.humanApprovalRate)}</td>
                    <td className="px-4 py-2">{pct(seg.publishSuccessRate)}</td>
                    <td className="px-4 py-2">{pct(seg.avgComplianceScore)}</td>
                    <td className="px-4 py-2">{usd(seg.avgCost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          Optimizer recommendations
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500">
              <tr>
                <th className="px-4 py-2">Segment</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Reward</th>
                <th className="px-4 py-2">Prior</th>
              </tr>
            </thead>
            <tbody>
              {(recommendations?.recommendations ?? []).map((rec) => (
                <tr
                  key={`${rec.segment}-${rec.model}`}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-4 py-2 font-mono text-xs">{rec.segment}</td>
                  <td className="px-4 py-2">{rec.model}</td>
                  <td className="px-4 py-2">{rec.attempts}</td>
                  <td className="px-4 py-2">{rec.reward.toFixed(3)}</td>
                  <td className="px-4 py-2">
                    {rec.prior != null ? rec.prior.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Active policy
        </h3>
        <pre className="text-xs overflow-x-auto bg-slate-50 dark:bg-slate-900 rounded-lg p-3 max-h-80">
          {JSON.stringify(policy, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
        {value}
      </p>
    </div>
  );
}
