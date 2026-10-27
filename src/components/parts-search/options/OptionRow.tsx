/* ─── One sellable option (dense list row) ─────────────────
 *  Image · what it is · why it is here (match + trail) ·
 *  does it fit (verdict + evidence) · can we sell it now
 *  (stock, where, price, sellers) · actions.
 * ────────────────────────────────────────────────────────── */

import { Check, ChevronDown, Copy, Download, ExternalLink, ImageOff, Loader2, Warehouse } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney, partImageUrl } from '../../../lib/partsSearchApi';
import { downloadOmniImage, downloadPartImage, logSelection, type OptionItem } from '../../../lib/partsSearchOptionsApi';
import type { GalleryTarget } from './ImageGalleryDialog';
import InternalOffersTable from '../InternalOffersTable';
import { MATCH_LABEL, MATCH_STYLE, VERDICT } from './labels';

type Props = {
  item: OptionItem;
  query: string;
  requestRef: string;
  hasVehicle: boolean;
  onImage: (target: GalleryTarget) => void;
  /** Open the part description in a modal over the list. */
  onOpen: (item: OptionItem) => void;
  /** The part picked from the typeahead: highlighted and scrolled into view. */
  focused?: boolean;
};

export default function OptionRow({ item, query, requestRef, hasVehicle, onImage, onOpen, focused }: Props) {
  const rowRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focused]);
  const [details, setDetails] = useState<null | 'why' | 'stock'>(null);
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const image = imageFailed ? null : partImageUrl(item.image);
  const a = item.availability;
  const partNumber = item.manufacturerPartNumber || item.match.matchedNumber;
  const isOmni = item.partId.startsWith('omni:');
  const omni = item.omniStock;
  const price =
    a.priceMin != null && a.priceMax != null && a.priceMax > a.priceMin
      ? `${formatMoney(a.priceMin, a.currency)} – ${formatMoney(a.priceMax, a.currency)}`
      : formatMoney(a.priceMin, a.currency);
  const trail = item.match.trail.length > 1 || (item.match.relation !== 'exact' && item.match.trail.length) ? item.match.trail : [];
  const verdict = item.fitment.verdict ? VERDICT[item.fitment.verdict] : null;
  const select = (action: 'open' | 'copy' | 'external' | 'quote') => logSelection({ query, partId: item.partId, requestRef, action });

  const downloadImage = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      if (isOmni) await downloadOmniImage(item.partId);
      else await downloadPartImage(item.partId, 0);
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const copy = () => {
    if (!partNumber) return;
    void navigator.clipboard?.writeText(partNumber).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
    select('copy');
  };

  return (
    <li
      ref={rowRef}
      className={`border-b border-slate-100 px-3 py-2.5 last:border-0 dark:border-slate-800 ${a.status === 'not_available' && !(omni?.available ?? 0) ? 'opacity-70' : ''} ${focused ? 'bg-amber-50 ring-2 ring-inset ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-700' : ''}`}
    >
      <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-1 md:grid-cols-[56px_minmax(0,1fr)_150px_190px]">
        {/* image */}
        <button
          type="button"
          onClick={() => (image || item.imageCount > 0) && onImage({ partId: item.partId, title: item.title, fallbackUrl: image })}
          className="row-span-2 h-14 w-14 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          aria-label={image || item.imageCount ? `View ${item.imageCount > 1 ? `${item.imageCount} images` : 'image'}` : 'No image'}
          title={item.imageCount > 1 ? `${item.imageCount} images` : undefined}
          disabled={!image && !item.imageCount}
        >
          {image ? (
            <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="h-full w-full object-contain" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-slate-400"><ImageOff size={16} aria-hidden="true" /></span>
          )}
        </button>

        {/* what + why */}
        <div className="min-w-0">
          <a
            href={isOmni ? undefined : `/parts-search/parts/${encodeURIComponent(item.partId)}`}
            role={isOmni ? 'button' : undefined}
            tabIndex={0}
            onClick={(event) => {
              // Plain click opens the modal; ctrl/cmd/middle-click keeps "open in new tab".
              if (!isOmni && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
              event.preventDefault();
              select('open');
              onOpen(item);
            }}
            onKeyDown={(event) => {
              if (isOmni && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onOpen(item);
              }
            }}
            aria-haspopup="dialog"
            className="cursor-pointer font-medium text-slate-900 hover:underline dark:text-slate-100"
          >
            {item.title}
          </a>
          {focused && <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-800 dark:text-amber-100">Picked</span>}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {item.brand && <span className="font-medium">{item.brand}</span>}
            {partNumber && (
              <span className="inline-flex items-center font-mono">
                {partNumber}
                <button type="button" onClick={copy} className="ml-0.5 rounded px-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label={`Copy ${partNumber}`} title="Copy part number">
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </span>
            )}
            {a.bestCondition && <span>{a.bestCondition}</span>}
            {item.category && <span className="text-slate-500 dark:text-slate-400">{item.category}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {item.match.relation !== 'text' && (
              <span className={`rounded px-1.5 py-0.5 font-medium ${MATCH_STYLE[item.match.relation] ?? ''}`}>
                {isOmni ? `Our stock · ${item.match.label.toLowerCase()}` : MATCH_LABEL[item.match.relation] ?? item.match.label}
                {!isOmni && item.match.matchedNumber && item.match.relation !== 'exact' ? ` of ${item.match.matchedNumber}` : ''}
              </span>
            )}
            {hasVehicle || item.fitment.verdict === 'does_not_fit'
              ? verdict && (
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${verdict.className}`} title={item.fitment.reason ?? undefined}>
                    {verdict.label}
                  </span>
                )
              : null}
            {(hasVehicle || item.fitment.verdict === 'does_not_fit') && item.fitment.reason && (
              <span className="text-slate-500 dark:text-slate-400">{item.fitment.reason}</span>
            )}
            {!hasVehicle && item.fitment.verdict !== 'does_not_fit' && item.fitment.documented && (
              <span className="text-slate-500 dark:text-slate-400">Fits: {item.fitment.documented}</span>
            )}
            {item.match.note && (
              <span className={isOmni ? 'text-slate-500 dark:text-slate-400' : 'text-amber-700 dark:text-amber-400'}>{item.match.note}</span>
            )}
          </div>
        </div>

        {/* price */}
        <div className="col-start-2 text-sm md:col-start-3 md:row-start-1 md:text-right">
          <div className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{a.priceMin != null ? price : '—'}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {a.sellerCount ? `${a.sellerCount} seller${a.sellerCount === 1 ? '' : 's'}` : isOmni ? 'Omni Core' : 'no live offer'}
          </div>
        </div>

        {/* stock */}
        <div className="col-start-2 text-xs md:col-start-4 md:row-start-1">
          {a.status === 'in_stock' && (
            <div className="font-medium text-emerald-700 dark:text-emerald-400">
              {a.totalQuantity} in stock{a.locations[0] ? ` · ${a.locations[0].warehouse}${a.locations[0].location ? ` (${a.locations[0].location})` : ''}` : ''}
              {a.locations.length > 1 && <span className="text-slate-500 dark:text-slate-400"> +{a.locations.length - 1} more</span>}
            </div>
          )}
          {a.status === 'can_source' && (
            <div className="font-medium text-amber-700 dark:text-amber-400">Can source{a.leadTimeDays ? ` · ${a.leadTimeDays} days` : ''}</div>
          )}
          {a.status === 'not_available' && <div className="font-medium text-slate-500 dark:text-slate-400">Not available now</div>}
          {omni && omni.available > 0 && !isOmni && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <Warehouse size={12} aria-hidden="true" /> Omni Core: {omni.available}
              {omni.items[0]?.warehouses[0] ? ` · ${omni.items[0].warehouses[0].name}` : ''}
            </div>
          )}
          {omni?.canSource && <div className="mt-0.5 text-amber-700 dark:text-amber-400">Omni Core can source on demand</div>}
        </div>

        {/* actions */}
        <div className="col-start-2 flex flex-wrap items-center gap-3 text-xs md:col-span-3">
          {trail.length > 0 && (
            <button type="button" onClick={() => setDetails(details === 'why' ? null : 'why')} aria-expanded={details === 'why'} className="inline-flex items-center gap-0.5 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
              <ChevronDown size={13} className={details === 'why' ? 'rotate-180' : ''} aria-hidden="true" /> Why this part?
            </button>
          )}
          {item.offers.length > 0 && (
            <button type="button" onClick={() => setDetails(details === 'stock' ? null : 'stock')} aria-expanded={details === 'stock'} className="inline-flex items-center gap-0.5 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
              <ChevronDown size={13} className={details === 'stock' ? 'rotate-180' : ''} aria-hidden="true" /> Sellers &amp; stock ({item.offers.length})
            </button>
          )}
          {item.fitment.evidence.length > 0 && hasVehicle && (
            <span className="text-slate-400" title={item.fitment.evidence.map((e) => `${e.source} (${e.strength})`).join('\n')}>
              Evidence: {item.fitment.evidence.map((e) => e.source).slice(0, 2).join('; ')}
            </span>
          )}
          {(item.imageCount > 0 || (isOmni && item.image)) && (
            <button
              type="button"
              onClick={() => void downloadImage()}
              disabled={downloading}
              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-slate-100"
              title="Download the main image in full size"
            >
              {downloading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Download size={12} aria-hidden="true" />}
              Image
            </button>
          )}
          {downloadError && <span className="text-red-600 dark:text-red-400">{downloadError}</span>}
          <span className="ml-auto flex items-center gap-3">
            {item.publicUrl && (
              <a href={item.publicUrl} target="_blank" rel="noreferrer" onClick={() => select('external')} className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
                PartsBazar360 <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            <button type="button" disabled title="Reserve / quote from the portal is coming next" className="cursor-not-allowed rounded border border-slate-200 px-2 py-0.5 text-slate-400 dark:border-slate-700">
              Reserve / quote
            </button>
          </span>
        </div>
      </div>

      {details === 'why' && (
        <ol className="ml-[68px] mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          {trail.map((step, index) => (
            <li key={`${step.partId}-${index}`}>
              <span className="text-slate-400">{index + 1}.</span> {step.text} <span className="text-slate-400">— {step.source}</span>
            </li>
          ))}
        </ol>
      )}
      {details === 'stock' && (
        <div className="ml-[68px] mt-2">
          <InternalOffersTable offers={item.offers} compact />
        </div>
      )}
    </li>
  );
}
