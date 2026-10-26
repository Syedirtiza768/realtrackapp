import { Check, ChevronDown, Copy, ExternalLink, ImageOff } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatMoney,
  matchReason,
  partImageUrl,
  partPublicUrl,
  type PartsSearchResult,
} from '../../lib/partsSearchApi';
import InternalOffersTable from './InternalOffersTable';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded px-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      aria-label={`Copy part number ${value}`}
      title="Copy part number"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function ResultCard({ result }: { result: PartsSearchResult }) {
  const [showOffers, setShowOffers] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const image = imageFailed ? null : partImageUrl(result.imageUrls?.[0]);
  const partNumber = result.manufacturerPartNumber || result.displayNumbers?.[0] || result.oemNumbers?.[0] || null;
  const reason = matchReason(result);
  const currency = result.currencies?.[0];
  const priceText =
    result.minPrice != null && result.maxPrice != null && result.maxPrice > result.minPrice
      ? `${formatMoney(result.minPrice, currency)} – ${formatMoney(result.maxPrice, currency)}`
      : formatMoney(result.minPrice, currency);
  const vehicles = [result.makes?.slice(0, 2).join(', '), result.models?.slice(0, 3).join(', ')].filter(Boolean).join(' · ');
  const hasInternal = Array.isArray(result.internalOffers);
  const offerTotal = result.internalOfferCount ?? result.offerCount ?? 0;
  const liveOffers = result.internalOffers?.filter((offer) => offer.buyerVisible).length;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex gap-4">
        <Link to={`/parts-search/parts/${encodeURIComponent(result.id)}`} className="shrink-0">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="h-24 w-24 rounded-lg bg-slate-50 object-contain dark:bg-slate-800"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
              <ImageOff size={20} aria-hidden="true" />
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <Link
              to={`/parts-search/parts/${encodeURIComponent(result.id)}`}
              className="min-w-0 flex-1 font-semibold text-slate-900 hover:underline dark:text-slate-100"
            >
              {result.title || 'Untitled part'}
            </Link>
            <div className="text-right">
              <div className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{priceText}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {offerTotal} offer{offerTotal === 1 ? '' : 's'}
                {hasInternal && liveOffers !== undefined && ` · ${liveOffers} live`}
              </div>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {(result.brandDisplay || result.brand) && <span className="font-medium">{result.brandDisplay || result.brand}</span>}
            {partNumber && (
              <span className="inline-flex items-center font-mono">
                {partNumber}
                <CopyButton value={partNumber} />
              </span>
            )}
            {result.category && <span>{result.category}</span>}
            {result.conditions?.length ? <span>{result.conditions.join(' / ')}</span> : null}
            {vehicles && <span className="text-slate-500 dark:text-slate-400">{vehicles}</span>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {reason && (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                Matched on {reason.toLowerCase()}
              </span>
            )}
            {result.matchedViaInterchange && (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                Interchange part
              </span>
            )}
            {result.inStock === false && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">Out of stock</span>
            )}
            {result.sourceTags?.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {tag}
              </span>
            ))}
            <a
              href={partPublicUrl(result)}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              PartsBazar360 <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>

          {hasInternal && (result.internalOffers?.length ?? 0) > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowOffers((value) => !value)}
                aria-expanded={showOffers}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              >
                <ChevronDown size={14} className={`transition-transform ${showOffers ? 'rotate-180' : ''}`} aria-hidden="true" />
                {showOffers ? 'Hide' : 'Show'} sellers &amp; stock
              </button>
              {showOffers && (
                <div className="mt-2">
                  <InternalOffersTable offers={result.internalOffers ?? []} total={result.internalOfferCount} compact />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
