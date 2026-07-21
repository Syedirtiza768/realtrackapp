/* ─── CatalogInventoryDetailModal ──────────────────────────
 *  Inventory summary + inline editing on the catalog page.
 *  eBay policies load after store selection (ProfileSelectors).
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  X,
  Pencil,
  Copy,
  Check,
  Tag,
  Layers,
  Globe,
  Users,
  MapPin,
  CircleDollarSign,
  Hash,
  Package,
  Calendar,
  Car,
  Scale,
  Image as ImageIcon,
  Loader2,
  Save,
  Store as StoreIcon,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import { fetchWithAuth } from '../../lib/authApi';
import { getAllImageUrls } from '../../lib/searchApi';
import { getStoresByChannel, getStoreProfiles } from '../../lib/multiStoreApi';
import {
  CONDITION_MAP,
  conditionLabel,
  type CatalogListingStatus,
  type ListingDetail,
  type SearchItem,
} from '../../types/search';
import type { Store } from '../../types/multiStore';
import TeamBadge from './TeamBadge';
import ProfileSelectors from './ProfileSelectors';
import {
  EMPTY_PROFILE_SELECTION,
  defaultProfileSelection,
  type ProfileSelection,
} from './profileUtils';
import ImageUploadZone from '../listings/ImageUploadZone';
import ImageZoom from '../ui/ImageZoom';
import type { UploadedImage } from '../../lib/storageApi';
import { usePermissions } from '../../hooks/usePermissions';

interface CatalogProductSummary {
  id: string;
  imageUrls?: string[];
  brand?: string | null;
  partType?: string | null;
  countryOfOrigin?: string | null;
  fitmentData?: Record<string, unknown>[] | null;
  categoryName?: string | null;
}

interface ListingDetailResponse {
  listing: ListingDetail;
  catalogProduct?: CatalogProductSummary | null;
}

interface EditDraft {
  title: string;
  brand: string;
  partType: string;
  countryOfOrigin: string;
  startPrice: string;
  quantity: string;
  location: string;
  conditionId: string;
}

interface Props {
  id: string | null;
  searchItem?: SearchItem | null;
  onClose: () => void;
}

const inputClass =
  'mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

function parseQuantity(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function deriveStockStatus(qty: number | null): { label: string; dotClass: string } {
  if (qty == null) return { label: 'Unknown', dotClass: 'bg-slate-400' };
  if (qty <= 0) return { label: 'Out of Stock', dotClass: 'bg-red-500' };
  if (qty <= 2) return { label: 'Low Stock', dotClass: 'bg-amber-500' };
  return { label: 'In Stock', dotClass: 'bg-emerald-500' };
}

const EBAY_STATUS: Record<CatalogListingStatus, { label: string; dotClass: string }> = {
  published: { label: 'Published', dotClass: 'bg-emerald-500' },
  ready_to_publish: { label: 'Ready to Publish', dotClass: 'bg-emerald-500' },
  need_images: { label: 'Need Images', dotClass: 'bg-amber-500' },
};

function formatCategoryBreadcrumb(name: string | null | undefined): string[] {
  if (!name?.trim()) return [];
  return name.split(/[/>›]+/).map((p) => p.trim()).filter(Boolean);
}

function formatFitmentLabel(row: Record<string, unknown>): string | null {
  const make = String(row.Make ?? row.make ?? '').trim();
  const model = String(row.Model ?? row.model ?? '').trim();
  const year = String(row.Year ?? row.year ?? '').trim();
  const yearStart = row.yearStart ?? row.YearStart;
  const yearEnd = row.yearEnd ?? row.YearEnd;

  let yearPart = year;
  if (!yearPart && yearStart != null) {
    const start = String(yearStart);
    const end = yearEnd != null ? String(yearEnd) : start;
    yearPart = start === end ? start : `${start}-${end}`;
  }

  if (!make && !model) return null;
  return [make, model, yearPart].filter(Boolean).join(' ');
}

function dedupeFitments(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const row of rows) {
    const label = formatFitmentLabel(row);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

function buildDraft(
  listing: ListingDetail,
  catalogProduct?: CatalogProductSummary | null,
  searchItem?: SearchItem | null,
): EditDraft {
  return {
    title: listing.title ?? '',
    brand: catalogProduct?.brand ?? listing.cBrand ?? searchItem?.cBrand ?? '',
    partType: catalogProduct?.partType ?? listing.cType ?? searchItem?.cType ?? '',
    countryOfOrigin: catalogProduct?.countryOfOrigin ?? '',
    startPrice: listing.startPrice ?? searchItem?.startPrice ?? '',
    quantity: listing.quantity ?? searchItem?.quantity ?? '',
    location: listing.location ?? searchItem?.location ?? '',
    conditionId: listing.conditionId ?? '3000',
  };
}

function useCatalogListingDetail(id: string | null) {
  return useQuery({
    queryKey: ['catalog-listing-detail', id],
    queryFn: () => fetchWithAuth<ListingDetailResponse>(`/api/listings/${id}`),
    enabled: !!id,
  });
}

function useEligibleStores() {
  return useQuery({
    queryKey: ['ebay-stores-eligible'],
    queryFn: () => getStoresByChannel('ebay'),
    staleTime: 60_000,
  });
}

interface DetailFieldProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  dotClass?: string;
  alwaysShow?: boolean;
}

function DetailField({ icon: Icon, label, value, dotClass, alwaysShow }: DetailFieldProps) {
  if (!alwaysShow && (value == null || value === '' || value === '—')) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
          {dotClass && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
          )}
          <span className="truncate">{value ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

interface EditableFieldProps {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
  mono?: boolean;
}

function EditableField({ icon: Icon, label, value, onChange, type = 'text', mono }: EditableFieldProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <label className="text-xs text-slate-500 dark:text-slate-400">{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} ${mono ? 'font-mono' : ''}`}
        />
      </div>
    </div>
  );
}

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  canEdit: boolean;
  onRemove: (index: number) => void;
  onZoom: (index: number) => void;
}

function SortableImage({ id, url, index, canEdit, onRemove, onZoom }: SortableImageProps) {
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
        onClick={() => onZoom(index)}
        className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
        aria-label="Zoom image"
      >
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </button>
      {canEdit && (
        <>
          <button
            type="button"
            className="absolute -top-1 -left-1 cursor-grab rounded bg-slate-700 p-0.5 text-white opacity-0 group-hover:opacity-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical size={10} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute -top-1 -right-1 rounded-full bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500"
            aria-label="Remove image"
          >
            <X size={10} />
          </button>
        </>
      )}
      {index === 0 && (
        <span className="absolute bottom-0 left-0 right-0 rounded-b bg-blue-600 px-0.5 text-center text-[8px] text-white">
          Primary
        </span>
      )}
    </div>
  );
}

export default function CatalogInventoryDetailModal({ id, searchItem, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has: hasPermission } = usePermissions();
  const canEditListing = hasPermission('listings.update');
  const canEditCatalog = hasPermission('catalog.update');
  const canEdit = canEditListing || canEditCatalog;
  const canUploadImages = hasPermission('listings.update');

  const { data, isLoading } = useCatalogListingDetail(id);
  const { data: stores = [], isLoading: storesLoading } = useEligibleStores();
  const listing = data?.listing;
  const catalogProduct = data?.catalogProduct;

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [initialProfiles, setInitialProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);
  const [profiles, setProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedSku, setCopiedSku] = useState(false);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);
  const [savingImages, setSavingImages] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [copiedImageUrls, setCopiedImageUrls] = useState(false);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { data: storeProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['store-profiles', selectedStoreId],
    queryFn: () => getStoreProfiles(selectedStoreId),
    enabled: !!selectedStoreId && editMode,
    staleTime: 60_000,
  });

  const selectedStore = useMemo<Store | null>(() => {
    if (!selectedStoreId) return null;
    return stores.find((s) => s.id === selectedStoreId) ?? null;
  }, [stores, selectedStoreId]);

  const catalogImages = useMemo(() => {
    if (catalogProduct?.imageUrls?.length) return catalogProduct.imageUrls;
    if (listing?.itemPhotoUrl) return getAllImageUrls(listing.itemPhotoUrl);
    return [];
  }, [catalogProduct?.imageUrls, listing?.itemPhotoUrl]);

  useEffect(() => {
    setLocalImages(catalogImages);
    setImageError(null);
  }, [catalogImages]);

  const imagesDirty = useMemo(() => {
    if (localImages.length !== catalogImages.length) return true;
    return localImages.some((url, i) => url !== catalogImages[i]);
  }, [localImages, catalogImages]);

  const canManageImages = canUploadImages && !!(catalogProduct?.id || listing);

  const fitmentLabels = useMemo(
    () => dedupeFitments((catalogProduct?.fitmentData ?? []) as Record<string, unknown>[]),
    [catalogProduct?.fitmentData],
  );

  const qty = parseQuantity(editMode && draft ? draft.quantity : listing?.quantity);
  const stockStatus = deriveStockStatus(qty);
  const catalogStatus: CatalogListingStatus =
    searchItem?.catalogStatus ?? (localImages.length === 0 ? 'need_images' : 'ready_to_publish');
  const ebayStatus = EBAY_STATUS[catalogStatus] ?? EBAY_STATUS.ready_to_publish;

  const categoryParts = formatCategoryBreadcrumb(
    catalogProduct?.categoryName ?? listing?.categoryName,
  );

  useEffect(() => {
    setEditMode(false);
    setDraft(null);
    setSelectedStoreId('');
    setProfiles(EMPTY_PROFILE_SELECTION);
    setInitialProfiles(EMPTY_PROFILE_SELECTION);
    setSaveError(null);
  }, [id]);

  useEffect(() => {
    if (!listing || !editMode) return;
    setDraft(buildDraft(listing, catalogProduct, searchItem));
    const fromListing: ProfileSelection = {
      shippingProfileName: listing.shippingProfileName ?? '',
      returnProfileName: listing.returnProfileName ?? '',
      paymentProfileName: listing.paymentProfileName ?? '',
    };
    if (!selectedStoreId) {
      setProfiles(fromListing);
      setInitialProfiles(fromListing);
    }
  }, [listing, catalogProduct, searchItem, editMode, selectedStoreId]);

  useEffect(() => {
    if (!editMode || !storeProfiles || !selectedStore || !listing) return;
    const next = defaultProfileSelection(storeProfiles, selectedStore, listing);
    setProfiles(next);
    setInitialProfiles(next);
  }, [storeProfiles, selectedStore, listing, editMode]);

  const isDirty = useMemo(() => {
    if (!editMode || !draft || !listing) return false;
    const base = buildDraft(listing, catalogProduct, searchItem);
    const draftChanged = (Object.keys(base) as (keyof EditDraft)[]).some((k) => draft[k] !== base[k]);
    const profilesChanged =
      profiles.shippingProfileName !== initialProfiles.shippingProfileName ||
      profiles.returnProfileName !== initialProfiles.returnProfileName ||
      profiles.paymentProfileName !== initialProfiles.paymentProfileName;
    return draftChanged || profilesChanged;
  }, [editMode, draft, listing, catalogProduct, searchItem, profiles, initialProfiles]);

  const openFullEditor = useCallback(() => {
    if (!id) return;
    navigate(`/catalog/products/${id}`);
    onClose();
  }, [id, navigate, onClose]);

  const toggleEditMode = () => {
    if (editMode) {
      setDraft(null);
      setSelectedStoreId('');
      setProfiles(EMPTY_PROFILE_SELECTION);
      setInitialProfiles(EMPTY_PROFILE_SELECTION);
      setSaveError(null);
      setEditMode(false);
    } else {
      setEditMode(true);
    }
  };

  const updateDraft = (field: keyof EditDraft, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!id || !listing || !draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const base = buildDraft(listing, catalogProduct, searchItem);

      if (canEditCatalog && catalogProduct?.id) {
        const catalogPatches: Record<string, string> = {};
        // Keep catalog_products.title in lockstep with listing title so a later
        // brand/image PATCH cannot resurrect a stale catalog title via sync.
        if (draft.title !== base.title) catalogPatches.title = draft.title;
        if (draft.brand !== base.brand) catalogPatches.brand = draft.brand;
        if (draft.partType !== base.partType) catalogPatches.partType = draft.partType;
        if (draft.countryOfOrigin !== base.countryOfOrigin) {
          catalogPatches.countryOfOrigin = draft.countryOfOrigin;
        }
        if (Object.keys(catalogPatches).length > 0) {
          await fetchWithAuth(`/api/catalog-products/${catalogProduct.id}`, {
            method: 'PATCH',
            body: JSON.stringify(catalogPatches),
          });
        }
      }

      if (canEditListing) {
        const listingUpdates: Record<string, string | number> = { version: listing.version };
        if (draft.title !== base.title) listingUpdates.title = draft.title;
        if (draft.startPrice !== base.startPrice) listingUpdates.startPrice = draft.startPrice;
        if (draft.quantity !== base.quantity) listingUpdates.quantity = draft.quantity;
        if (draft.location !== base.location) listingUpdates.location = draft.location;
        if (draft.conditionId !== base.conditionId) listingUpdates.conditionId = draft.conditionId;
        if (draft.brand !== base.brand) listingUpdates.cBrand = draft.brand;
        if (draft.partType !== base.partType) listingUpdates.cType = draft.partType;

        if (profiles.shippingProfileName !== initialProfiles.shippingProfileName) {
          listingUpdates.shippingProfileName = profiles.shippingProfileName;
        }
        if (profiles.returnProfileName !== initialProfiles.returnProfileName) {
          listingUpdates.returnProfileName = profiles.returnProfileName;
        }
        if (profiles.paymentProfileName !== initialProfiles.paymentProfileName) {
          listingUpdates.paymentProfileName = profiles.paymentProfileName;
        }

        if (Object.keys(listingUpdates).length > 1) {
          await fetchWithAuth(`/api/listings/${id}`, {
            method: 'PUT',
            body: JSON.stringify(listingUpdates),
          });
        }
      }

      await qc.invalidateQueries({ queryKey: ['catalog-listing-detail', id] });
      await qc.invalidateQueries({ queryKey: ['listing', id] });
      setEditMode(false);
      setDraft(null);
      setSelectedStoreId('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const copySku = () => {
    const sku = listing?.customLabelSku ?? searchItem?.customLabelSku;
    if (!sku) return;
    navigator.clipboard.writeText(sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 1500);
  };

  const copyImageUrls = () => {
    if (localImages.length === 0) return;
    navigator.clipboard.writeText(localImages.join(' | '));
    setCopiedImageUrls(true);
    setTimeout(() => setCopiedImageUrls(false), 1500);
  };

  const persistImages = useCallback(
    async (urls: string[]) => {
      if (!id || !listing) return;
      if (catalogProduct?.id && canEditCatalog) {
        await fetchWithAuth(`/api/catalog-products/${catalogProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ imageUrls: urls }),
        });
      } else if (canEditListing) {
        await fetchWithAuth(`/api/listings/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            itemPhotoUrl: urls.length > 0 ? urls.join('|') : '',
            version: listing.version,
          }),
        });
      }
      await qc.invalidateQueries({ queryKey: ['catalog-listing-detail', id] });
      await qc.invalidateQueries({ queryKey: ['listing', id] });
    },
    [id, listing, catalogProduct?.id, canEditCatalog, canEditListing, qc],
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalImages((prev) => {
      const oldIndex = prev.findIndex((u) => u === active.id);
      const newIndex = prev.findIndex((u) => u === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setLocalImages((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const handleSaveImages = useCallback(async () => {
    if (!imagesDirty) return;
    setSavingImages(true);
    setImageError(null);
    try {
      await persistImages(localImages);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to save images');
    } finally {
      setSavingImages(false);
    }
  }, [imagesDirty, localImages, persistImages]);

  const handleUploadComplete = useCallback(
    async (uploaded: UploadedImage[]) => {
      if (uploaded.length === 0 || !listing) return;
      const newUrls = uploaded.map((img) => img.cdnUrl).filter(Boolean);
      if (newUrls.length === 0) return;
      const merged = [...localImages, ...newUrls].slice(0, 24);
      setSavingImages(true);
      setImageError(null);
      try {
        await persistImages(merged);
        setLocalImages(merged);
        setUploadZoneKey((k) => k + 1);
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Failed to upload images');
      } finally {
        setSavingImages(false);
      }
    },
    [localImages, listing, persistImages],
  );

  useEffect(() => {
    if (!id) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editMode) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, onClose, editMode]);

  if (!id) return null;

  const thumbVisible = 6;
  const visibleImages = localImages.slice(0, thumbVisible);
  const overflowCount = Math.max(0, localImages.length - thumbVisible);
  const displayDraft = draft ?? (listing ? buildDraft(listing, catalogProduct, searchItem) : null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={editMode ? undefined : onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Inventory Details
          </h3>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={toggleEditMode}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  editMode
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Pencil size={13} />
                {editMode ? 'Editing' : 'Edit Details'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {!isLoading && listing && displayDraft && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {/* Hero */}
              <div className="flex gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {localImages[0] ? (
                  <button
                    type="button"
                    onClick={() => setZoomIndex(0)}
                    className="block h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                    aria-label="Zoom image"
                  >
                    <img src={localImages[0]} alt="" className="h-full w-full object-cover" />
                  </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Package size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {editMode ? (
                    <div>
                      <input
                        type="text"
                        value={displayDraft.title}
                        onChange={(e) => updateDraft('title', e.target.value)}
                        className={`${inputClass} text-base font-semibold`}
                        maxLength={80}
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block text-right">
                        {displayDraft.title.length}/80 characters
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openFullEditor}
                      className="text-left text-base font-semibold leading-snug text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {listing.title ?? 'Untitled'}
                    </button>
                  )}
                  {(listing.customLabelSku ?? searchItem?.customLabelSku) && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        SKU:{' '}
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {listing.customLabelSku ?? searchItem?.customLabelSku}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={copySku}
                        className="rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Copy SKU"
                      >
                        {copiedSku ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-1 gap-x-8 border-b border-slate-100 py-2 sm:grid-cols-2 dark:border-slate-800">
                {editMode ? (
                  <>
                    <EditableField
                      icon={Tag}
                      label="Brand"
                      value={displayDraft.brand}
                      onChange={(v) => updateDraft('brand', v)}
                    />
                    <div className="flex items-start gap-3 py-2.5">
                      <Layers size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <label className="text-xs text-slate-500 dark:text-slate-400">Condition</label>
                        <select
                          value={displayDraft.conditionId}
                          onChange={(e) => updateDraft('conditionId', e.target.value)}
                          className={inputClass}
                        >
                          {Object.entries(CONDITION_MAP).map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <EditableField
                      icon={Package}
                      label="Part Type"
                      value={displayDraft.partType}
                      onChange={(v) => updateDraft('partType', v)}
                    />
                    <EditableField
                      icon={CircleDollarSign}
                      label="Price"
                      value={displayDraft.startPrice}
                      onChange={(v) => updateDraft('startPrice', v)}
                      type="text"
                    />
                    <EditableField
                      icon={Globe}
                      label="Country of Origin"
                      value={displayDraft.countryOfOrigin}
                      onChange={(v) => updateDraft('countryOfOrigin', v)}
                    />
                    <EditableField
                      icon={Hash}
                      label="Quantity"
                      value={displayDraft.quantity}
                      onChange={(v) => updateDraft('quantity', v)}
                    />
                    <DetailField
                      icon={Package}
                      label="Stock Status"
                      value={stockStatus.label}
                      dotClass={stockStatus.dotClass}
                      alwaysShow
                    />
                    <DetailField
                      icon={Users}
                      label="Team"
                      value={
                        searchItem?.teamName ? (
                          <TeamBadge name={searchItem.teamName} color={searchItem.teamColor} />
                        ) : '—'
                      }
                      alwaysShow
                    />
                    <DetailField
                      icon={Tag}
                      label="eBay Status"
                      value={ebayStatus.label}
                      dotClass={ebayStatus.dotClass}
                      alwaysShow
                    />
                    <EditableField
                      icon={MapPin}
                      label="Storage Location"
                      value={displayDraft.location}
                      onChange={(v) => updateDraft('location', v)}
                    />
                    <DetailField
                      icon={Calendar}
                      label="Date Added"
                      value={
                        listing.importedAt
                          ? new Date(listing.importedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'
                      }
                      alwaysShow
                    />
                  </>
                ) : (
                  <>
                    <DetailField
                      icon={Tag}
                      label="Brand"
                      value={displayDraft.brand || null}
                    />
                    <DetailField
                      icon={Layers}
                      label="Condition"
                      value={conditionLabel(listing.conditionId)}
                    />
                    <DetailField
                      icon={Package}
                      label="Part Type"
                      value={displayDraft.partType || null}
                    />
                    <DetailField
                      icon={CircleDollarSign}
                      label="Price"
                      value={
                        displayDraft.startPrice
                          ? `$${parseFloat(displayDraft.startPrice.replace(',', '.')).toFixed(2)}`
                          : null
                      }
                    />
                    <DetailField
                      icon={Globe}
                      label="Country of Origin"
                      value={displayDraft.countryOfOrigin || null}
                    />
                    <DetailField
                      icon={Hash}
                      label="Quantity"
                      value={displayDraft.quantity || null}
                    />
                    <DetailField
                      icon={Package}
                      label="Stock Status"
                      value={stockStatus.label}
                      dotClass={stockStatus.dotClass}
                    />
                    <DetailField
                      icon={Users}
                      label="Team"
                      value={
                        searchItem?.teamName ? (
                          <TeamBadge name={searchItem.teamName} color={searchItem.teamColor} />
                        ) : null
                      }
                    />
                    <DetailField
                      icon={Tag}
                      label="eBay Status"
                      value={ebayStatus.label}
                      dotClass={ebayStatus.dotClass}
                    />
                    <DetailField
                      icon={MapPin}
                      label="Storage Location"
                      value={displayDraft.location || null}
                    />
                    {listing.weight != null && (
                      <DetailField
                        icon={Scale}
                        label="Weight"
                        value={`${listing.weight} kg`}
                      />
                    )}
                    <DetailField
                      icon={Calendar}
                      label="Date Added"
                      value={
                        listing.importedAt
                          ? new Date(listing.importedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : null
                      }
                    />
                  </>
                )}
              </div>

              {/* eBay Store & Policies */}
              <div className="border-b border-slate-100 py-4 dark:border-slate-800">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <StoreIcon size={14} />
                  eBay Store &amp; Policies
                </p>

                {editMode ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/30">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Target eBay store
                      </label>
                      {storesLoading ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                          <Loader2 size={12} className="animate-spin" />
                          Loading stores…
                        </div>
                      ) : stores.length === 0 ? (
                        <p className="text-xs text-amber-500">
                          No eBay stores connected. Add one in Settings → Integrations.
                        </p>
                      ) : (
                        <select
                          value={selectedStoreId}
                          onChange={(e) => setSelectedStoreId(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">— Select a store to load policies —</option>
                          {stores.map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.storeName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedStoreId ? (
                      <ProfileSelectors
                        profiles={storeProfiles}
                        loading={profilesLoading}
                        storeLabel={selectedStore?.storeName}
                        value={profiles}
                        onChange={setProfiles}
                      />
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Shipping, return, and payment policies are loaded from the selected store.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Shipping</p>
                      <p className="mt-0.5 truncate text-sm text-slate-800 dark:text-slate-200">
                        {listing.shippingProfileName ?? searchItem?.shippingProfileName ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Returns</p>
                      <p className="mt-0.5 truncate text-sm text-slate-800 dark:text-slate-200">
                        {listing.returnProfileName ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Payment</p>
                      <p className="mt-0.5 truncate text-sm text-slate-800 dark:text-slate-200">
                        {listing.paymentProfileName ?? '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Category */}
              {categoryParts.length > 0 && (
                <div className="border-b border-slate-100 py-4 dark:border-slate-800">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Category
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {categoryParts.join(' › ')}
                  </p>
                </div>
              )}

              {/* Images */}
              <div className="border-b border-slate-100 py-4 dark:border-slate-800">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Product Images ({localImages.length}/24)
                  </p>
                  <div className="flex items-center gap-2">
                    {localImages.length > 0 && (
                      <button
                        type="button"
                        onClick={copyImageUrls}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {copiedImageUrls ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                        {copiedImageUrls ? 'Copied' : 'Copy URLs'}
                      </button>
                    )}
                    {canManageImages && imagesDirty && (
                    <button
                      type="button"
                      onClick={() => void handleSaveImages()}
                      disabled={savingImages}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savingImages ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      Save order
                    </button>
                  )}
                  </div>
                </div>

                {canManageImages ? (
                  <>
                    {localImages.length > 0 ? (
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={localImages}
                          strategy={horizontalListSortingStrategy}
                        >
                          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
                            {localImages.map((url, i) => (
                              <SortableImage
                                key={url}
                                id={url}
                                url={url}
                                index={i}
                                canEdit
                                onRemove={handleRemoveImage}
                                onZoom={(idx) => setZoomIndex(idx)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-600">
                        <ImageIcon size={16} className="mr-1.5" />
                        No images — upload below
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                      Drag to reorder · hover to delete · first image is primary
                    </p>
                    <div className="mt-3 border-t border-slate-200/60 pt-3 dark:border-slate-700/60">
                      <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        Add images
                      </p>
                      {savingImages ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                          <Loader2 size={16} className="animate-spin" />
                          Saving…
                        </div>
                      ) : (
                        <ImageUploadZone
                          key={uploadZoneKey}
                          onImagesChange={handleUploadComplete}
                          maxImages={Math.max(0, 24 - localImages.length)}
                        />
                      )}
                    </div>
                    {imageError && (
                      <p className="mt-2 text-xs text-red-500">{imageError}</p>
                    )}
                  </>
                ) : localImages.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {visibleImages.map((url, i) => {
                      const isLast = i === visibleImages.length - 1 && overflowCount > 0;
                      return (
                        <div
                          key={url}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <button
                            type="button"
                            onClick={() => setZoomIndex(i)}
                            className="block h-full w-full"
                            aria-label="Zoom image"
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                          {isLast && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                              +{overflowCount}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-600">
                    <ImageIcon size={16} className="mr-1.5" />
                    No images
                  </div>
                )}
              </div>

              {/* Fitments */}
              {fitmentLabels.length > 0 && (
                <div className="py-4">
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Car size={14} />
                    Fitments / Compatibility
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {fitmentLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Car size={11} className="text-slate-400" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!editMode && (
                <div className="pt-2">
                  <Link
                    to={`/catalog/products/${id}`}
                    onClick={onClose}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Open full editor (preview &amp; publish) →
                  </Link>
                </div>
              )}
            </div>

            {/* Save bar */}
            {editMode && (
              <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/95">
                {saveError && (
                  <p className="mb-2 text-xs text-red-500">{saveError}</p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={toggleEditMode}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || !isDirty}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {zoomIndex !== null && (
          <ImageZoom
            images={localImages}
            index={zoomIndex}
            onClose={() => setZoomIndex(null)}
          />
        )}

        {!isLoading && !listing && (
          <div className="flex flex-1 items-center justify-center py-24 text-sm text-slate-500">
            Listing not found.
          </div>
        )}
      </div>
    </div>
  );
}
