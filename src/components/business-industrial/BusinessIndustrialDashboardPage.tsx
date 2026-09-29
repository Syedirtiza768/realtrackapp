import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import FeedbackPanel from '../ui/FeedbackPanel';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { EmptyState, ErrorState, LoadingPlaceholder } from '../ui/StatusBlock';

type Workspace = {
  metrics: { listingCount: number; draftCount: number; pendingReviewCount: number; openIncidentCount: number };
  stores: { id: string; storeName: string; status: string }[];
};

const METRICS: Array<{ key: keyof Workspace['metrics']; label: string; to: string; tone?: 'warning' | 'destructive' }> = [
  { key: 'listingCount', label: 'Listings', to: '/business-industrial/catalog' },
  { key: 'draftCount', label: 'Drafts', to: '/business-industrial/catalog' },
  { key: 'pendingReviewCount', label: 'Pending review', to: '/business-industrial/review', tone: 'warning' },
  { key: 'openIncidentCount', label: 'Open incidents', to: '/business-industrial/incidents', tone: 'destructive' },
];

export default function BusinessIndustrialDashboardPage() {
  const { has } = usePermissions();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    void fetchWithAuth<Workspace>('/api/business-industrial/workspace')
      .then((result) => { setData(result); setError(''); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load workspace'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        eyebrow="Business & Industrial vertical"
        title="Operational overview"
        subtitle="Manage industrial catalog data, compliance evidence, shipping readiness, and dedicated seller stores."
      >
        {has('business_industrial.listings.create') ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}
            to="/business-industrial/listings/editor"
          >
            Create listing
          </Link>
        ) : null}
      </WorkspacePageHeader>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading && !data ? <LoadingPlaceholder label="Loading Business and Industrial workspace" rows={4} /> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((metric) => (
              <Link key={metric.key} to={metric.to} className="block focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as string]: 'var(--brand-primary)' }}>
                <Card className="h-full transition-colors hover:border-slate-300 dark:hover:border-slate-600">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">{metric.label}</p>
                    <p className={`mt-2 text-3xl font-semibold ${metric.tone === 'destructive' ? 'text-red-600' : metric.tone === 'warning' ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>
                      {data.metrics[metric.key]}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Dedicated B&amp;I stores</h2>
              <Link className="text-sm font-medium" style={{ color: 'var(--brand-primary)' }} to="/business-industrial/stores">Manage stores</Link>
            </div>
            {data.stores.length ? (
              <ul className="mt-3 space-y-2">
                {data.stores.map((store) => (
                  <li className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800" key={store.id}>
                    <span className="min-w-0 truncate">{store.storeName}</span>
                    <Badge variant={store.status === 'active' ? 'success' : 'secondary'}>{store.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No dedicated seller store is connected yet" description="Open Stores to connect a Business & Industrial eBay seller." />
            )}
          </section>
        </>
      ) : null}
      {!loading && !error && !data ? <FeedbackPanel tone="warning">Workspace metrics are unavailable.</FeedbackPanel> : null}
    </div>
  );
}
