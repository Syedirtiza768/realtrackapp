/**
 * PricingDashboard.tsx — Phase 5
 *
 * Market Intelligence & Dynamic Pricing dashboard:
 *  - Market snapshot overview for a product
 *  - AI pricing suggestion with accept/reject
 *  - Competitor price history chart
 *  - Manual price collection trigger
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  getLatestSnapshot,
  getCompetitorHistory,
  getPricingSuggestion,
  repriceProduct,
  collectCompetitorPrices,
  type MarketSnapshot,
  type CompetitorPrice,
  type PricingSuggestion,
  type RepriceResponse,
} from '../../lib/pricingApi';

/* ─── Props ─── */

interface PricingDashboardProps {
  productId: string;
  productTitle: string;
  currentPrice: number | null;
  costPrice: number | null;
}

/* ─── Helpers ─── */

function fmtUSD(val: number | null | undefined): string {
  if (val == null) return 'N/A';
  return `$${Number(val).toFixed(2)}`;
}

function positionBadge(pos: string): { color: string; label: string } {
  switch (pos) {
    case 'below_average':
      return { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Below Average' };
    case 'above_average':
      return { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Above Average' };
    default:
      return { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Average' };
  }
}

function strategyBadge(strategy: string): { color: string; label: string } {
  switch (strategy) {
    case 'undercut':
      return { color: 'bg-green-500/10 text-green-400', label: 'Undercut' };
    case 'premium':
      return { color: 'bg-purple-500/10 text-purple-400', label: 'Premium' };
    case 'value':
      return { color: 'bg-amber-500/10 text-amber-400', label: 'Value' };
    default:
      return { color: 'bg-blue-500/10 text-blue-400', label: 'Match' };
  }
}

/* ─── Component ─── */

export default function PricingDashboard({
  productId,
  productTitle: _productTitle,
  currentPrice,
  costPrice,
}: PricingDashboardProps) {
  const queryClient = useQueryClient();
  const [showSuggestion, setShowSuggestion] = useState(false);

  // ─── Queries ───

  const snapshotQuery = useQuery<MarketSnapshot | null>({
    queryKey: ['pricing', 'snapshot', productId],
    queryFn: () => getLatestSnapshot(productId),
  });

  const competitorQuery = useQuery<CompetitorPrice[]>({
    queryKey: ['pricing', 'competitors', productId],
    queryFn: () => getCompetitorHistory(productId, 30),
    enabled: !!productId,
  });

  const suggestionQuery = useQuery<PricingSuggestion>({
    queryKey: ['pricing', 'suggestion', productId],
    queryFn: () => getPricingSuggestion(productId),
    enabled: showSuggestion,
  });

  // ─── Mutations ───

  const repriceMutation = useMutation<RepriceResponse, Error, void>({
    mutationFn: () => repriceProduct(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  const collectMutation = useMutation({
    mutationFn: () => collectCompetitorPrices(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  const snapshot = snapshotQuery.data;
  const competitors = competitorQuery.data ?? [];
  const suggestion = suggestionQuery.data;

  // Compute basic market position
  const marketAvg = snapshot?.avgPrice ? Number(snapshot.avgPrice) : null;
  const priceDiff = currentPrice && marketAvg ? currentPrice - marketAvg : null;
  const pricePct = currentPrice && marketAvg ? ((currentPrice - marketAvg) / marketAvg) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          Market Intelligence
        </h3>
        <button
          onClick={() => collectMutation.mutate()}
          disabled={collectMutation.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1"
        >
          {collectMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh Prices
        </button>
      </div>

      {/* ─── Market Overview Cards ─── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Market Avg</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{fmtUSD(marketAvg)}</div>
            {priceDiff !== null && (
              <p className={`text-xs mt-1 ${priceDiff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {priceDiff > 0 ? (
                  <TrendingUp className="inline h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="inline h-3 w-3 mr-0.5" />
                )}
                {pricePct !== null && `${pricePct > 0 ? '+' : ''}${pricePct.toFixed(1)}% vs market`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Price Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {fmtUSD(snapshot?.minPrice ? Number(snapshot.minPrice) : null)}
              <span className="text-sm text-slate-500"> — </span>
              {fmtUSD(snapshot?.maxPrice ? Number(snapshot.maxPrice) : null)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {snapshot?.totalListings ?? 0} active listings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Your Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-400">{fmtUSD(currentPrice)}</div>
            {costPrice && currentPrice && (
              <p className="text-xs text-slate-400 mt-1">
                {((currentPrice - costPrice) / costPrice * 100).toFixed(1)}% margin
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Competitors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{competitors.length}</div>
            <p className="text-xs text-slate-400 mt-1">tracked (30 days)</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Market Insights ─── */}
      {snapshot?.marketInsights && snapshot.marketInsights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-400" />
              Market Insights
              {snapshot.confidence !== null && (
                <span className="text-xs font-normal text-slate-500">
                  (confidence: {(Number(snapshot.confidence) * 100).toFixed(0)}%)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {snapshot.marketInsights.map((insight: string, i: number) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ─── AI Pricing Suggestion ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            AI Pricing Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!showSuggestion ? (
            <button
              onClick={() => setShowSuggestion(true)}
              className="w-full px-3 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Get AI Pricing Suggestion
            </button>
          ) : suggestionQuery.isLoading ? (
            <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing market data…
            </div>
          ) : suggestion ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-emerald-400">
                  {fmtUSD(suggestion.suggestedPrice)}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${positionBadge(suggestion.marketPosition).color}`}
                >
                  {positionBadge(suggestion.marketPosition).label}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${strategyBadge(suggestion.pricingStrategy).color}`}
                >
                  {strategyBadge(suggestion.pricingStrategy).label}
                </span>
              </div>

              <p className="text-sm text-slate-300">{suggestion.reasoning}</p>

              <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div>
                  <span className="block font-medium text-slate-300">Confidence</span>
                  {(suggestion.confidence * 100).toFixed(0)}%
                </div>
                <div>
                  <span className="block font-medium text-slate-300">Margin</span>
                  {suggestion.marginPercent.toFixed(1)}%
                </div>
                <div>
                  <span className="block font-medium text-slate-300">Range</span>
                  {fmtUSD(suggestion.minViablePrice)} – {fmtUSD(suggestion.maxRecommendedPrice)}
                </div>
              </div>

              {suggestion.actionItems.length > 0 && (
                <ul className="text-xs text-slate-400 space-y-0.5">
                  {suggestion.actionItems.map((item: string, i: number) => (
                    <li key={i}>→ {item}</li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => repriceMutation.mutate()}
                  disabled={repriceMutation.isPending}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {repriceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Apply to eBay Stores
                </button>
                <button
                  onClick={() => setShowSuggestion(false)}
                  className="px-3 py-2 text-sm font-medium rounded-md bg-slate-700 hover:bg-slate-600"
                >
                  Dismiss
                </button>
              </div>

              {repriceMutation.isSuccess && repriceMutation.data && (
                <div className="rounded-md bg-slate-800 p-3 text-xs space-y-1">
                  {repriceMutation.data.results.map((r: { offerId: string; storeName: string; oldPrice: number | null; newPrice: number; action: string; error?: string }) => (
                    <div key={r.offerId} className="flex items-center gap-2">
                      {r.action === 'repriced' ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                      ) : r.action === 'error' ? (
                        <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
                      ) : (
                        <span className="h-3 w-3 flex-shrink-0" />
                      )}
                      <span className="text-slate-300">{r.storeName}:</span>
                      {r.action === 'repriced' ? (
                        <span className="text-emerald-400">
                          {fmtUSD(r.oldPrice)} → {fmtUSD(r.newPrice)}
                        </span>
                      ) : r.action === 'error' ? (
                        <span className="text-red-400">{r.error}</span>
                      ) : (
                        <span className="text-slate-500">{r.action}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-400">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              Not enough competitor data to generate a suggestion. Try refreshing prices first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Top Competitors ─── */}
      {competitors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Competitors ({competitors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="text-left py-1.5 pr-2">Seller</th>
                    <th className="text-right py-1.5 px-2">Price</th>
                    <th className="text-left py-1.5 px-2">Condition</th>
                    <th className="text-left py-1.5 pl-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {competitors.slice(0, 20).map((c: CompetitorPrice) => (
                    <tr key={c.id} className="text-slate-300">
                      <td className="py-1.5 pr-2 truncate max-w-[120px]">{c.seller ?? '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono">
                        {fmtUSD(c.price)}
                      </td>
                      <td className="py-1.5 px-2">{c.condition ?? '—'}</td>
                      <td className="py-1.5 pl-2 text-slate-500">
                        {new Date(c.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
