import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Copy,
  Check,
  Car,
  AlertTriangle,
  Workflow,
  ExternalLink,
  Loader2,
  Upload,
  CheckCircle2,
  GripVertical,
  Save,
  MapPin,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '../ui/badge';
import { useInventoryDetail, useInlineEnrichListing, useEnrichmentStatus, useUpdateInventoryImages, useRetryInventoryEnrichment, useReorderInventoryImages } from '../../lib/inventoryApi';
import { fetchWithAuth } from '../../lib/authApi';
import { usePermissions } from '../../hooks/usePermissions';
import ImageUploadZone from '../listings/ImageUploadZone';
import type { UploadedImage } from '../../lib/storageApi';

interface Props {
  listingId: string | null;
  onClose: () => void;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  if (value == null || value === '') return null;
  return (
    <tr>
      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</td>
      <td
        className={`px-3 py-2 text-slate-800 dark:text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </td>
    </tr>
  );
}

function stageLabel(stage: string | null): string {
  const labels: Record<string, string> = {
    vision_lookup: 'Detecting part from photos...',
    enrichment: 'Enriching listing...',
    generating_us: 'Generating US eBay listing...',
    generating_au: 'Generating AU eBay listing...',
    generating_de: 'Generating DE eBay listing...',
    needs_review: 'Needs review (category or fitment)',
    failed: 'Enrichment failed',
    completed: 'Enriched',
  };
  return stage ? (labels[stage] ?? 'Enriching...') : 'Enriching...';
}

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  isActive: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableImage({ id, url, index, isActive, canEdit, onSelect, onRemove }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative shrink-0 group">
      <button
        type="button"
        onClick={onSelect}
        className={`w-14 h-14 rounded border overflow-hidden block ${
          isActive
            ? 'border-blue-500 ring-1 ring-blue-500'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <img src={url} alt="" className="w-full h-full object-cover" />
      </button>
      {canEdit && (
        <>
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
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500"
          >
            <X size={10} />
          </button>
          {index === 0 && (
            <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-blue-600 text-white rounded-b px-0.5">
              Primary
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default function InventoryDetailModal({ listingId, onClose }: Props) {
  const { data, isLoading, refetch } = useInventoryDetail(listingId);
  const inlineEnrich = useInlineEnrichListing();
  const retryEnrich = useRetryInventoryEnrichment();
  const updateImages = useUpdateInventoryImages();
  const reorderImages = useReorderInventoryImages();
  const { has: hasPermission } = usePermissions();
  const canUploadImages = hasPermission('listings.update');

  const images = data?.imageUrls ?? [];
  const [activeImg, setActiveImg] = useState(0);
  const [copiedSku, setCopiedSku] = useState(false);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);
  const [stagedImages, setStagedImages] = useState<UploadedImage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [enrichingListingId, setEnrichingListingId] = useState<string | null>(null);

  const [editingLocation, setEditingLocation] = useState(false);
  const [locationValue, setLocationValue] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [editingSku, setEditingSku] = useState(false);
  const [skuValue, setSkuValue] = useState('');
  const [skuSaving, setSkuSaving] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  const qc = useQueryClient();
  const canEditListing = hasPermission('listings.update');

  // Local image order state for drag-and-drop reordering
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);

  // Sync local images when data loads
  useEffect(() => {
    setLocalImages(images);
    setOrderDirty(false);
  }, [data?.imageUrls]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalImages((prev) => {
      const oldIndex = prev.findIndex((u) => u === active.id);
      const newIndex = prev.findIndex((u) => u === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      setOrderDirty(true);
      return reordered;
    });
  }, []);

  const handleRemoveImage = useCallback((url: string) => {
    setLocalImages((prev) => {
      const next = prev.filter((u) => u !== url);
      setOrderDirty(true);
      return next;
    });
    setActiveImg((prev) => Math.min(prev, Math.max(0, localImages.length - 2)));
  }, [localImages.length]);

  const handleSaveOrder = useCallback(async () => {
    if (!listingId || !orderDirty) return;
    try {
      await reorderImages.mutateAsync({ listingId, imageUrls: localImages });
      setOrderDirty(false);
      await refetch();
    } catch {
      // error handled by mutation
    }
  }, [listingId, orderDirty, localImages, reorderImages, refetch]);

  // Poll enrichment status when actively enriching
  const enrichStatusPoll = useEnrichmentStatus(enrichingListingId);
  const enrichStage = enrichStatusPoll.data?.stage ?? null;
  const enrichStatus = enrichStatusPoll.data?.status ?? null;

  const isEnriching = enrichStatus === 'enriching';
  const enrichCompleted = enrichStatus === 'completed';
  const enrichNeedsReview = enrichStatus === 'needs_review';
  const enrichFailed = enrichStatus === 'failed';

  const listing = data?.listing as {
    customLabelSku?: string;
    title?: string;
    description?: string;
    cBrand?: string;
    cType?: string;
    cManufacturerPartNumber?: string;
    cOeOemPartNumber?: string;
    cFeatures?: string;
    categoryName?: string;
    categoryId?: string;
    conditionId?: string;
    startPrice?: string;
    startPriceNum?: number;
    quantity?: string;
    quantityNum?: number;
    pUpc?: string;
    pEpid?: string;
    location?: string;
    format?: string;
    sourceFileName?: string;
    marketplace?: string;
    status?: string;
    extractedMake?: string;
    extractedModel?: string;
    importedAt?: string;
    version?: number;
  };

  useEffect(() => setActiveImg(0), [listingId]);

  useEffect(() => {
    setEditingSku(false);
    setSkuError(null);
    setEditingLocation(false);
    setLocationError(null);
  }, [listingId]);

  useEffect(() => {
    setStagedImages([]);
    setUploadZoneKey((k) => k + 1);
    setUploadError(null);
  }, [listingId]);

  const handleSavePhotos = useCallback(async () => {
    if (!listingId || stagedImages.length === 0) return;
    setUploadError(null);
    try {
      await updateImages.mutateAsync({
        listingId,
        imageUrls: stagedImages.map((img) => img.cdnUrl).filter(Boolean),
        uploadedAssetIds: stagedImages.map((img) => img.assetId),
      });
      setStagedImages([]);
      setUploadZoneKey((k) => k + 1);
      const refetchResult = await refetch();

      // Only trigger enrichment when 2+ proper photos are attached.
      // Use the refetched data (not the stale closure) for the actual image count.
      const actualImages = refetchResult.data?.imageUrls ?? [];
      if (actualImages.length >= 2) {
        setEnrichingListingId(listingId);
        try {
          await inlineEnrich.mutateAsync({ listingId });
        } catch {
          // polling will show failed / ready status
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to save photos');
    }
  }, [listingId, stagedImages, updateImages, refetch, data?.imageUrls.length, inlineEnrich]);

  useEffect(() => {
    if (!listingId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setActiveImg((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setActiveImg((p) => Math.min((localImages.length || 1) - 1, p + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [listingId, onClose, localImages.length]);

  const handleSaveLocation = useCallback(async () => {
    if (!listingId || !listing) return;
    setLocationSaving(true);
    setLocationError(null);
    try {
      await fetchWithAuth(`/api/listings/${listingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          version: listing.version,
          location: locationValue.trim() || null,
        }),
      });
      await qc.invalidateQueries({ queryKey: ['inventory-detail', listingId] });
      await qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      setEditingLocation(false);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setLocationSaving(false);
    }
  }, [listingId, listing, locationValue, qc]);

  const handleSaveSku = useCallback(async () => {
    if (!listingId || !listing) return;
    const nextSku = skuValue.trim();
    if (!nextSku) {
      setSkuError('SKU cannot be empty');
      return;
    }
    setSkuSaving(true);
    setSkuError(null);
    try {
      await fetchWithAuth(`/api/listings/${listingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          version: listing.version,
          customLabelSku: nextSku,
        }),
      });
      await qc.invalidateQueries({ queryKey: ['inventory-detail', listingId] });
      await qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      setEditingSku(false);
    } catch (err) {
      setSkuError(err instanceof Error ? err.message : 'Failed to save SKU');
    } finally {
      setSkuSaving(false);
    }
  }, [listingId, listing, skuValue, qc]);

  if (!listingId) return null;

  const copySku = () => {
    if (listing?.customLabelSku) {
      navigator.clipboard.writeText(listing.customLabelSku);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 1500);
    }
  };

  const price = (() => {
    const raw = listing?.startPriceNum ?? listing?.startPrice;
    if (raw == null || raw === '') return null;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return Number.isFinite(n) ? n : null;
  })();

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl lg:max-w-5xl h-[95dvh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm shrink-0">
              Part Detail
            </h3>
            {listing?.customLabelSku && !editingSku && (
              <button
                type="button"
                onClick={copySku}
                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1 font-mono truncate max-w-[200px]"
              >
                {listing.customLabelSku}
                {copiedSku ? (
                  <Check size={11} className="text-emerald-400 shrink-0" />
                ) : (
                  <Copy size={11} className="shrink-0" />
                )}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {listingId && !isLoading && enrichingListingId && (
          <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              {isEnriching && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {stageLabel(enrichStage)}
                  </span>
                </>
              )}
              {enrichCompleted && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-500 font-medium">Enrichment complete</span>
                  <span className="text-xs text-slate-500">SEO listings created for US, AU, DE</span>
                </>
              )}
              {enrichNeedsReview && (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-500 text-xs">
                    Missing eBay category ID or fitment — retry enrichment when rate limits clear.
                  </span>
                  <button
                    type="button"
                    onClick={() => listingId && retryEnrich.mutate(listingId)}
                    disabled={retryEnrich.isPending}
                    className="text-xs text-violet-500 hover:text-violet-400 underline"
                  >
                    Retry enrichment
                  </button>
                </>
              )}
              {enrichFailed && (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-400 text-xs">
                    Enrichment failed — retry below or re-upload photos.
                  </span>
                  <button
                    type="button"
                    onClick={() => listingId && retryEnrich.mutate(listingId)}
                    disabled={retryEnrich.isPending}
                    className="text-xs text-violet-500 hover:text-violet-400 underline"
                  >
                    Retry enrichment
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400 text-sm">
            Loading…
          </div>
        )}

        {!isLoading && data && (
          <div className="overflow-y-auto flex-1 p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                {localImages.length > 0 ? (
                  <div className="space-y-3">
                    <div className="relative aspect-square bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img
                        src={localImages[activeImg]}
                        alt={listing?.title ?? 'Part'}
                        className="w-full h-full object-contain"
                      />
                      {localImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveImg((p) => Math.max(0, p - 1))}
                            disabled={activeImg === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveImg((p) => Math.min(localImages.length - 1, p + 1))
                            }
                            disabled={activeImg === localImages.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </>
                      )}
                    </div>
                    {localImages.length > 1 && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext items={localImages} strategy={horizontalListSortingStrategy}>
                          <div className="flex gap-2 overflow-x-auto pb-1 items-end">
                            {localImages.map((url, i) => (
                              <SortableImage
                                key={url}
                                id={url}
                                url={url}
                                index={i}
                                isActive={i === activeImg}
                                canEdit={canUploadImages}
                                onSelect={() => setActiveImg(i)}
                                onRemove={() => handleRemoveImage(url)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                    {orderDirty && (
                      <button
                        type="button"
                        onClick={() => void handleSaveOrder()}
                        disabled={reorderImages.isPending}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50"
                      >
                        {reorderImages.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save image order
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 p-4">
                    <ImageIcon className="h-10 w-10 text-amber-400" />
                    <span className="text-xs text-amber-400">No photos uploaded</span>
                  </div>
                )}

                {canUploadImages && listingId && (
                  <div className="mt-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Upload className="h-4 w-4" />
                      Add photos
                      <span className="text-xs font-normal text-slate-500">
                        (2 required: label close-up + overall shot for automatic enrichment)
                      </span>
                    </div>
                    <ImageUploadZone
                      key={uploadZoneKey}
                      onImagesChange={setStagedImages}
                      maxImages={24}
                    />
                    {stagedImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleSavePhotos()}
                        disabled={updateImages.isPending}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
                      >
                        {updateImages.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        Attach {stagedImages.length} photo{stagedImages.length !== 1 ? 's' : ''} to listing
                      </button>
                    )}
                    {uploadError && (
                      <p className="text-xs text-red-400 mt-2">{uploadError}</p>
                    )}
                  </div>
                )}

                {data.missingFields.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-900/20 border border-amber-700/40">
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Missing before pipeline
                    </div>
                    <ul className="text-xs text-amber-400/90 space-y-1">
                      {data.missingFields.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {listing?.title || listing?.cOeOemPartNumber || 'Untitled part'}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {listing?.status && (
                      <Badge variant="secondary" className="capitalize">
                        {listing.status}
                      </Badge>
                    )}
                    {listing?.sourceFileName === 'warehouse-intake' && (
                      <Badge variant="secondary">Intake</Badge>
                    )}
                    {listing?.marketplace && (
                      <Badge variant="outline">{listing.marketplace}</Badge>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-xs min-w-[280px]">
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      <tr>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          SKU
                        </td>
                        <td className="px-3 py-2">
                          {editingSku ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={skuValue}
                                onChange={(e) => setSkuValue(e.target.value)}
                                placeholder="e.g. BLA-18699"
                                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleSaveSku();
                                  if (e.key === 'Escape') setEditingSku(false);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveSku()}
                                disabled={skuSaving}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {skuSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSku(false)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : canEditListing ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSkuValue(listing?.customLabelSku ?? '');
                                setEditingSku(true);
                                setSkuError(null);
                              }}
                              className="font-mono text-xs text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                            >
                              {listing?.customLabelSku || (
                                <span className="text-slate-400 dark:text-slate-500 italic font-sans">
                                  Click to set SKU
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                              {listing?.customLabelSku || '—'}
                            </span>
                          )}
                          {skuError && (
                            <p className="text-[11px] text-red-400 mt-1">{skuError}</p>
                          )}
                        </td>
                      </tr>
                      <DetailRow label="Brand" value={listing?.cBrand} />
                      <DetailRow label="Type" value={listing?.cType} />
                      <DetailRow label="MPN" value={listing?.cManufacturerPartNumber} mono />
                      <DetailRow label="OEM Part #" value={listing?.cOeOemPartNumber} mono />
                      <DetailRow label="Category" value={listing?.categoryName} />
                      <DetailRow label="Category ID" value={listing?.categoryId} mono />
                      <DetailRow
                        label="Price"
                        value={price != null && !Number.isNaN(price) ? `$${price.toFixed(2)}` : null}
                      />
                      <DetailRow
                        label="Quantity"
                        value={listing?.quantityNum ?? listing?.quantity}
                      />
                      <DetailRow label="Condition" value={listing?.conditionId} />
                      <DetailRow label="UPC" value={listing?.pUpc} mono />
                      <DetailRow label="ePID" value={listing?.pEpid} mono />
                      <DetailRow label="Features" value={listing?.cFeatures} />
                      <tr>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} />
                            Location
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {editingLocation ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={locationValue}
                                onChange={(e) => setLocationValue(e.target.value)}
                                placeholder="e.g. Aisle 3, Bin B12"
                                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleSaveLocation();
                                  if (e.key === 'Escape') setEditingLocation(false);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveLocation()}
                                disabled={locationSaving}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {locationSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingLocation(false)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setLocationValue(listing?.location ?? '');
                                setEditingLocation(true);
                                setLocationError(null);
                              }}
                              className="text-sm text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                            >
                              {listing?.location || (
                                <span className="text-slate-400 dark:text-slate-500 italic">
                                  Click to set location
                                </span>
                              )}
                            </button>
                          )}
                          {locationError && (
                            <p className="text-[11px] text-red-400 mt-1">{locationError}</p>
                          )}
                        </td>
                      </tr>
                      <DetailRow label="Format" value={listing?.format} />
                      <DetailRow label="Extracted Make" value={listing?.extractedMake} />
                      <DetailRow label="Extracted Model" value={listing?.extractedModel} />
                      <DetailRow label="Source File" value={listing?.sourceFileName} />
                      <DetailRow
                        label="Imported"
                        value={
                          listing?.importedAt
                            ? new Date(listing.importedAt).toLocaleString()
                            : null
                        }
                      />
                    </tbody>
                  </table>
                </div>

                {listing?.description && (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Description
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-h-32 overflow-y-auto">
                      {stripHtml(listing.description)}
                    </p>
                  </div>
                )}

                {data.storeListings && data.storeListings.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Live eBay store listings
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500 dark:text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
                            <th className="pb-2 pr-2 font-medium">Store</th>
                            <th className="pb-2 pr-2 font-medium">Mkt</th>
                            <th className="pb-2 pr-2 font-medium">Price</th>
                            <th className="pb-2 pr-2 font-medium">Qty</th>
                            <th className="pb-2 pr-2 font-medium">Status</th>
                            <th className="pb-2 font-medium">Offer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.storeListings.map((s) => (
                            <tr
                              key={`${s.storeId}-${s.marketplaceId}`}
                              className="border-b border-slate-100 dark:border-slate-800"
                            >
                              <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-200">
                                {s.storeName}
                              </td>
                              <td className="py-1.5 pr-2 font-mono text-slate-500">
                                {s.marketplaceId.replace('EBAY_', '')}
                              </td>
                              <td className="py-1.5 pr-2">
                                {s.price != null ? `$${s.price.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-1.5 pr-2">{s.quantity ?? '—'}</td>
                              <td className="py-1.5 pr-2 capitalize">{s.status}</td>
                              <td className="py-1.5">
                                {s.listingUrl ? (
                                  <a
                                    href={s.listingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5"
                                  >
                                    {s.offerId?.slice(0, 8) ?? 'View'}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-slate-500 font-mono">
                                    {s.offerId?.slice(0, 10) ?? '—'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {data.marketplaceVariants.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Marketplace listings (US / AU / DE)
                    </h5>
                    <div className="space-y-2">
                      {data.marketplaceVariants.map((v) => (
                        <div
                          key={v.listingId}
                          className="flex items-center justify-between gap-2 text-xs p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                        >
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {v.marketplace ?? 'Base'}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 ml-2 capitalize">
                              {v.status}
                            </span>
                          </div>
                          {v.ebayListingId && (
                            <a
                              href={`https://www.ebay.com/itm/${v.ebayListingId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.pipelineJob && (
                  <div className="p-3 rounded-lg bg-purple-900/20 border border-purple-700/40">
                    <div className="flex items-center gap-2 text-purple-300 text-sm font-medium mb-1">
                      <Workflow className="h-4 w-4" />
                      Pipeline job
                    </div>
                    <p className="text-xs text-purple-200/80 font-mono">
                      {data.pipelineJob.id.slice(0, 8)}… —{' '}
                      <span className="capitalize">{data.pipelineJob.status.replace(/_/g, ' ')}</span>
                    </p>
                    <Link
                      to={`/pipeline?job=${data.pipelineJob.id}`}
                      className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                    >
                      View in Pipeline
                    </Link>
                  </div>
                )}

                {data.priorCompletedJobs.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-900/15 border border-amber-700/30">
                    <p className="text-xs text-amber-400">
                      Previously enriched — re-sending will create a new pipeline job.
                    </p>
                  </div>
                )}

                {data.fitments.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Car className="h-3.5 w-3.5" />
                      Fitments ({data.fitments.length})
                    </h5>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {data.fitments.slice(0, 20).map((f) => (
                        <div
                          key={f.id}
                          className="text-xs text-slate-600 dark:text-slate-400 font-mono"
                        >
                          {f.yearStart === f.yearEnd
                            ? f.yearStart
                            : `${f.yearStart}–${f.yearEnd}`}{' '}
                          {f.make} {f.model}
                          {f.submodel ? ` ${f.submodel}` : ''}
                        </div>
                      ))}
                      {data.fitments.length > 20 && (
                        <p className="text-xs text-slate-500">+{data.fitments.length - 20} more</p>
                      )}
                    </div>
                  </div>
                )}

                <Link
                  to={`/inventory/${listingId}/edit`}
                  className="text-xs font-medium text-purple-400 hover:underline"
                >
                  Open full editor →
                </Link>

                <Link
                  to="/catalog"
                  className="text-xs font-medium text-blue-400 hover:underline"
                >
                  Browse enriched parts in Catalog
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
