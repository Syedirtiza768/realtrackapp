import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  Sparkles,
  Loader2,
  Upload,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { useInventoryDetail, useInventoryPartLookup, useUpdateInventoryImages } from '../../lib/inventoryApi';
import { usePermissions } from '../../hooks/usePermissions';
import ImageUploadZone from '../listings/ImageUploadZone';
import type { UploadedImage } from '../../lib/storageApi';

interface Props {
  listingId: string | null;
  onClose: () => void;
  canFetchDetails?: boolean;
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

export default function InventoryDetailModal({ listingId, onClose, canFetchDetails }: Props) {
  const { data, isLoading, refetch } = useInventoryDetail(listingId);
  const partLookup = useInventoryPartLookup();
  const updateImages = useUpdateInventoryImages();
  const { has: hasPermission } = usePermissions();
  const canUploadImages = hasPermission('listings.update');

  const images = data?.imageUrls ?? [];
  const [activeImg, setActiveImg] = useState(0);
  const [copiedSku, setCopiedSku] = useState(false);
  const [uploadZoneKey, setUploadZoneKey] = useState(0);
  const [stagedImages, setStagedImages] = useState<UploadedImage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
  };

  useEffect(() => setActiveImg(0), [listingId]);

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
      await refetch();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to save photos');
    }
  }, [listingId, stagedImages, updateImages, refetch]);

  useEffect(() => {
    if (!listingId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setActiveImg((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setActiveImg((p) => Math.min((images.length || 1) - 1, p + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [listingId, onClose, images.length]);

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
            {listing?.customLabelSku && (
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

        {canFetchDetails && listingId && !isLoading && (
          <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  await partLookup.mutateAsync(listingId);
                  await refetch();
                } catch {
                  /* parent list shows action errors if needed */
                }
              }}
              disabled={partLookup.isPending || (data?.imageUrls.length ?? 0) < 2}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Vision: OEM + brand + photos → title, category, SEO notes"
            >
              {partLookup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Fetch details
            </button>
            {(data?.imageUrls.length ?? 0) < 2 && (
              <p className="text-[11px] text-amber-400 mt-1">Requires 2+ photos (label + overall)</p>
            )}
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
                {images.length > 0 ? (
                  <div className="space-y-3">
                    <div className="relative aspect-square bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img
                        src={images[activeImg]}
                        alt={listing?.title ?? 'Part'}
                        className="w-full h-full object-contain"
                      />
                      {images.length > 1 && (
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
                              setActiveImg((p) => Math.min(images.length - 1, p + 1))
                            }
                            disabled={activeImg === images.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </>
                      )}
                    </div>
                    {images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {images.map((url, i) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setActiveImg(i)}
                            className={`shrink-0 w-14 h-14 rounded border overflow-hidden ${
                              i === activeImg
                                ? 'border-blue-500 ring-1 ring-blue-500'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
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
                        (min 2 for Fetch details: label + overall)
                      </span>
                    </div>
                    <ImageUploadZone
                      key={uploadZoneKey}
                      onImagesChange={setStagedImages}
                      maxImages={12}
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
                      <DetailRow label="SKU" value={listing?.customLabelSku} mono />
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
                      <DetailRow label="Location" value={listing?.location} />
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
