import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, ChevronDown, ChevronUp, Save, Loader2, Store as StoreIcon, Globe, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../lib/authApi';
import { buildEbayPreview } from '../../lib/listingPreviewMapper';
import { getStoresByChannel, getStoreProfiles, type StoreProfiles } from '../../lib/multiStoreApi';
import { publishToEbay, type PublishResult } from '../../lib/publishApi';
import { getAllImageUrls } from '../../lib/listingsApi';
import type { EbayListing } from '../../lib/ebayFileExchangeParser';
import type { ListingDetail } from '../../types/search';
import type { Store } from '../../types/multiStore';
import { EbayListingPreview } from '../preview/EbayPreviewPage';

/* ── Helpers ──────────────────────────────────────────────── */

function marketplaceIdToTab(mkt: string | null | undefined): string {
  if (!mkt) return 'US';
  if (mkt.includes('_AU')) return 'AU';
  if (mkt.includes('_DE')) return 'DE';
  return 'US';
}

function marketplaceBadge(mkt: string | null | undefined): string {
  return marketplaceIdToTab(mkt);
}

/* ── Hooks ────────────────────────────────────────────────── */

function useListingDetail(id: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchWithAuth<{ listing: ListingDetail; catalogProduct?: any }>(`/api/listings/${id}`),
    enabled: !!id,
  });
}

function useMarketplaceListings(sku: string | null) {
  return useQuery({
    queryKey: ['marketplace-listings', sku],
    queryFn: async () => {
      if (!sku) return { listingIds: {} as Record<string, string | null>, listings: {} as Record<string, ListingDetail | null>, catalogProduct: null };
      const params = new URLSearchParams({ q: sku, exactSku: sku, limit: '10' });
      const data = await fetchWithAuth<{ items: Array<{ id: string; marketplace?: string }> }>(`/api/listings/search?${params}`);
      const listingIds: Record<string, string | null> = {};
      const listings: Record<string, ListingDetail | null> = {};
      let catalogProduct: any = null;
      for (const item of data.items) {
        const mkt = (item as any).marketplace || 'US';
        listingIds[mkt] = (item as any).id || null;
        if ((item as any).id) {
          const detailData = await fetchWithAuth<{ listing: ListingDetail; catalogProduct?: any }>(`/api/listings/${(item as any).id}`);
          listings[mkt] = detailData.listing;
          if (detailData.catalogProduct) catalogProduct = detailData.catalogProduct;
        }
      }
      return { listingIds, listings, catalogProduct };
    },
    enabled: !!sku,
  });
}

function useEligibleStores() {
  return useQuery({
    queryKey: ['ebay-stores-eligible'],
    queryFn: () => getStoresByChannel('ebay'),
    staleTime: 60_000,
  });
}

/* ── Edit Panel ────────────────────────────────────────────── */

function EditPanel({
  listing,
  catalogProduct,
  activeTab,
  selectedStore,
  storeProfiles,
  onSaveShared,
  onSaveMarketplace,
  saving,
}: {
  listing: ListingDetail;
  catalogProduct: any;
  activeTab: string;
  selectedStore: Store | null;
  storeProfiles?: StoreProfiles;
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
    shippingProfileName: listing.shippingProfileName ?? '',
    returnProfileName: listing.returnProfileName ?? '',
    paymentProfileName: listing.paymentProfileName ?? '',
  });

  // When the selected store changes, update profiles from it
  const prevStoreId = useRef<string | null>(null);
  if (selectedStore?.id !== prevStoreId.current) {
    prevStoreId.current = selectedStore?.id ?? null;
    if (selectedStore) {
      setMktFields((prev) => ({
        ...prev,
        shippingProfileName: selectedStore.fulfillmentPolicyName ?? selectedStore.fulfillmentPolicyId ?? prev.shippingProfileName,
        returnProfileName: selectedStore.returnPolicyName ?? selectedStore.returnPolicyId ?? prev.returnProfileName,
        paymentProfileName: selectedStore.paymentPolicyName ?? selectedStore.paymentPolicyId ?? prev.paymentProfileName,
      }));
    }
  }

  const Section = ({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:bg-slate-800/40 transition-colors">
        {label}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );

  const Field = ({ label, field, value, onChange, multiline, readOnly }: { label: string; field: string; value: string; onChange: (v: string) => void; multiline?: boolean; readOnly?: boolean }) => (
    <div>
      <label className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          readOnly={readOnly}
          className="w-full mt-0.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          className="w-full mt-0.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-2 mt-3">
      <p className="text-xs text-slate-300 font-medium">Edit</p>

      <Section label="Shared Fields" open={sharedOpen} onToggle={() => setSharedOpen(!sharedOpen)}>
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
        {/* Shipping Profile Select */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Shipping Profile</label>
          <select
            value={mktFields.shippingProfileName}
            onChange={(e) => setMktFields({ ...mktFields, shippingProfileName: e.target.value })}
            className="w-full mt-0.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60"
          >
            <option value="">— Store default —</option>
            {(storeProfiles?.shippingProfiles ?? []).map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        {/* Return Profile Select */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Return Profile</label>
          <select
            value={mktFields.returnProfileName}
            onChange={(e) => setMktFields({ ...mktFields, returnProfileName: e.target.value })}
            className="w-full mt-0.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60"
          >
            <option value="">— Store default —</option>
            {(storeProfiles?.returnProfiles ?? []).map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        {/* Payment Profile Select */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Payment Profile</label>
          <select
            value={mktFields.paymentProfileName}
            onChange={(e) => setMktFields({ ...mktFields, paymentProfileName: e.target.value })}
            className="w-full mt-0.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60"
          >
            <option value="">— Store default —</option>
            {(storeProfiles?.paymentProfiles ?? []).map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
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
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'success' | 'failed'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  const { data, isLoading } = useListingDetail(id!);
  const listing = data?.listing;
  const catalogProduct = data?.catalogProduct;
  const sku = listing?.customLabelSku;

  const { data: mktData, isLoading: mktLoading } = useMarketplaceListings(sku ?? null);
  const { data: stores = [], isLoading: storesLoading } = useEligibleStores();

  // Fetch available profiles when a store is selected
  const { data: storeProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['store-profiles', selectedStoreId],
    queryFn: () => getStoreProfiles(selectedStoreId),
    enabled: !!selectedStoreId,
    staleTime: 30_000,
  });

  // Resolve selected store object
  const selectedStore = useMemo<Store | null>(() => {
    if (!selectedStoreId) return null;
    return stores.find((s) => s.id === selectedStoreId) ?? null;
  }, [stores, selectedStoreId]);

  // Derive active marketplace tab from selected store
  const activeTab = useMemo<string>(() => {
    if (!selectedStore) return 'US';
    return marketplaceIdToTab(selectedStore.marketplaceLabel ?? selectedStore.ebayMarketplaceId);
  }, [selectedStore]);

  // Current listing for the active tab
  const currentListing: ListingDetail | null = useMemo(() => {
    if (!selectedStore) return listing ?? null;
    return mktData?.listings?.[activeTab] ?? listing ?? null;
  }, [selectedStore, mktData, activeTab, listing]);

  // Build eBay preview
  const preview: EbayListing | null = useMemo(() => {
    if (!currentListing) return null;
    return buildEbayPreview(currentListing, mktData?.catalogProduct ?? catalogProduct ?? null);
  }, [currentListing, mktData, catalogProduct]);

  // Validation
  const validationErrors = useMemo<string[]>(() => {
    const errors: string[] = [];
    if (!selectedStore) errors.push('No store selected');
    if (!currentListing?.title) errors.push('Missing title');
    if (!currentListing?.startPrice) errors.push('Missing price');
    if (!currentListing?.quantity) errors.push('Missing quantity');
    if (!getAllImageUrls(currentListing?.itemPhotoUrl).length) errors.push('No images');
    return errors;
  }, [selectedStore, currentListing]);

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

  const handlePublish = async () => {
    if (!selectedStore || !currentListing || !id) return;
    setPublishState('publishing');
    setPublishError(null);
    setPublishResult(null);

    try {
      const res = await publishToEbay({
        listingId: id,
        storeIds: [selectedStore.id],
        sku: currentListing.customLabelSku ?? id,
        title: currentListing.title ?? '',
        description: currentListing.description ?? '',
        categoryId: currentListing.categoryId ?? '',
        condition: currentListing.conditionId ?? '3000',
        price: parseFloat(currentListing.startPrice ?? '0'),
        quantity: parseInt(currentListing.quantity ?? '0', 10),
        imageUrls: getAllImageUrls(currentListing.itemPhotoUrl),
        aspects: {},
        fulfillmentPolicyId: selectedStore.fulfillmentPolicyId ?? undefined,
        paymentPolicyId: selectedStore.paymentPolicyId ?? undefined,
        returnPolicyId: selectedStore.returnPolicyId ?? undefined,
        merchantLocationKey: selectedStore.locationKey ?? undefined,
      });

      const first = res?.[0];
      if (first?.success) {
        setPublishState('success');
        setPublishResult(first);
      } else {
        setPublishState('failed');
        setPublishError(first?.error ?? 'Publish failed');
      }
    } catch (err: unknown) {
      setPublishState('failed');
      setPublishError(err instanceof Error ? err.message : 'Unknown error');
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
    return <div className="p-10 text-center text-slate-400">Listing not found</div>;
  }

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
          {/* Store + Marketplace context header */}
          {selectedStore && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <StoreIcon size={14} className="text-blue-400" />
              <span className="text-sm text-slate-200 font-medium">{selectedStore.storeName}</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">
                <Globe size={10} />
                {marketplaceBadge(selectedStore.marketplaceLabel ?? selectedStore.ebayMarketplaceId)}
              </span>
            </div>
          )}

          {/* eBay Preview */}
          {selectedStore && preview ? (
            <EbayListingPreview listing={preview} />
          ) : selectedStore && !preview && !mktLoading ? (
            <div className="border border-slate-700 rounded-lg p-8 text-center text-slate-400">
              No listing data available for {activeTab} marketplace
            </div>
          ) : mktLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="border border-slate-700 rounded-lg p-8 text-center text-slate-400">
              <StoreIcon size={32} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm">Select a store from the sidebar to preview and publish</p>
            </div>
          )}

          {/* Publish result */}
          {publishState === 'success' && publishResult && (
            <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-800/60 bg-emerald-950/20 text-sm">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-300">
                Published to {selectedStore?.storeName}
                {publishResult.offerId ? ` (Offer: ${publishResult.offerId})` : ''}
                {publishResult.listingId ? ` · Listing: ${publishResult.listingId}` : ''}
              </span>
            </div>
          )}
          {publishState === 'failed' && (
            <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-lg border border-red-800/60 bg-red-950/20 text-sm">
              <XCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-red-300">{publishError || 'Publish failed'}</span>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-80 shrink-0 space-y-3">
          <div className="rounded-lg border border-slate-700/50 p-4 space-y-3">
            {/* Store Selector */}
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5 block">
                Target Store
              </label>
              {storesLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 size={12} className="animate-spin" />
                  Loading stores...
                </div>
              ) : stores.length === 0 ? (
                <div className="text-xs text-amber-400 py-1">
                  No eligible eBay stores found. Connect a store via Settings → Integrations.
                </div>
              ) : (
                <select
                  value={selectedStoreId}
                  onChange={(e) => {
                    setSelectedStoreId(e.target.value);
                    setPublishState('idle');
                    setPublishError(null);
                    setPublishResult(null);
                  }}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded px-2 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  <option value="">— Select a store —</option>
                  {stores.map((store) => {
                    const badge = marketplaceBadge(store.marketplaceLabel ?? store.ebayMarketplaceId);
                    return (
                      <option key={store.id} value={store.id}>
                        {store.storeName} ({badge})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Profiles from selected store / listing override */}
            {selectedStore && (
              <div className="space-y-2 border-t border-slate-700/30 pt-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Profiles</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Shipping</span>
                    <span className="text-[11px] text-slate-200 font-mono truncate max-w-[140px] text-right">
                      {currentListing?.shippingProfileName
                        ? (currentListing.shippingProfileName !== selectedStore.fulfillmentPolicyName
                          ? <><span className="text-blue-300">{currentListing.shippingProfileName}</span><span className="text-[9px] text-blue-400 ml-1">●</span></>
                          : currentListing.shippingProfileName)
                        : (selectedStore.fulfillmentPolicyName ?? selectedStore.fulfillmentPolicyId ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Payment</span>
                    <span className="text-[11px] text-slate-200 font-mono truncate max-w-[140px] text-right">
                      {currentListing?.paymentProfileName
                        ? (currentListing.paymentProfileName !== selectedStore.paymentPolicyName
                          ? <><span className="text-blue-300">{currentListing.paymentProfileName}</span><span className="text-[9px] text-blue-400 ml-1">●</span></>
                          : currentListing.paymentProfileName)
                        : (selectedStore.paymentPolicyName ?? selectedStore.paymentPolicyId ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Return</span>
                    <span className="text-[11px] text-slate-200 font-mono truncate max-w-[140px] text-right">
                      {currentListing?.returnProfileName
                        ? (currentListing.returnProfileName !== selectedStore.returnPolicyName
                          ? <><span className="text-blue-300">{currentListing.returnProfileName}</span><span className="text-[9px] text-blue-400 ml-1">●</span></>
                          : currentListing.returnProfileName)
                        : (selectedStore.returnPolicyName ?? selectedStore.returnPolicyId ?? '—')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Validation warnings */}
            {selectedStore && validationErrors.length > 0 && publishState === 'idle' && (
              <div className="border border-amber-800/60 bg-amber-950/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-amber-300 font-medium">Validation</p>
                  <ul className="text-[10px] text-amber-400/70 mt-0.5 list-disc pl-3">
                    {validationErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Listing info */}
            <div className="border-t border-slate-700/30 pt-3 space-y-2">
              <div>
                <p className="text-xs text-slate-400">SKU</p>
                <p className="text-sm text-slate-200 font-mono">{sku || '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Marketplace</p>
                <p className="text-sm text-slate-200">{selectedStore ? activeTab : '—'}</p>
              </div>
              {listing.sourceFileName && (
                <div>
                  <p className="text-xs text-slate-400">Source File</p>
                  <p className="text-xs text-slate-300">{listing.sourceFileName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">Imported</p>
                <p className="text-xs text-slate-300">{new Date(listing.importedAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Publish Button */}
            <button
              onClick={handlePublish}
              disabled={!selectedStore || publishState === 'publishing'}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {publishState === 'publishing' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {publishState === 'publishing'
                ? `Publishing to ${selectedStore?.storeName ?? '...'}`
                : selectedStore
                  ? `Publish to ${selectedStore.storeName}`
                  : 'Select a store to publish'}
            </button>

            <button
              onClick={() => setEditOpen(!editOpen)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              {editOpen ? 'Hide Editor' : 'Edit Fields'}
            </button>

            {editOpen && currentListing && (
              <EditPanel
                listing={currentListing}
                catalogProduct={mktData?.catalogProduct ?? catalogProduct}
                activeTab={activeTab}
                selectedStore={selectedStore}
                storeProfiles={storeProfiles}
                onSaveShared={handleSaveShared}
                onSaveMarketplace={handleSaveMarketplace}
                saving={saving}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { EbayListingPreview };
