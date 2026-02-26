/* ─── DetailModal ──────────────────────────────────────────
 *  Full product detail modal with image gallery,
 *  specifications table, and description rendering.
 * ────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { getAllImageUrls, useListingDetail } from '../../lib/searchApi';
import { conditionLabel } from '../../types/search';

interface Props {
  id: string | null;
  onClose: () => void;
}

const formatPrice = (raw: string | null) => {
  if (!raw) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
};

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}

export default function DetailModal({ id, onClose }: Props) {
  const { data, loading } = useListingDetail(id);
  const images = data ? getAllImageUrls(data.itemPhotoUrl) : [];
  const [activeImg, setActiveImg] = useState(0);
  const [copiedSku, setCopiedSku] = useState(false);

  useEffect(() => setActiveImg(0), [data?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!id) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setActiveImg((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setActiveImg((p) => Math.min((images.length || 1) - 1, p + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, onClose, images.length]);

  if (!id) return null;

  const price = data ? formatPrice(data.startPrice) : null;

  const copySku = () => {
    if (data?.customLabelSku) {
      navigator.clipboard.writeText(data.customLabelSku);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 1500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl lg:max-w-5xl h-[95dvh] sm:h-auto sm:max-h-[90vh] bg-slate-900 border-0 sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-100 text-sm">Product Detail</h3>
            {data?.customLabelSku && (
              <button
                onClick={copySku}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 bg-slate-800 rounded-md px-2 py-1 font-mono"
              >
                {data.customLabelSku}
                {copiedSku ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && !loading && (
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Image gallery */}
              <div className="bg-slate-950 relative group">
                {images.length > 0 ? (
                  <>
                    <div className="relative">
                      <img
                        src={images[activeImg] ?? images[0]}
                        alt={data.title ?? ''}
                        className="w-full h-52 sm:h-64 lg:h-80 object-contain"
                      />
                      {/* Nav arrows */}
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={() => setActiveImg((p) => Math.max(0, p - 1))}
                            disabled={activeImg === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 disabled:opacity-30 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={() => setActiveImg((p) => Math.min(images.length - 1, p + 1))}
                            disabled={activeImg === images.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 disabled:opacity-30 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </>
                      )}
                      {/* Image counter */}
                      {images.length > 1 && (
                        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs rounded-full px-2 py-0.5 tabular-nums">
                          {activeImg + 1}/{images.length}
                        </span>
                      )}
                    </div>

                    {/* Thumbnail strip */}
                    {images.length > 1 && (
                      <div className="flex gap-1 p-2 overflow-x-auto bg-slate-900/50">
                        {images.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveImg(i)}
                            className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${
                              i === activeImg
                                ? 'border-blue-500 ring-1 ring-blue-500/50'
                                : 'border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-52 sm:h-64 lg:h-80 flex items-center justify-center text-slate-700">
                    <ImageIcon size={60} />
                  </div>
                )}
              </div>

              {/* Detail fields */}
              <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                {/* Title */}
                <h4 className="text-base sm:text-lg font-bold text-slate-100 leading-tight">{data.title}</h4>

                {/* Price & condition */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {price !== null && (
                    <span className="text-2xl font-bold text-slate-100">${price.toFixed(2)}</span>
                  )}
                  {data.conditionId && (
                    <Badge variant="secondary">{conditionLabel(data.conditionId)}</Badge>
                  )}
                  {data.quantity && (
                    <span className="text-xs text-slate-500">Qty: {data.quantity}</span>
                  )}
                </div>

                {/* Specs grid — scrollable on mobile */}
                <div className="border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-xs min-w-[320px]">
                    <tbody className="divide-y divide-slate-800">
                      <DetailRow label="SKU" value={data.customLabelSku} mono />
                      <DetailRow label="Brand" value={data.cBrand} />
                      <DetailRow label="Type" value={data.cType} />
                      <DetailRow label="MPN" value={data.cManufacturerPartNumber} mono />
                      <DetailRow label="OEM Part #" value={data.cOeOemPartNumber} mono />
                      <DetailRow label="Category" value={data.categoryName} />
                      <DetailRow label="Category ID" value={data.categoryId} mono />
                      <DetailRow label="UPC" value={data.pUpc} mono />
                      <DetailRow label="ePID" value={data.pEpid} mono />
                      <DetailRow label="Features" value={data.cFeatures} />
                      <DetailRow label="Location" value={data.location} />
                      <DetailRow label="Format" value={data.format} />
                      <DetailRow label="Source File" value={data.sourceFileName} />
                    </tbody>
                  </table>
                </div>

                {/* Description excerpt */}
                {data.description && (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</h5>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">
                      {stripHtml(data.description)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <tr>
      <td className="px-3 py-2 text-slate-500 font-medium w-32 bg-slate-800/30">{label}</td>
      <td className={`px-3 py-2 text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</td>
    </tr>
  );
}
