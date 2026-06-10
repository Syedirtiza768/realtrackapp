import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../lib/authApi';
import { buildEbayPreview } from '../../lib/listingPreviewMapper';
import type { EbayListing } from '../../lib/ebayFileExchangeParser';
import type { ListingDetail } from '../../types/search';
import PublishModal from '../channels/PublishModal';
import { EbayListingPreview } from '../preview/EbayPreviewPage';

function useListingDetail(id: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchWithAuth<{ listing: ListingDetail; catalogProduct?: any }>(`/api/listings/${id}`),
    enabled: !!id,
  });
}

interface MarketplaceTabs {
  listingIds: Record<string, string | null>;
  listings: Record<string, ListingDetail | null>;
  catalogProduct: any;
}

function useMarketplaceListings(sku: string | null) {
  return useQuery({
    queryKey: ['marketplace-listings', sku],
    queryFn: async () => {
      if (!sku) return { listingIds: {} as Record<string, string | null>, listings: {} as Record<string, ListingDetail | null>, catalogProduct: null };
      const params = new URLSearchParams({ q: sku, exactSku: sku, limit: '10' });
      const data = await fetchWithAuth<{ items: Array<{ id: string; marketplace?: string }> }>(`/api/listings/search?${params}`);
      const result: MarketplaceTabs = { listingIds: {}, listings: {}, catalogProduct: null };
      for (const item of data.items) {
        const mkt = (item as any).marketplace || 'US';
        result.listingIds[mkt] = (item as any).id || null;
        if ((item as any).id) {
          const detailData = await fetchWithAuth<{ listing: ListingDetail; catalogProduct?: any }>(`/api/listings/${(item as any).id}`);
          result.listings[mkt] = detailData.listing;
          if (detailData.catalogProduct) result.catalogProduct = detailData.catalogProduct;
        }
      }
      return result;
    },
    enabled: !!sku,
  });
}

/* ── Edit Panel ────────────────────────────────────────────── */

function EditPanel({
  listing,
  catalogProduct,
  activeTab,
  onSaveShared,
  onSaveMarketplace,
  saving,
}: {
  listing: ListingDetail;
  catalogProduct: any;
  activeTab: string;
  onSaveShared: (fields: Record<string, any>) => void;
  onSaveMarketplace: (fields: Record<string, any>) => void;
  saving: boolean;
}) {
  const [sharedOpen, setSharedOpen] = useState(false);
  const [mktOpen, setMktOpen] = useState(false);
  const [sharedFields, setSharedFields] = useState<Record<string, string>>({
    brand: catalogProduct?.brand ?? listing.cBrand ?? '',
    mpn: catalogProduct?.mpn ?? listing.cManufacturerPartNumber ?? '',
    oemPartNumber: catalogProduct?.oemPartNumber ?? listing.cOeOemPartNumber ?? '',
    partType: catalogProduct?.partType ?? listing.cType ?? '',
    placement: catalogProduct?.placement ?? '',
    material: catalogProduct?.material ?? '',
    features: catalogProduct?.features ?? listing.cFeatures ?? '',
    countryOfOrigin: catalogProduct?.countryOfOrigin ?? '',
  });
  const [mktFields, setMktFields] = useState<Record<string, string>>({
    title: listing.title ?? '',
    description: listing.description ?? '',
    price: listing.startPrice ?? '',
    quantity: listing.quantity ?? '',
    shippingProfile: listing.shippingProfileName ?? '',
    returnProfile: listing.returnProfileName ?? '',
    paymentProfile: listing.paymentProfileName ?? '',
  });

  const Section = ({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-800/40 transition-colors">
        {label}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );

  const Field = ({ label, field, value, onChange, multiline }: { label: string; field: string; value: string; onChange: (v: string) => void; multiline?: boolean }) => (
    <div>
      <label className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full mt-0.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-0.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-2 mt-3">
      <p className="text-xs text-slate-400 font-medium">Edit</p>

      <Section label="Shared Fields (syncs to all marketplaces)" open={sharedOpen} onToggle={() => setSharedOpen(!sharedOpen)}>
        <Field label="Brand" field="brand" value={sharedFields.brand} onChange={(v) => setSharedFields({ ...sharedFields, brand: v })} />
        <Field label="MPN" field="mpn" value={sharedFields.mpn} onChange={(v) => setSharedFields({ ...sharedFields, mpn: v })} />
        <Field label="OEM Part #" field="oemPartNumber" value={sharedFields.oemPartNumber} onChange={(v) => setSharedFields({ ...sharedFields, oemPartNumber: v })} />
        <Field label="Type" field="partType" value={sharedFields.partType} onChange={(v) => setSharedFields({ ...sharedFields, partType: v })} />
        <Field label="Placement" field="placement" value={sharedFields.placement} onChange={(v) => setSharedFields({ ...sharedFields, placement: v })} />
        <Field label="Material" field="material" value={sharedFields.material} onChange={(v) => setSharedFields({ ...sharedFields, material: v })} />
        <Field label="Features" field="features" value={sharedFields.features} onChange={(v) => setSharedFields({ ...sharedFields, features: v })} />
        <Field label="Country of Origin" field="countryOfOrigin" value={sharedFields.countryOfOrigin} onChange={(v) => setSharedFields({ ...sharedFields, countryOfOrigin: v })} />
        <button
          onClick={() => onSaveShared(sharedFields)}
          disabled={saving}
          className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save size={12} />}
          Save Shared Fields
        </button>
      </Section>

      <Section label={`${activeTab} Marketplace Fields`} open={mktOpen} onToggle={() => setMktOpen(!mktOpen)}>
        <Field label="Title" field="title" value={mktFields.title} onChange={(v) => setMktFields({ ...mktFields, title: v })} />
        <Field label="Description" field="description" value={mktFields.description} onChange={(v) => setMktFields({ ...mktFields, description: v })} multiline />
        <Field label="Price" field="price" value={mktFields.price} onChange={(v) => setMktFields({ ...mktFields, price: v })} />
        <Field label="Quantity" field="quantity" value={mktFields.quantity} onChange={(v) => setMktFields({ ...mktFields, quantity: v })} />
        <Field label="Shipping Profile" field="shippingProfile" value={mktFields.shippingProfile} onChange={(v) => setMktFields({ ...mktFields, shippingProfile: v })} />
        <Field label="Return Profile" field="returnProfile" value={mktFields.returnProfile} onChange={(v) => setMktFields({ ...mktFields, returnProfile: v })} />
        <Field label="Payment Profile" field="paymentProfile" value={mktFields.paymentProfile} onChange={(v) => setMktFields({ ...mktFields, paymentProfile: v })} />
        <button
          onClick={() => onSaveMarketplace(mktFields)}
          disabled={saving}
          className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save size={12} />}
          Save {activeTab} Fields
        </button>
      </Section>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export default function CatalogProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'US' | 'AU' | 'DE'>('US');
  const [publishListingId, setPublishListingId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useListingDetail(id!);
  const listing = data?.listing;
  const catalogProduct = data?.catalogProduct;
  const sku = listing?.customLabelSku;

  const { data: mktData } = useMarketplaceListings(sku ?? null);

  const currentListing: ListingDetail | null = mktData?.listings?.[activeTab] ?? listing ?? null;

  const preview: EbayListing | null = currentListing
    ? buildEbayPreview(currentListing, mktData?.catalogProduct ?? catalogProduct ?? null)
    : null;

  const handleSaveShared = async (fields: Record<string, any>) => {
    if (!catalogProduct?.id) return;
    setSaving(true);
    try {
      await fetchWithAuth(`/api/catalog-products/${catalogProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      qc.invalidateQueries({ queryKey: ['listing', id] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings', sku] });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMarketplace = async (fields: Record<string, any>) => {
    const targetId = mktData?.listingIds?.[activeTab] ?? id;
    if (!targetId) return;
    setSaving(true);
    try {
      await fetchWithAuth(`/api/listings/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...fields, version: currentListing?.version ?? 1 }),
      });
      qc.invalidateQueries({ queryKey: ['listing', id] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings', sku] });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-10 text-center text-slate-400">Listing not found</div>
    );
  }

  const tabs: Array<'US' | 'AU' | 'DE'> = ['US', 'AU', 'DE'];
  const hasMarketplaceData = mktData && tabs.some((t) => mktData.listings?.[t]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <button
        onClick={() => navigate('/catalog')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Catalog
      </button>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* Marketplace tabs */}
          <div className="flex border-b border-slate-700/50 mb-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'US' ? 'US' : tab === 'AU' ? 'AU' : 'DE'}
                {mktData?.listings?.[tab] ? null : (
                  <span className="ml-1.5 text-[10px] text-amber-400">(no data)</span>
                )}
              </button>
            ))}
          </div>

          {/* eBay Preview */}
          {preview ? (
            <EbayListingPreview listing={preview} />
          ) : (
            <div className="border border-slate-700 rounded-lg p-8 text-center text-slate-400">
              No listing data available for {activeTab} marketplace
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-80 shrink-0 space-y-3">
          <div className="rounded-lg border border-slate-700/50 p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500">SKU</p>
              <p className="text-sm text-slate-200 font-mono">{sku || '\u2014'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Marketplace</p>
              <p className="text-sm text-slate-200">{activeTab}</p>
            </div>
            {listing.sourceFileName && (
              <div>
                <p className="text-xs text-slate-500">Source File</p>
                <p className="text-xs text-slate-400">{listing.sourceFileName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500">Imported</p>
              <p className="text-xs text-slate-400">{new Date(listing.importedAt).toLocaleDateString()}</p>
            </div>

            <button
              onClick={() => {
                const targetId = hasMarketplaceData
                  ? mktData?.listingIds?.[activeTab] ?? id!
                  : id!;
                setPublishListingId(targetId);
                setPublishOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <Send size={14} />
              Publish to eBay {activeTab}
            </button>

            <button
              onClick={() => setEditOpen(!editOpen)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              {editOpen ? 'Hide Editor' : 'Edit Fields'}
            </button>

            {editOpen && (
              <EditPanel
                listing={currentListing ?? listing}
                catalogProduct={mktData?.catalogProduct ?? catalogProduct}
                activeTab={activeTab}
                onSaveShared={handleSaveShared}
                onSaveMarketplace={handleSaveMarketplace}
                saving={saving}
              />
            )}
          </div>
        </div>
      </div>

      {publishOpen && publishListingId && (
        <PublishModal
          mode="single"
          listing={{ id: publishListingId } as any}
          open={publishOpen}
          onClose={() => { setPublishOpen(false); setPublishListingId(null); }}
        />
      )}
    </div>
  );
}

export { EbayListingPreview };
