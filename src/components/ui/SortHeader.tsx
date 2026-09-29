import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

interface Props {
  label: React.ReactNode;
  /** Direction currently applied to this column, or null when another column is sorted. */
  direction: SortDirection | null;
  onClick: () => void;
  align?: 'left' | 'center' | 'right';
  /** Uppercase + tracking (buttons don't inherit text-transform from the <th>). */
  caps?: boolean;
  className?: string;
}

const JUSTIFY = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const;

/** Clickable column header with an asc / desc / unsorted indicator. */
export default function SortHeader({ label, direction, onClick, align = 'left', caps = false, className = '' }: Props) {
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        direction === 'asc'
          ? 'Sorted ascending — click for descending'
          : direction === 'desc'
            ? 'Sorted descending — click for ascending'
            : 'Click to sort'
      }
      className={`group inline-flex w-full items-center gap-1 hover:text-slate-800 dark:hover:text-slate-100 ${JUSTIFY[align]} ${
        caps ? 'uppercase tracking-wide' : ''
      } ${direction ? 'text-blue-600 dark:text-blue-400' : ''} ${className}`}
    >
      <span>{label}</span>
      <Icon
        size={12}
        aria-hidden
        className={direction ? '' : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60'}
      />
    </button>
  );
}
