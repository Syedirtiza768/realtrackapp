/* ─── ListingCard ──────────────────────────────────────────
 *  Product card for grid view.
 *  Features: image with fallback, highlight matched text,
 *  condition badge, price display, lazy loading.
 * ────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { Eye, Image as ImageIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { getFirstImageUrl } from '../../lib/searchApi';
import type { SearchItem } from '../../types/search';
import { conditionLabel } from '../../types/search';

interface Props {
  item: SearchItem;
  onQuickView: (id: string) => void;
}

const formatPrice = (raw: string | null) => {
  if (!raw) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
};

export default function ListingCard({ item, onQuickView }: Props) {
  const imageUrl = getFirstImageUrl(item.itemPhotoUrl);
  const price = formatPrice(item.startPrice);
  const [imgErr, setImgErr] = useState(false);

  return (
    <article className="border border-slate-700/60 rounded-xl bg-slate-900/50 overflow-hidden flex flex-col group hover:border-slate-600 hover:shadow-lg hover:shadow-black/20 transition-all duration-200">
      {/* Image */}
      <div className="relative h-44 bg-slate-800 overflow-hidden">
        {imageUrl && !imgErr ? (
          <img
            src={imageUrl}
            alt={item.title ?? 'Product image'}
            loading="lazy"
            onError={() => setImgErr(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-700">
            <ImageIcon size={40} />
          </div>
        )}

        {/* Condition badge */}
        {item.conditionId && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] backdrop-blur-sm bg-slate-800/80">
            {conditionLabel(item.conditionId)}
          </Badge>
        )}

        {/* Relevance indicator */}
        {item.relevanceScore != null && item.relevanceScore > 0.5 && (
          <div className="absolute top-2 right-2 bg-emerald-600/80 backdrop-blur-sm text-white text-[9px] rounded-full px-1.5 py-0.5 font-semibold">
            {Math.min(Math.round(item.relevanceScore * 100), 99)}% match
          </div>
        )}

        {/* Quick view overlay */}
        <button
          onClick={() => onQuickView(item.id)}
          className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
        >
          <span className="bg-white/90 text-slate-900 font-medium text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <Eye size={13} /> Quick View
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5 flex-1 flex flex-col">
        {/* Title — use highlight if available */}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onQuickView(item.id); }}
          className="text-sm font-medium text-slate-100 hover:text-blue-400 line-clamp-2 transition-colors"
        >
          {item.titleHighlight ? (
            <span dangerouslySetInnerHTML={{ __html: item.titleHighlight }} />
          ) : (
            item.title ?? 'Untitled'
          )}
        </a>

        {/* SKU + Brand */}
        <div className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
          {item.customLabelSku && (
            <span className="font-mono bg-slate-800/60 rounded px-1 py-0.5">{item.customLabelSku}</span>
          )}
          {item.cBrand && <span>· {item.cBrand}</span>}
        </div>

        {/* Category (short) */}
        {item.categoryName && (
          <div className="text-[11px] text-slate-600 truncate">
            {(() => {
              const parts = item.categoryName.split('/').filter(Boolean);
              return parts.length > 1 ? parts.slice(-2).join(' › ') : item.categoryName;
            })()}
          </div>
        )}

        {/* Price + Qty */}
        <div className="flex items-end justify-between mt-auto pt-2">
          <div>
            {price !== null ? (
              <div className="text-lg font-bold text-slate-100">${price.toFixed(2)}</div>
            ) : (
              <div className="text-sm text-slate-500">No price</div>
            )}
            {item.quantity && (
              <div className="text-[11px] text-slate-500">
                Qty: {item.quantity}
                {item.format && ` · ${item.format}`}
              </div>
            )}
          </div>
          <button
            onClick={() => onQuickView(item.id)}
            className="px-2 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 inline-flex items-center gap-1 transition-colors"
          >
            <Eye size={12} /> View
          </button>
        </div>
      </div>
    </article>
  );
}
