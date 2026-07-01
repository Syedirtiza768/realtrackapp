import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Store,
  Package,
  DollarSign,
  Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  usePublishedListing,
  revisePublishedListing,
  endPublishedListing,
  refreshPublishedListing,
  refreshCompetitorPricing,
} from '../../lib/publishedListingsApi';
import { getEbayWorkspace } from '../../lib/ebayIntegrationsApi';
import { usePermissions } from '../../hooks/usePermissions';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function PublishedListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { has } = usePermissions();
  const canManage = has('published_listings.manage');
  const canSync = has('published_listings.sync');
  const qc = useQueryClient();

  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const { data: workspace } = useQuery({
    queryKey: ['ebay-workspace'],
    queryFn: getEbayWorkspace,
  });

  useEffect(() => {
    if (workspace?.organizationId) setOrganizationId(workspace.organizationId);
  }, [workspace]);

  const { data: listing, isLoading, refetch } = usePublishedListing(id ?? '', organizationId);

  useEffect(() => {
    if (listing) {
      setEditPrice(listing.price ?? '');
      setEditQty(String(listing.quantityAvailable));
      setEditTitle(listing.title);
    }
  }, [listing]);

  const handleSave = async () => {
    if (!id || !organizationId) return;
    setSaving(true);
    setMessage('');
    try {
      await revisePublishedListing(
        id,
        {
          title: editTitle !== listing?.title ? editTitle : undefined,
          price: editPrice !== listing?.price ? Number(editPrice) : undefined,
          quantity: Number(editQty) !== listing?.quantityAvailable ? Number(editQty) : undefined,
        },
        organizationId,
      );
      setMessage('Listing updated on eBay.');
      qc.invalidateQueries({ queryKey: ['published-listing', id] });
      refetch();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEnd = async () => {
    if (!id || !organizationId || !confirm('End this listing on eBay?')) return;
    await endPublishedListing(id, organizationId);
    refetch();
  };

  const handleRefresh = async () => {
    if (!id || !organizationId) return;
    await refreshPublishedListing(id, organizationId);
    refetch();
  };

  const handleCompetitorRefresh = async () => {
    if (!id || !organizationId) return;
    await refreshCompetitorPricing(id, organizationId);
    refetch();
  };

  const competitor = listing?.performanceMetrics?.competitorPricing as {
    medianPrice?: number | null;
    avgPrice?: number | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    sampleCount?: number;
    searchQuery?: string;
    fetchedAt?: string;
    topCompetitors?: Array<{ title: string | null; price: number | null }>;
  } | undefined;

  if (isLoading || !listing) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <Link to="/published-listings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-500">
        <ArrowLeft size={16} /> Back to Published Listings
      </Link>

      <div className="flex flex-col md:flex-row md:items-start gap-6">
        <div className="flex-shrink-0 space-y-2">
          {(listing.imageUrls ?? []).length > 0 ? (
            listing.imageUrls.map((url, i) => (
              <img
                key={url}
                src={url}
                alt=""
                className={`rounded-lg border border-slate-200 dark:border-slate-700 object-cover ${
                  i === 0 ? 'w-48 h-48' : 'w-20 h-20'
                }`}
              />
            ))
          ) : (
            <div className="w-48 h-48 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Package size={32} className="text-slate-400" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{listing.title}</h1>
              <div className="flex gap-2">
                {canSync && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm inline-flex items-center"
                    onClick={handleCompetitorRefresh}
                  >
                    <DollarSign size={14} className="mr-1" /> Market price
                  </button>
                )}
                {canSync && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm inline-flex items-center"
                    onClick={handleRefresh}
                  >
                    <RefreshCw size={14} className="mr-1" /> Refresh
                  </button>
                )}
                {listing.listingUrl && (
                  <a href={listing.listingUrl} target="_blank" rel="noreferrer">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm inline-flex items-center"
                    >
                      <ExternalLink size={14} className="mr-1" /> eBay
                    </button>
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{listing.listingStatus}</Badge>
              <Badge variant="outline">{listing.marketplaceId}</Badge>
              {listing.ebayItemId && <Badge variant="outline">#{listing.ebayItemId}</Badge>}
            </div>
            <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
              <Store size={14} /> {listing.accountDisplayName}
            </p>
          </div>

          {listing.healthFlags?.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="pt-4 space-y-1">
                {listing.healthFlags.map((f) => (
                  <div key={f.code} className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <span>{f.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base">Quick revise</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <input
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="Price"
                  />
                  <input
                    type="number"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    placeholder="Quantity"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save to eBay'}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
                    onClick={handleEnd}
                  >
                    End listing
                  </button>
                </div>
                {message && <p className="text-sm text-emerald-500">{message}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {competitor?.medianPrice != null && (
          <Card>
            <CardHeader><CardTitle className="text-base">Market pricing (Browse API)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Search</span><span className="text-right max-w-[60%] truncate">{competitor.searchQuery}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Median</span><span>${competitor.medianPrice?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Average</span><span>${competitor.avgPrice?.toFixed(2) ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Range</span><span>${competitor.minPrice?.toFixed(2)} – ${competitor.maxPrice?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Samples</span><span>{competitor.sampleCount ?? 0}</span></div>
              {competitor.fetchedAt && (
                <div className="text-xs text-slate-400 pt-1">Updated {new Date(competitor.fetchedAt).toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Inventory & pricing</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">SKU</span><span className="font-mono">{listing.sku ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Price</span><span>${Number(listing.price ?? 0).toFixed(2)} {listing.currency}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Available</span><span>{listing.quantityAvailable}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sold</span><span>{listing.quantitySold}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Condition</span><span>{listing.condition ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Format</span><span>{listing.listingFormat}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Last synced</span><span>{listing.lastSyncedAt ? new Date(listing.lastSyncedAt).toLocaleString() : '—'}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Item specifics</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(listing.itemSpecifics ?? {}).length === 0 ? (
              <p className="text-sm text-slate-500">None</p>
            ) : (
              <dl className="space-y-1 text-sm">
                {Object.entries(listing.itemSpecifics).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-slate-500 min-w-[100px]">{k}</dt>
                    <dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      {listing.description && (
        <Card>
          <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
              dangerouslySetInnerHTML={{ __html: listing.description }}
            />
          </CardContent>
        </Card>
      )}

      {listing.compatibility && (
        <Card>
          <CardHeader><CardTitle className="text-base">Vehicle compatibility</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto max-h-64 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
              {JSON.stringify(listing.compatibility, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {listing.rawEbayResponse && (
        <Card>
          <CardHeader><CardTitle className="text-base">Raw eBay API response</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto max-h-96 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
              {JSON.stringify(listing.rawEbayResponse, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
