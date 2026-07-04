interface Props {
  name: string | null | undefined;
  color?: string | null;
  className?: string;
}

export default function TeamBadge({ name, color, className = '' }: Props) {
  if (!name) {
    return <span className={`text-xs text-slate-400 ${className}`}>—</span>;
  }

  const dotColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#3B82F6';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${className}`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden
      />
      {name}
    </span>
  );
}
