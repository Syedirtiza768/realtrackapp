/* ─── Internal offers table ────────────────────────────────
 *  Every PartsBazar360 offer on a part, any status, with seller,
 *  store, source and stock. Only present when the backend reached
 *  PartsBazar360's internal (keyed) search.
 * ────────────────────────────────────────────────────────── */

import { formatMoney, type InternalOffer } from '../../lib/partsSearchApi';

function VisibilityBadge({ offer }: { offer: InternalOffer }) {
  if (offer.buyerVisible) {
    return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Live</span>;
  }
  if (offer.outrankedBySuperior) {
    return (
      <span
        title="Hidden from buyers: Superior Auto Parts has an offer on the same part"
        className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      >
        Outranked
      </span>
    );
  }
  return (
    <span
      title={`Hidden from buyers (offer ${offer.status.toLowerCase()}, seller ${offer.sellerStatus.toLowerCase()})`}
      className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
    >
      Hidden
    </span>
  );
}

type Props = { offers: InternalOffer[]; total?: number; compact?: boolean };

export default function InternalOffersTable({ offers, total, compact }: Props) {
  if (offers.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No offers recorded on PartsBazar360.</p>;
  }
  const hidden = (total ?? offers.length) - offers.length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="py-1.5 pr-3 font-medium">Seller</th>
            <th className="py-1.5 pr-3 font-medium">Buyer view</th>
            <th className="py-1.5 pr-3 font-medium">Price</th>
            {!compact && <th className="py-1.5 pr-3 font-medium">Seller base</th>}
            <th className="py-1.5 pr-3 font-medium">Condition</th>
            <th className="py-1.5 pr-3 font-medium">Stock</th>
            <th className="py-1.5 pr-3 font-medium">Source</th>
            <th className="py-1.5 pr-3 font-medium">Seller SKU</th>
            {!compact && <th className="py-1.5 font-medium">Updated</th>}
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
              <td className="py-1.5 pr-3">
                <div className="font-medium text-slate-800 dark:text-slate-100">{offer.sellerName}</div>
                {offer.sellerStoreId && <div className="text-[11px] text-slate-500 dark:text-slate-400">Store {offer.sellerStoreId}</div>}
              </td>
              <td className="py-1.5 pr-3"><VisibilityBadge offer={offer} /></td>
              <td className="py-1.5 pr-3 font-medium tabular-nums text-slate-800 dark:text-slate-100">{formatMoney(offer.price, offer.currency)}</td>
              {!compact && <td className="py-1.5 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{formatMoney(offer.sellerBasePrice, offer.currency)}</td>}
              <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{offer.condition}</td>
              <td className="py-1.5 pr-3 tabular-nums text-slate-600 dark:text-slate-300">
                {offer.warehouses.length ? (
                  <span title={offer.warehouses.map((w) => `${w.name}${w.location ? ` (${w.location})` : ''}: ${w.quantity}`).join('\n')}>
                    {offer.quantity}
                    {!compact && offer.warehouses.length > 0 && (
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {offer.warehouses.map((w) => w.name).join(', ')}
                      </span>
                    )}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">
                {offer.sourceTag ?? '—'}
                {!compact && offer.sourceKey && (
                  <span className="block max-w-[16rem] truncate text-[11px] text-slate-500 dark:text-slate-400" title={offer.sourceKey}>
                    {offer.sourceKey}
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">{offer.sellerSku ?? '—'}</td>
              {!compact && (
                <td className="py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400">{new Date(offer.updatedAt).toLocaleDateString()}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          +{hidden} more offer{hidden === 1 ? '' : 's'} — open the part to see all of them.
        </p>
      )}
    </div>
  );
}
