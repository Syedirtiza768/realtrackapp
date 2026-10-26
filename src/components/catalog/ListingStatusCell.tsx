import { Check, ImageIcon, ShieldAlert, Upload } from 'lucide-react';
import type { CatalogListingStatus } from '../../types/search';

interface Props {
  status: CatalogListingStatus | undefined;
  onPublish?: () => void;
}

const CONFIG: Record<
  CatalogListingStatus,
  { label: string; className: string; icon: typeof Upload }
> = {
  ready_to_publish: {
    label: 'Publish',
    className:
      'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40',
    icon: Upload,
  },
  published: {
    label: 'Published',
    className:
      'border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/30',
    icon: Check,
  },
  need_images: {
    label: 'Need Images',
    className:
      'border-amber-200 text-amber-700 bg-amber-50/50 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/30',
    icon: ImageIcon,
  },
  needs_review: {
    label: 'Needs Review',
    className:
      'border-amber-200 text-amber-800 bg-amber-50/70 dark:border-amber-800 dark:text-amber-200 dark:bg-amber-950/40',
    icon: ShieldAlert,
  },
};

export default function ListingStatusCell({ status, onPublish }: Props) {
  const key = status ?? 'ready_to_publish';
  // API status values can reach the frontend before its type/config is updated.
  // Treat unknown values as review holds so the catalog stays usable and cannot
  // accidentally offer a publish action for a status it does not understand.
  const cfg = CONFIG[key] ?? CONFIG.needs_review;
  const Icon = cfg.icon;
  const clickable = key === 'ready_to_publish' && onPublish;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onPublish : undefined}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${cfg.className} ${
        clickable ? 'cursor-pointer' : 'cursor-default'
      } disabled:opacity-90`}
    >
      <Icon size={12} />
      {cfg.label}
    </button>
  );
}
