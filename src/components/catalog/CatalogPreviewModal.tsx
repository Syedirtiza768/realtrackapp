/* ─── CatalogPreviewModal ──────────────────────────────────
 *  Full eBay-style listing preview with inline editing,
 *  embedded in the catalog page. Replaces DetailModal.
 * ────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback } from 'react';
import { X, Pencil, Eye, ExternalLink } from 'lucide-react';
import { useListingDetail } from '../../lib/searchApi';
import { fetchWithAuth } from '../../lib/authApi';
import { buildEbayPreview, type CatalogProductPreviewData } from '../../lib/listingPreviewMapper';
import type { EbayListing } from '../../lib/ebayFileExchangeParser';
import { EbayListingPreview } from '../preview/EbayPreviewPage';
import EditListingPanel from '../preview/EditListingPanel';

interface Props {
  id: string | null;
  onClose: () => void;
  onPublish?: (listingId: string) => void;
}

export default function CatalogPreviewModal({ id, onClose, onPublish }: Props) {
  const { data: listing, loading } = useListingDetail(id);
  const [catalogProduct, setCatalogProduct] = useState<CatalogProductPreviewData | null>(null);
  const [ebayListing, setEbayListing] = useState<EbayListing | null>(null);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch catalog product data (for fitment) when listing loads
  useEffect(() => {
    if (!listing?.customLabelSku) {
      setCatalogProduct(null);
      return;
    }
    let cancelled = false;
    const sku = listing.customLabelSku;
    fetchWithAuth<{ products: Array<{ fitmentData?: Record<string, unknown>[] | null; brand?: string | null; partType?: string | null; placement?: string | null; material?: string | null; features?: string | null; countryOfOrigin?: string | null; oemPartNumber?: string | null; mpn?: string | null }> }>(
      `/api/catalog-products?sku=${encodeURIComponent(sku)}&limit=1`,
    )
      .then((res) => {
        if (cancelled) return;
        const product = res.products?.[0];
        if (product) {
          setCatalogProduct({
            fitmentData: product.fitmentData,
            brand: product.brand,
            partType: product.partType,
            placement: product.placement,
            material: product.material,
            features: product.features,
            countryOfOrigin: product.countryOfOrigin,
            oemPartNumber: product.oemPartNumber,
            mpn: product.mpn,
          });
        } else {
          setCatalogProduct(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogProduct(null);
      });
    return () => { cancelled = true; };
  }, [listing?.customLabelSku]);

  // Build EbayListing when listing or catalog product changes
  useEffect(() => {
    if (!listing) {
      setEbayListing(null);
      return;
    }
    setEbayListing(buildEbayPreview(listing, catalogProduct));
  }, [listing, catalogProduct]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!id) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, onClose]);

  const handleSave = useCallback(async (updated: EbayListing) => {
    if (!listing?.customLabelSku) return;
    const sku = listing.customLabelSku;

    // Update local preview immediately
    setEbayListing(updated);
    setSyncing(true);

    // Sync to catalog backend
    try {
      await fetchWithAuth(`/api/catalog-products/by-sku/${encodeURIComponent(sku)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          brand: updated.brand,
          mpn: updated.mpn,
          oemPartNumber: updated.oemPartNumber,
          partType: updated.type,
          placement: updated.placement,
          material: updated.material,
          features: updated.features,
          price: updated.price ? parseFloat(updated.price) : undefined,
          quantity: updated.quantity ? parseInt(updated.quantity, 10) : undefined,
          conditionId: updated.conditionId,
          imageUrls: updated.imageUrls,
          fitmentData: updated.compatibility?.map((f) => ({
            make: f.make, model: f.model, year: f.year,
          })),
        }),
      });
    } catch {
      // best-effort sync
    } finally {
      setSyncing(false);
    }
  }, [listing?.customLabelSku]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    // Revert to original data
    if (listing) {
      setEbayListing(buildEbayPreview(listing, catalogProduct));
    }
  }, [listing, catalogProduct]);

  if (!id) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-start justify-center overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1600px] my-2 sm:my-4 mx-2 sm:mx-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <Eye className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {listing?.title ?? 'Loading…'}
              </h3>
              {listing?.customLabelSku && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  SKU: {listing.customLabelSku}
                  {syncing && <span className="ml-2 text-blue-400">Syncing…</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Publish link */}
            {onPublish && id && (
              <button
                onClick={() => onPublish(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E53238] hover:text-[#ff6b6f] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Publish
              </button>
            )}
            {/* Edit toggle */}
            <button
              onClick={() => setEditing((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                editing
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              {editing ? 'Editing' : 'Edit'}
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && ebayListing && (
          <div className="flex">
            {/* eBay preview */}
            <div className={`min-w-0 overflow-auto ${editing ? 'flex-1' : 'w-full'}`} style={{ maxHeight: 'calc(100vh - 120px)' }}>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg m-2 sm:m-4 overflow-hidden">
                <EbayListingPreview listing={ebayListing} />
              </div>
            </div>

            {/* Edit panel */}
            {editing && (
              <div
                className="w-[420px] shrink-0 border-l border-slate-200 dark:border-slate-700 overflow-hidden"
                style={{ maxHeight: 'calc(100vh - 120px)' }}
              >
                <EditListingPanel
                  listing={ebayListing}
                  onSave={handleSave}
                  onCancel={handleCancelEdit}
                />
              </div>
            )}
          </div>
        )}

        {!loading && !ebayListing && (
          <div className="flex items-center justify-center py-32 text-slate-500 dark:text-slate-400 text-sm">
            Listing not found.
          </div>
        )}
      </div>
    </div>
  );
}
