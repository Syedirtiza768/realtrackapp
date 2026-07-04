/* ─── CatalogInventoryDetailModal ──────────────────────────
 *  Read-first inventory summary on the catalog page (mock UI).
 *  Title + "Edit Details" navigate to /catalog/products/:id.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Pencil,
  Copy,
  Check,
  Tag,
  Layers,
  Globe,
  Truck,
  Users,
  MapPin,
  CircleDollarSign,
  Hash,
  Package,
  Calendar,
  Car,
  Upload,
  Image as ImageIcon,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { fetchWithAuth } from '../../lib/authApi';
import { getAllImageUrls } from '../../lib/searchApi';
import { conditionLabel, type CatalogListingStatus, type ListingDetail, type SearchItem } from '../../types/search';
import TeamBadge from './TeamBadge';
import ImageUploadZone from '../listings/ImageUploadZone';
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

interface Props {
  id: string | null;
  searchItem?: SearchItem | null;
  onClose: () => void;
}

function formatPrice(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : null;
}

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

const EBAY_STATUS: Record<
  CatalogListingStatus,
  { label: string; dotClass: string }
> = {
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

function useCatalogListingDetail(id: string | null) {
  return useQuery({
    queryKey: ['catalog-listing-detail', id],
    queryFn: () => fetchWithAuth<ListingDetailResponse>(`/api/listings/${id}`),
    enabled: !!id,
  });
}

interface DetailFieldProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  dotClass?: string;
}

function DetailField({ icon: Icon, label, value, dotClass }: DetailFieldProps) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
          {dotClass && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
          )}
          <span className="truncate">{value}</span>
        </div>
      </div>
    </div>
  );
}

export default function CatalogInventoryDetailModal({ id, searchItem, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has: hasPermission } = usePermissions();
  const canUploadImages = hasPermission('listings.update');

  const { data, isLoading } = useCatalogListingDetail(id);
  const listing = data?.listing;
  const catalogProduct = data?.catalogProduct;

  const [copiedSku, setCopiedSku] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);
  const [savingImages, setSavingImages] = useState(false);

  const images = useMemo(() => {
    if (catalogProduct?.imageUrls?.length) return catalogProduct.imageUrls;
    if (listing?.itemPhotoUrl) return getAllImageUrls(listing.itemPhotoUrl);
    return [];
  }, [catalogProduct?.imageUrls, listing?.itemPhotoUrl]);

  const fitmentLabels = useMemo(
    () => dedupeFitments((catalogProduct?.fitmentData ?? []) as Record<string, unknown>[]),
    [catalogProduct?.fitmentData],
  );

  const qty = parseQuantity(listing?.quantity);
  const stockStatus = deriveStockStatus(qty);
  const catalogStatus: CatalogListingStatus =
    searchItem?.catalogStatus ?? (images.length === 0 ? 'need_images' : 'ready_to_publish');
  const ebayStatus = EBAY_STATUS[catalogStatus] ?? EBAY_STATUS.ready_to_publish;

  const categoryParts = formatCategoryBreadcrumb(
    catalogProduct?.categoryName ?? listing?.categoryName,
  );

  const openFullEditor = useCallback(() => {
    if (!id) return;
    navigate(`/catalog/products/${id}`);
    onClose();
  }, [id, navigate, onClose]);

  const copySku = () => {
    const sku = listing?.customLabelSku ?? searchItem?.customLabelSku;
    if (!sku) return;
    navigator.clipboard.writeText(sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 1500);
  };

  const handleUploadComplete = useCallback(
    async (uploaded: UploadedImage[]) => {
      if (!catalogProduct?.id || uploaded.length === 0) return;
      const newUrls = uploaded.map((img) => img.cdnUrl).filter(Boolean);
      const merged = [...images, ...newUrls];
      setSavingImages(true);
      try {
        await fetchWithAuth(`/api/catalog-products/${catalogProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ imageUrls: merged }),
        });
        setUploadZoneKey((k) => k + 1);
        setShowUpload(false);
        qc.invalidateQueries({ queryKey: ['catalog-listing-detail', id] });
        qc.invalidateQueries({ queryKey: ['listing', id] });
      } finally {
        setSavingImages(false);
      }
    },
    [catalogProduct?.id, images, id, qc],
  );

  useEffect(() => {
    if (!id) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, onClose]);

  if (!id) return null;

  const thumbVisible = 6;
  const visibleImages = images.slice(0, thumbVisible);
  const overflowCount = Math.max(0, images.length - thumbVisible);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
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
            <button
              type="button"
              onClick={openFullEditor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Pencil size={13} />
              Edit Details
            </button>
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

        {!isLoading && listing && (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Hero */}
            <div className="flex gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {images[0] ? (
                  <img src={images[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Package size={24} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={openFullEditor}
                  className="text-left text-base font-semibold leading-snug text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                >
                  {listing.title ?? 'Untitled'}
                </button>
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
              <DetailField
                icon={Tag}
                label="Brand"
                value={catalogProduct?.brand ?? listing.cBrand ?? searchItem?.cBrand}
              />
              <DetailField
                icon={Layers}
                label="Condition"
                value={conditionLabel(listing.conditionId)}
              />
              <DetailField
                icon={Package}
                label="Part Type"
                value={catalogProduct?.partType ?? listing.cType ?? searchItem?.cType}
              />
              <DetailField
                icon={CircleDollarSign}
                label="Price"
                value={formatPrice(listing.startPrice) ?? formatPrice(searchItem?.startPrice)}
              />
              <DetailField
                icon={Globe}
                label="Country of Origin"
                value={catalogProduct?.countryOfOrigin}
              />
              <DetailField
                icon={Hash}
                label="Quantity"
                value={qty != null ? String(qty) : listing.quantity ?? searchItem?.quantity}
              />
              <DetailField
                icon={Truck}
                label="Shipping Policy"
                value={listing.shippingProfileName ?? searchItem?.shippingProfileName}
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
                value={listing.location ?? searchItem?.location}
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
                    : null
                }
              />
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
                  Product Images ({images.length}/24)
                </p>
                {canUploadImages && catalogProduct?.id && (
                  <button
                    type="button"
                    onClick={() => setShowUpload((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Upload size={12} />
                    Upload Images
                  </button>
                )}
              </div>

              {images.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {visibleImages.map((url, i) => {
                    const isLast = i === visibleImages.length - 1 && overflowCount > 0;
                    return (
                      <div
                        key={url}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
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

              {showUpload && catalogProduct?.id && (
                <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  {savingImages ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                      <Loader2 size={16} className="animate-spin" />
                      Saving images…
                    </div>
                  ) : (
                    <ImageUploadZone
                      key={uploadZoneKey}
                      onImagesChange={handleUploadComplete}
                      maxImages={Math.max(0, 24 - images.length)}
                    />
                  )}
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

            <div className="pt-2">
              <Link
                to={`/catalog/products/${id}`}
                onClick={onClose}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Open full editor →
              </Link>
            </div>
          </div>
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
