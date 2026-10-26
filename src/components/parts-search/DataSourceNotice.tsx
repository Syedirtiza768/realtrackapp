import { Info, ShieldCheck } from 'lucide-react';
import type { PartsSearchAudience } from '../../lib/partsSearchApi';

/**
 * Says which PartsBazar360 view answered: internal (every offer, seller,
 * source and stock) or public (what buyers see). When internal search is
 * configured but failed, says why — the portal never silently downgrades.
 */
export default function DataSourceNotice({
  audience,
  internalUnavailableReason,
}: {
  audience: PartsSearchAudience;
  internalUnavailableReason?: string;
}) {
  if (audience === 'internal') {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <ShieldCheck size={14} aria-hidden="true" />
        Internal view: all offers, sellers, sources and stock
      </p>
    );
  }
  return (
    <p className="inline-flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>
        Buyer view: only offers buyers can see on partsbazar360.com
        {internalUnavailableReason ? ` (internal search unavailable: ${internalUnavailableReason})` : ''}
      </span>
    </p>
  );
}
