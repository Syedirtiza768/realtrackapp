import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Save, Loader2, Store as StoreIcon, Globe, CheckCircle2, XCircle, AlertTriangle, Pencil, GripVertical, X, Image as ImageIcon } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fetchWithAuth } from '../../lib/authApi';
import { buildEbayPreview } from '../../lib/listingPreviewMapper';
import { getStoresByChannel, getStoreProfiles } from '../../lib/multiStoreApi';
import { publishToEbay, type PublishResult } from '../../lib/publishApi';
import { getAllImageUrls } from '../../lib/listingsApi';
import type { UploadedImage } from '../../lib/storageApi';
import ImageUploadZone from '../listings/ImageUploadZone';
import ProfileSelectors from './ProfileSelectors';
import { EMPTY_PROFILE_SELECTION, defaultProfileSelection, type ProfileSelection } from './profileUtils';
import type { EbayListing } from '../../lib/ebayFileExchangeParser';
import type { ListingDetail } from '../../types/search';
import type { Store } from '../../types/multiStore';
import { EbayListingPreview } from '../preview/EbayPreviewPage';

/* ── Category suggestion helper ──────────────────────────── */

interface CategorySuggestion {
  id: string;
  name: string;
}

async function fetchCategorySuggestions(q: string): Promise<CategorySuggestion[]> {
  if (!q?.trim()) return [];
  const res = await fetch(`/api/ebay/category/suggest?q=${encodeURIComponent(q.trim())}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions ?? [];
}

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

/* ── Sortable Image Thumbnail ─────────────────────────────── */

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
}

function SortableImage({ id, url, index, onRemove }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative shrink-0 group">
      <div className="w-16 h-16 rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
        <img src={url} alt="" className="w-full h-full object-cover" />
      </div>
      <button
        type="button"
        className="absolute -top-1 -left-1 p-0.5 rounded bg-slate-700 text-white opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={10} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500"
      >
        <X size={10} />
      </button>
      {index === 0 && (
        <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-blue-600 text-white rounded-b px-0.5">
          Primary
        </span>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export default function CatalogProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'success' | 'failed'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [profiles, setProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);

  const { data, isLoading } = useListingDetail(id!);
  const listing = data?.listing;
  const catalogProduct = data?.catalogProduct;
  const sku = listing?.customLabelSku;

  /* ── Image management state ─────────────────────────────── */
  const catalogImages = useMemo(() => {
    if (catalogProduct?.imageUrls?.length) return catalogProduct.imageUrls as string[];
    if (listing?.itemPhotoUrl) return getAllImageUrls(listing.itemPhotoUrl);
    return [];
  }, [catalogProduct?.imageUrls, listing?.itemPhotoUrl]);

  const [localImages, setLocalImages] = useState<string[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingImages, setSavingImages] = useState(false);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);

  useEffect(() => {
    setLocalImages(catalogImages);
    setOrderDirty(false);
  }, [catalogImages]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalImages((prev) => {
      const oldIndex = prev.findIndex((u) => u === active.id);
      const newIndex = prev.findIndex((u) => u === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      setOrderDirty(true);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setLocalImages((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      setOrderDirty(true);
      return next;
    });
  }, []);

  const handleSaveImages = useCallback(async () => {
    if (!catalogProduct?.id || !orderDirty) return;
    setSavingImages(true);
    try {
      await fetchWithAuth(`/api/catalog-products/${catalogProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ imageUrls: localImages }),
      });
      setOrderDirty(false);
      qc.invalidateQueries({ queryKey: ['listing', id] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings', sku] });
    } finally {
      setSavingImages(false);
    }
  }, [catalogProduct?.id, orderDirty, localImages, qc, id, sku]);

  const handleUploadComplete = useCallback(async (uploaded: UploadedImage[]) => {
    if (!catalogProduct?.id || uploaded.length === 0) return;
    const newUrls = uploaded.map((img) => img.cdnUrl).filter(Boolean);
    const merged = [...localImages, ...newUrls];
    setLocalImages(merged);
    setSavingImages(true);
    try {
      await fetchWithAuth(`/api/catalog-products/${catalogProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ imageUrls: merged }),
      });
      setOrderDirty(false);
      setUploadZoneKey((k) => k + 1);
      qc.invalidateQueries({ queryKey: ['listing', id] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings', sku] });
    } finally {
      setSavingImages(false);
    }
  }, [catalogProduct?.id, localImages, qc, id, sku]);

  const { data: mktData, isLoading: mktLoading } = useMarketplaceListings(sku ?? null);
  const { data: stores = [], isLoading: storesLoading } = useEligibleStores();

  // Fetch available profiles when a store is selected
  const { data: storeProfiles } = useQuery({
    queryKey: ['store-profiles', selectedStoreId],
    queryFn: () => getStoreProfiles(selectedStoreId),
    enabled: !!selectedStoreId,
    staleTime: 60_000,
  });

  // Marketplace tab state: allows switching US/AU/DE preview independently of store selection
  const [selectedMktTab, setSelectedMktTab] = useState<string>('US');
  // Available marketplaces from enriched sibling listings + the base listing
  const availableMkts = useMemo<string[]>(() => {
    const mktSet = new Set<string>();
    // Marketplace sibling keys from enriched listings
    if (mktData?.listings) {
      Object.keys(mktData.listings).forEach((mkt) => mktSet.add(mkt));
    }
    // Always include US as default
    mktSet.add('US');
    return Array.from(mktSet).sort();
  }, [mktData?.listings]);

  // Current listing for the selected marketplace tab (preview/edit)
  const currentListing: ListingDetail | null = useMemo(() => {
    return mktData?.listings?.[selectedMktTab] ?? listing ?? null;
  }, [mktData, selectedMktTab, listing]);

  // Initialize override category from listing, reset on store change
  const [overrideCategoryId, setOverrideCategoryId] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  useEffect(() => {
    const init = listing?.categoryId || catalogProduct?.categoryId || currentListing?.categoryId || '';
    setOverrideCategoryId(init);
    setCategorySearch('');
  }, [listing?.categoryId, catalogProduct?.categoryId, currentListing?.categoryId, selectedStoreId]);

  // Auto-fetch category suggestions when category is missing
  const searchTerm = listing?.categoryName || catalogProduct?.categoryName || currentListing?.categoryName || listing?.title || '';
  const { data: categorySuggestions = [] } = useQuery({
    queryKey: ['category-suggestions', searchTerm],
    queryFn: () => fetchCategorySuggestions(searchTerm),
    enabled: !listing?.categoryId && !catalogProduct?.categoryId && !currentListing?.categoryId && searchTerm.length > 0,
    staleTime: 300_000,
  });

  // Resolve selected store object
  const selectedStore = useMemo<Store | null>(() => {
    if (!selectedStoreId) return null;
    return stores.find((s) => s.id === selectedStoreId) ?? null;
  }, [stores, selectedStoreId]);

  // Initialize profiles when storeProfiles or store changes
  useEffect(() => {
    if (!storeProfiles || !selectedStore) {
      setProfiles(EMPTY_PROFILE_SELECTION);
      return;
    }
    const listingProfiles = listing ? {
      shippingProfileName: listing.shippingProfileName ?? null,
      returnProfileName: listing.returnProfileName ?? null,
      paymentProfileName: listing.paymentProfileName ?? null,
    } : null;
    setProfiles(defaultProfileSelection(storeProfiles, selectedStore, listingProfiles));
  }, [storeProfiles, selectedStore, listing]);

  // Derive active marketplace tab from store (used for profiles / publish), but
  // the preview/edit tab is controlled independently via selectedMktTab.
  const storeMktTab = useMemo<string>(() => {
    if (!selectedStore) return 'US';
    return marketplaceIdToTab(selectedStore.marketplaceLabel ?? selectedStore.ebayMarketplaceId);
  }, [selectedStore]);

  // The marketplace context shown in the preview header (derived from the tab)
  const previewMarketplace = selectedMktTab;

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

  // Track inline edit field changes
  const handleFieldChange = (field: string, value: string) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
  };

  // Save all inline edits (shared + marketplace fields)
  const handleSaveInlineEdits = async () => {
    if (Object.keys(editedFields).length === 0) {
      setEditMode(false);
      return;
    }
    setSaving(true);
    try {
      // Shared fields → catalog product
      const sharedFields: Record<string, string> = {};
      const sharedKeys = ['brand', 'mpn', 'oemPartNumber', 'partType', 'placement', 'material', 'features', 'countryOfOrigin'];
      for (const k of sharedKeys) {
        if (editedFields[k] !== undefined) sharedFields[k] = editedFields[k];
      }
      if (Object.keys(sharedFields).length > 0 && catalogProduct?.id) {
        await fetchWithAuth(`/api/catalog-products/${catalogProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(sharedFields),
        });
      }

      // Marketplace fields → listing record
      const mktFields: Record<string, any> = {};
      const mktKeys = ['title', 'description', 'price', 'quantity', 'shippingProfileName', 'returnProfileName', 'paymentProfileName'];
      for (const k of mktKeys) {
        if (editedFields[k] !== undefined) mktFields[k] = editedFields[k];
      }
      if (Object.keys(mktFields).length > 0) {
        const targetId = mktData?.listingIds?.[selectedMktTab] ?? id;
        if (targetId) {
          await fetchWithAuth(`/api/listings/${targetId}`, {
            method: 'PUT',
            body: JSON.stringify({ ...mktFields, version: currentListing?.version ?? 1 }),
          });
        }
      }

      qc.invalidateQueries({ queryKey: ['listing', id] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings', sku] });
      setEditedFields({});
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setEditedFields({});
    setEditMode(false);
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
        categoryId: overrideCategoryId || currentListing.categoryId || '',
        condition: currentListing.conditionId ?? '3000',
        price: parseFloat(currentListing.startPrice ?? '0'),
        quantity: parseInt(currentListing.quantity ?? '0', 10),
        imageUrls: getAllImageUrls(currentListing.itemPhotoUrl),
        aspects: {},
        fulfillmentPolicyId: profiles.fulfillmentPolicyId ?? selectedStore.fulfillmentPolicyId ?? undefined,
        paymentPolicyId: profiles.paymentPolicyId ?? selectedStore.paymentPolicyId ?? undefined,
        returnPolicyId: profiles.returnPolicyId ?? selectedStore.returnPolicyId ?? undefined,
        merchantLocationKey: selectedStore.locationKey ?? undefined,
        requestedFulfillmentPolicyName: profiles.shippingProfileName || undefined,
        requestedReturnPolicyName: profiles.returnProfileName || undefined,
        requestedPaymentPolicyName: profiles.paymentProfileName || undefined,
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
    return <div className="p-10 text-center text-slate-500 dark:text-slate-400">Listing not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <button
        onClick={() => navigate('/catalog')}
        className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Catalog
      </button>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* Marketplace tab switcher + Edit toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              {!mktLoading && availableMkts.length > 1 && availableMkts.map((mkt) => (
                <button
                  key={mkt}
                  onClick={() => {
                    setSelectedMktTab(mkt);
                    setPublishState('idle');
                    setPublishError(null);
                    setPublishResult(null);
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedMktTab === mkt
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Globe size={12} />
                  {mkt}
                </button>
              ))}
            </div>
            {preview && (
              <button
                onClick={() => {
                  if (editMode) {
                    cancelEditing();
                  } else {
                    setEditMode(true);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  editMode
                    ? 'bg-slate-600 text-white hover:bg-slate-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Pencil size={12} />
                {editMode ? 'Done Editing' : 'Edit'}
              </button>
            )}
          </div>

          {/* eBay Preview — WYSIWYG inline editing when editMode is on */}
          {mktLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : preview ? (
            <>
              {selectedStore && !editMode && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
                  <StoreIcon size={14} className="text-blue-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{selectedStore.storeName}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">
                    <Globe size={10} />
                    {marketplaceBadge(selectedStore.marketplaceLabel ?? selectedStore.ebayMarketplaceId)}
                  </span>
                </div>
              )}
              <EbayListingPreview
                listing={preview}
                editable={editMode}
                onFieldChange={handleFieldChange}
                editedFields={editedFields}
                profiles={storeProfiles}
                marketplace={selectedMktTab}
              />
              {/* Floating save/cancel bar when editing */}
              {editMode && (
                <div className="sticky bottom-0 z-10 mt-4 -mx-4 px-4 py-3 bg-slate-900/95 backdrop-blur border-t border-slate-700 flex items-center justify-end gap-3 rounded-b-lg">
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-500 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveInlineEdits}
                    disabled={saving || Object.keys(editedFields).length === 0}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save Changes
                  </button>
                </div>
              )}
            </>
          ) : !mktLoading && currentListing ? (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center text-slate-500 dark:text-slate-400">
              No listing data available for {selectedMktTab} marketplace
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center text-slate-500 dark:text-slate-400">
              <StoreIcon size={32} className="mx-auto mb-3 text-slate-400 dark:text-slate-600" />
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
          {/* Image Manager */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-transparent p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wider">
                Images ({localImages.length})
              </p>
              {orderDirty && (
                <button
                  onClick={handleSaveImages}
                  disabled={savingImages}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                >
                  {savingImages ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                  Save
                </button>
              )}
            </div>

            {localImages.length > 0 ? (
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={localImages} strategy={horizontalListSortingStrategy}>
                  <div className="flex flex-wrap gap-2">
                    {localImages.map((url, i) => (
                      <SortableImage
                        key={url}
                        id={url}
                        url={url}
                        index={i}
                        onRemove={handleRemoveImage}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="flex items-center justify-center h-16 rounded border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600">
                <ImageIcon size={20} />
              </div>
            )}

            <div className="border-t border-slate-200/30 dark:border-slate-700/30 pt-3">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">Upload new images</p>
              <ImageUploadZone
                key={uploadZoneKey}
                onImagesChange={handleUploadComplete}
                maxImages={Math.max(0, 24 - localImages.length)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-transparent p-4 space-y-3">
            {/* Store Selector */}
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wider mb-1.5 block">
                Target Store
              </label>
              {storesLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-2">
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
                  className="w-full bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
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
              <div className="space-y-2 border-t border-slate-200/30 dark:border-slate-700/30 pt-3">
                <ProfileSelectors
                  profiles={storeProfiles}
                  loading={false}
                  storeLabel={selectedStore.storeName}
                  value={profiles}
                  onChange={setProfiles}
                />
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
            <div className="border-t border-slate-200/30 dark:border-slate-700/30 pt-3 space-y-2">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">SKU</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 font-mono">{sku || '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Marketplace</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{selectedStore ? storeMktTab : '—'}</p>
              </div>
              {listing.sourceFileName && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Source File</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{listing.sourceFileName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Imported</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{new Date(listing.importedAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Category ID override */}
            {selectedStore && (
              <div className="border-t border-slate-200/30 dark:border-slate-700/30 pt-3">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wider mb-1.5 block">
                  eBay Category ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={overrideCategoryId}
                    onChange={(e) => setOverrideCategoryId(e.target.value)}
                    placeholder={currentListing?.categoryId || categorySuggestions[0]?.id || 'e.g. 80764'}
                    className="w-full bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    list="category-suggestions"
                  />
                  {categorySuggestions.length > 0 && (
                    <datalist id="category-suggestions">
                      {categorySuggestions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                      ))}
                    </datalist>
                  )}
                </div>
                {!overrideCategoryId && !currentListing?.categoryId && (
                  <div className="mt-1.5 space-y-1">
                    {categorySuggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {categorySuggestions.slice(0, 4).map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setOverrideCategoryId(s.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 transition-colors"
                          >
                            {s.name} ({s.id})
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-400">Required before publishing. Enter an eBay category ID.</p>
                    )}
                  </div>
                )}
              </div>
            )}

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

          </div>
        </div>
      </div>
    </div>
  );
}

export { EbayListingPreview };
